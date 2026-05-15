# Stripe Backend (Sub-project 4c-2) Design

## Goal

`StripeService` + webhook receiver + billing endpoints を追加し、Stripe Checkout サブスク購入 → webhook 駆動で 4c-1 の `MonthlyQuota` を付与、プラン変更/解約は Customer Portal に集約する。Frontend (`/mypage/plan`) は含まない (= 4c-3)。

## Context & dependencies

- 親 spec: [`2026-05-15-stripe-integration-design.md`](./2026-05-15-stripe-integration-design.md) — Q1-Q11 / D1-D4 / 4c-2 境界は確定済。本 spec はその 4c-2 を完全仕様化する。
- **依存**: 4c-1 (PR #15、quota multi-doc + FIFO + `MonthlyQuotaRepository.save` 新 doc-id) がマージ済であること。4c-2 の quota grant は 4c-1 の `save` を経由する。
- 確定済の関連決定: Q4 (webhook `invoice.paid` 駆動 grant + 2ヶ月有効)、Q5 (proration + 差分 grant)、Q6 (期間末解約)、Q9 (Smart Retries + メール通知)、Q11 (`client_reference_id`+`subscription.metadata.firebase_uid`)、D3 (`invoice.paid` が `subscription_update` 時 skip、`subscription.updated` が差分担当)。

## Settled (4c-2 固有)

| # | 決定 |
|---|---|
| Q-S1 | Stripe 公式 `stripe` Python lib (同期) を `asyncio.to_thread(...)` でラップ。非公式 async fork / httpx 直叩きは不採用 |
| DI | `StripeService` は endpoint で per-request 組み立て (`get_stripe_service` dependency、`get_booking_service` と同流儀)。Container singleton ではない |
| 冪等性 | `ProcessedEventRepository.mark_if_unprocessed` (atomic create-if-absent)。**event 種別で戦略を変える** (下記) |
| Email | `EmailService` Protocol に `send_payment_failed` 追加、SMTP/Mock 両実装 |

## Architecture

### SDK 実行モデル
公式 `stripe` lib は同期 API のみ。FastAPI async endpoint 内で `await asyncio.to_thread(stripe.X.create, **kwargs)` で別スレッドに退避し event loop ブロックを回避。型は `stripe` パッケージ同梱 stub。

### Layering (DDD 維持)
```
api/endpoints/billing.py        ← 3 endpoint (checkout / portal / webhook)
api/schemas/billing.py          ← Pydantic request/response
        ↓
services/stripe_service.py      ← Stripe SDK 呼び出し + webhook dispatch + handler
        ↓
domain/repositories/processed_event_repository.py   (interface, 新規)
infrastructure/repositories/firestore_processed_event_repository.py (impl, 新規)
        + 4c-1 の MonthlyQuotaRepository.save / UserRepository
        + container.email_service()
```
price→Plan 逆引きは `StripeService` 内で env (`stripe_price_*`) から構築する `dict[str, Plan]`。

### DI (M-5: factory body 明記)
`app/api/dependencies/repositories.py` (既存 `get_booking_service` の隣) に追加:

```python
def get_stripe_service() -> StripeService:
    client = get_firestore_client()
    return StripeService(
        user_repo=FirestoreUserRepository(client),
        quota_repo=FirestoreMonthlyQuotaRepository(client),
        email_service=get_container().email_service(),
        processed_repo=FirestoreProcessedEventRepository(client),
        fs_client=client,
        settings=get_settings(),
    )
```
`get_booking_service` と同流儀の per-request 構築。`email_service` のみ Container singleton 由来 (`MockEmailService`/`SMTPEmailService` の環境分岐は Container が既に担う)。`get_settings()` は既存の lru_cache 済 settings provider。

## Data model

### `User` entity 追加フィールド
```python
stripe_customer_id: str | None = None
stripe_subscription_id: str | None = None
subscription_status: str | None = None          # 'active'|'past_due'|'canceled'|None
subscription_cancel_at_period_end: bool = False
current_period_end: datetime | None = None
```
- **フィールド配置 (M-2)**: `User` は dataclass、末尾が `created_at`/`updated_at`。5 つの新フィールドは全てデフォルト値付きなので `updated_at` の後に追記する。全呼び出し箇所が kwargs 構築 (検証済) のため位置安全。`is_admin` は dataclass フィールドではなく `auth.py` が construction 後に代入する runtime 属性 → 無関係・不変
- `FirestoreUserRepository._to_dict`/`_from_dict` に 5 フィールド追加 (読み取り欠損時は上記デフォルト)
- `User.update_subscription(*, customer_id=None, subscription_id=..., status=..., cancel_at_period_end=..., current_period_end=...)` ヘルパーで一括更新 + `updated_at` 更新

### `MonthlyQuota` は変更しない (4c-1 から完全に独立)

当初案の `MonthlyQuota.source_event_id` 追加は **撤回**。exactly-once は `processed_stripe_events/{event.id}` doc と quota 書き込みを **同一 Firestore transaction** に入れることで担保する (C1 修正、下記)。`MonthlyQuota` / `FirestoreMonthlyQuotaRepository` への変更は一切不要 → 4c-2 は 4c-1 に対し完全 additive。

### `ProcessedEvent` — 新規
- collection `processed_stripe_events`、doc id = Stripe `event.id`
- body: `{ "event_type": str, "processed_at": datetime }`
- `ProcessedEventRepository` interface (2 つの使い方を提供):
  - `claim(event_id: str, event_type: str) -> bool` — `document(event_id).create({...})` を試み `google.api_core.exceptions.AlreadyExists` を捕捉。create 成功=True (初回)、衝突=False (重複)。**非クリティカル event の claim-first 用**
  - `transactional` 用途では StripeService が `fs_client` で直接 `tx.get`/`tx.set` する (クリティカル `invoice.paid` のみ。下記 handle_webhook 参照)。repo は単一 doc ヘルパーとして `doc_ref(event_id)` も公開
- impl: `FirestoreProcessedEventRepository`

## StripeService

```python
class StripeService:
    def __init__(self, user_repo, quota_repo, email_service,
                 processed_repo, fs_client, settings): ...
    async def create_checkout_session(self, *, user: User, plan: Plan) -> str
    async def create_portal_session(self, *, user: User) -> str
    async def handle_webhook(self, *, raw_payload: bytes, sig_header: str) -> None
```

### create_checkout_session
`await asyncio.to_thread(stripe.checkout.Session.create, mode="subscription", line_items=[{"price": self._price_map[plan], "quantity": 1}], client_reference_id=user.uid, subscription_data={"metadata": {"firebase_uid": user.uid}}, customer=user.stripe_customer_id or None, customer_email=(user.email if not user.stripe_customer_id else None), automatic_tax={"enabled": True}, success_url=settings.checkout_success_url, cancel_url=settings.checkout_cancel_url)` → returns `session.url`.

### create_portal_session
`user.stripe_customer_id` が None → `HTTPException(409, {"code": "no_subscription"})`。あり → `await asyncio.to_thread(stripe.billing_portal.Session.create, customer=user.stripe_customer_id, return_url=settings.stripe_portal_return_url)` → `session.url`.

### Stripe lib / API version pin (I-1, I-2)
- `pyproject.toml`: `stripe = "~=9.0"` (major pin; 実装者は pin 版で例外パスを確認)。例外は **`stripe.SignatureVerificationError`** を使う (modern path; `stripe.error.SignatureVerificationError` は別名で残るが正準は前者)
- StripeService 初期化時に `stripe.api_version = "2024-06-20"` を明示セット (この版で `invoice.subscription` が string id として存在することを前提とする)。`AlreadyExists` は `google.api_core.exceptions.AlreadyExists`
- subscription id 取得は防御的に: `sub_id = invoice.get("subscription") or invoice.get("parent", {}).get("subscription_details", {}).get("subscription")`。取れなければ error log + 200 return

### handle_webhook
1. `event = await asyncio.to_thread(stripe.Webhook.construct_event, raw_payload, sig_header, settings.stripe_webhook_secret)` — 失敗時 `stripe.SignatureVerificationError` を raise（endpoint が 400 に変換）。※ `construct_event` は純 HMAC で速いので `to_thread` は必須ではないが、SDK 呼び出しを一貫して off-loop に保つため統一 (例外は `to_thread` がそのまま再 raise、伝播不変)
2. **冪等戦略**:
   - **クリティカル `invoice.paid` (quota grant)**: 単一 `@fs.async_transactional` で
     1. `pe_ref = fs.collection("processed_stripe_events").document(event.id)` を `await pe_ref.get(transaction=tx)`
     2. 既存 → `return` (skip。exactly-once)
     3. 未存在 → uid/plan を解決し quota doc を `tx.set(monthly_quota.document(quota_doc_id), quota_dict)` + `tx.set(pe_ref, {...})` を**同一 txn でコミット**
     - 並行二重配信時、Firestore async txn は read-set (`pe_ref`) 競合を検知し片方を retry。retry 側は `pe_ref` 既存を見て skip → **並行でも exactly-once** (C1 解消、親 spec の I4 契約を満たす)。`booking_service` の既存パターンと同型 (全 read を全 write の前)
   - **非クリティカル** (`checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`): `if not await processed_repo.claim(event.id, event.type): return` (claim-first; `create()` の atomic fail-if-exists)。その後の副作用は user doc の冪等な上書きのみ
3. `event.type` で dispatch:

| event.type | handler |
|---|---|
| `checkout.session.completed` | `event.data.object.client_reference_id` = uid → `user_repo.find_by_uid`。`stripe_customer_id`, `stripe_subscription_id`, `subscription_status='active'` を保存。subscription を retrieve し price → `_plan_for_price` で `users.plan` + `plan_started_at=now`。**quota grant しない** (claim-first) |
| `invoice.paid` | **(クリティカル, 上記 atomic txn)** `_resolve_uid_from_invoice(invoice)` (subscription を retrieve し `subscription.metadata.firebase_uid`) で User 特定、price → plan。**`billing_reason` に関わらず常に** `PLAN_QUOTA[plan]` 分の MonthlyQuota を txn 内で 1 doc grant (`granted_at=now`, `expires_at=add_two_months(now)`, `plan_at_grant=plan`, doc-id `{uid}_{granted_at:%Y%m%d%H%M%S%f}`)。Y: invoice.paid が唯一の grant 経路。billing_reason 分岐なし → 未知 billing_reason でも正しく付与され、二重付与は processed_event の event.id 単位 exactly-once で原理的に不能 (I-3 解消) |
| `customer.subscription.updated` | `subscription.items.data[0].price.id` → plan。`users.plan` を更新するのみ。**quota grant は一切しない** (Y: 差分 grant 廃止)。`cancel_at_period_end` / `current_period_end` (= `datetime.fromtimestamp(ts, tz=UTC)`, I-4) / `status` を `User.update_subscription` で反映 (claim-first) |
| `customer.subscription.deleted` | `subscription.metadata.firebase_uid` で User。`plan=None`, `subscription_status='canceled'`, `stripe_subscription_id=None` |
| `invoice.payment_failed` | `_resolve_uid_from_invoice(invoice)` で User 特定 → `subscription_status='past_due'` 保存 + `email_service.send_payment_failed(user.email, user.name)` (claim-first) |
| その他 event.type | 無視 (200 で返す) |

`_resolve_uid_from_invoice(invoice)` は共通ヘルパー: 上記の防御的 subscription id 取得 → `stripe.Subscription.retrieve(sub_id)` を `to_thread` → `subscription.metadata.get("firebase_uid")`。`invoice.payment_failed` / `invoice.paid` / `customer.subscription.deleted` 全てこのヘルパーで uid を引く。

User が特定できない (uid/metadata 取れない) 場合は error log し例外を投げない (endpoint は 200、Stripe 無限再送防止)。

## Endpoints (`app/api/endpoints/billing.py`)

```
POST /api/v1/billing/checkout   auth=get_current_user   body=CheckoutRequest      -> {url:str}
POST /api/v1/billing/portal     auth=get_current_user   body={}                   -> {url:str}
POST /api/v1/billing/webhook    認証なし (Stripe 署名検証)                          -> 200 {}
```

- `CheckoutRequest{ plan: Literal["light","standard","intensive"] }`、response `CheckoutResponse{ url: str }`、portal も `{url:str}`
- `webhook`: `payload = await request.body()`; `sig = request.headers.get("stripe-signature","")`; `stripe.SignatureVerificationError` → `HTTPException(400, {"code":"invalid_signature"})`; その他処理内例外 → log + **`return {}` (200)**（Stripe 無限再送防止。クリティカル grant が txn 内で失敗した場合は processed_event も書かれずロールバックされるので、Stripe 再送で安全に再試行される ← 冪等戦略と整合）
- `main.py` に `billing` router 登録。webhook は CORS 対象外（サーバ間 POST、`CORSMiddleware` は preflight のみ管理、Stripe は preflight しない）

### `/users/me` 拡張
4c-1 の `UserResponse` (`api/schemas/user.py`) に `stripe_subscription_id`, `subscription_status`, `subscription_cancel_at_period_end`, `current_period_end` を追加。`get_profile` で `user` から詰める (4c-3 のプラン画面が利用)。`quota_summary` は 4c-1 のまま。

## Config (`app/config.py` Settings 追加)

| key | default | 本番 |
|---|---|---|
| `stripe_secret_key` | `""` | HCP sensitive |
| `stripe_webhook_secret` | `""` | HCP sensitive (deploy 後投入) |
| `stripe_price_light` | `""` | HCP |
| `stripe_price_standard` | `""` | HCP |
| `stripe_price_intensive` | `""` | HCP |
| `stripe_portal_return_url` | `"http://localhost:3010/mypage/plan"` | `https://english-cafe.bz-kz.com/mypage/plan` |
| `checkout_success_url` | `"http://localhost:3010/mypage/plan?status=success"` | 本番ドメイン |
| `checkout_cancel_url` | `"http://localhost:3010/mypage/plan?status=cancel"` | 本番ドメイン |

ローカル/テストは `stripe_secret_key=sk_test_dummy` + SDK mock。実 key 不要。

## Error Handling

| 状況 | 挙動 |
|---|---|
| webhook 署名不正 | 400 `{code:"invalid_signature"}`、副作用なし |
| webhook 重複 (非クリティカル) | `claim()`=False → 即 return 200 |
| webhook 重複 (`invoice.paid`) | txn 内で `processed_stripe_events/{event.id}` 既存 → grant skip、200 (並行でも Firestore txn retry で exactly-once) |
| checkout: stripe_customer_id 無 | Stripe が `customer_email` で新規 customer 作成 |
| portal: stripe_customer_id 無 | 409 `{code:"no_subscription"}` |
| webhook で User 不明 | error log、200 (再送ループ防止) |
| 支払失敗 | `subscription_status='past_due'` + メール、Stripe Smart Retries に委譲 |
| クリティカル grant 中に例外 | txn がロールバック (quota も processed_event も書かれない) → endpoint で握り 200 化、未 mark なので Stripe 再送で安全に再試行 |

## Idempotency 設計 (確定)

- **`invoice.paid` (クリティカル)**: `processed_stripe_events/{event.id}` の存在チェック + quota doc 書き込みを **単一 Firestore `@fs.async_transactional`** に入れる。Firestore transaction は read-set 競合時に自動 retry するため、並行二重配信でも片方のみコミット・他方は retry で skip → **exactly-once** (親 spec の I4 契約を満たす)。これは `booking_service` の book/cancel が使う既存パターンと同型 (全 read を全 write の前に置く制約も遵守)
- **非クリティカル** (`checkout.session.completed`/`subscription.updated`/`subscription.deleted`/`payment_failed`): `claim()` = `document(event.id).create(...)` の atomic fail-if-exists で claim-first。副作用は user doc の冪等上書きのみなので、claim 後に落ちても Stripe 再送 (別配信) で再度 user doc を上書きするだけで害なし
- `MonthlyQuota` への `source_event_id` 等の追加は不要 (撤回)。exactly-once は processed_event doc が担保

## Testing (pytest + Firestore emulator + Stripe SDK mock)

Stripe SDK は `unittest.mock.patch` で mock (`stripe.checkout.Session.create`, `stripe.billing_portal.Session.create`, `stripe.Webhook.construct_event`, `stripe.Subscription.retrieve`, `stripe.Invoice` 等)。実 API 不使用、`STRIPE_SECRET_KEY=sk_test_dummy`。

`tests/services/test_stripe_service.py`:
- `create_checkout_session` が正しい params (client_reference_id=uid, subscription_data.metadata.firebase_uid, price, automatic_tax) で呼ぶ
- `create_portal_session` customer 無 → 409、有 → url
- 署名不正 → 例外
- `checkout.session.completed` → users.{uid} に stripe_customer_id/subscription_id/plan 保存、**quota 作成なし**
- `invoice.paid` (任意 billing_reason: subscription_create / subscription_cycle / subscription_update / 未知) → MonthlyQuota が 1 doc grant (granted=PLAN_QUOTA[plan], expires=add_two_months) + `processed_stripe_events/{event.id}` doc が同 txn で作成される
- `invoice.paid` 同 event.id 再送 → processed_event 既存で grant skip (exactly-once)、quota doc は 1 件のまま
- `invoice.paid` 並行二重配信シミュレーション (同 event.id を擬似的に 2 回連続処理) → quota doc は 1 件のみ
- `customer.subscription.updated` Light→Standard → `users.plan` のみ更新、**quota は grant されない** (Y)、cancel_at_period_end / current_period_end(tz-aware UTC) / status 反映
- `customer.subscription.deleted` → plan=None, status=canceled, stripe_subscription_id=None
- `invoice.payment_failed` → email_service.send_payment_failed 呼ばれ status=past_due
- 非クリティカル event 重複 (`claim()`=False) → 副作用 skip

`tests/infrastructure/repositories/test_firestore_processed_event_repository.py`:
- `claim` 初回 True、2 回目 False
- 同 event_id を 2 回 `claim`: 片方のみ True

`tests/api/test_billing_endpoints.py`:
- checkout/portal 非ログイン → 401
- checkout ログイン → `{url}`
- portal customer 無 → 409
- webhook 無署名 → 400
- webhook 署名正 → 200

`tests/services/test_email_service.py`: `send_payment_failed` の Mock 呼び出し / SMTP body 生成

`/users/me` テスト: subscription フィールドが response に含まれる

## Files

### Create
- `backend/app/services/stripe_service.py`
- `backend/app/domain/repositories/processed_event_repository.py`
- `backend/app/infrastructure/repositories/firestore_processed_event_repository.py`
- `backend/app/api/endpoints/billing.py`
- `backend/app/api/schemas/billing.py`
- `backend/tests/services/test_stripe_service.py`
- `backend/tests/infrastructure/repositories/test_firestore_processed_event_repository.py`
- `backend/tests/api/test_billing_endpoints.py`

### Modify
- `backend/app/domain/entities/user.py` (+5 fields + `update_subscription`)
- `backend/app/infrastructure/repositories/firestore_user_repository.py` (mapping)
- `backend/app/services/email_service.py` (+`send_payment_failed` on Protocol + SMTP + Mock)
- `backend/app/config.py` (Stripe Settings)
- `backend/app/api/dependencies/repositories.py` (`get_stripe_service`)
- `backend/app/api/schemas/user.py` (+subscription fields on UserResponse)
- `backend/app/api/endpoints/users.py` (`get_profile` fills subscription fields)
- `backend/app/main.py` (billing router)
- `backend/pyproject.toml` (`stripe` dependency)

## Out of Scope (4c-2)

frontend `/mypage/plan` (= 4c-3) / Stripe Dashboard 手動設定 (ops 手順、親 spec 記載) / 年額・クーポン / Stripe Connect / 請求書テンプレ

## Migration / Rollback

- 全て additive。`User` 新フィールドはデフォルト値で後方互換。`MonthlyQuota` は変更しない (4c-1 から完全独立)。既存 booking/quota フローに影響なし
- billing endpoints は新規。webhook 未登録なら呼ばれない
- rollback: billing router を外す + Stripe Dashboard の webhook 無効化。`processed_stripe_events` collection は残っても無害
- 本番投入は親 spec の ops 手順 (test mode → 本番 key、deploy 後 webhook secret 投入) に従う
