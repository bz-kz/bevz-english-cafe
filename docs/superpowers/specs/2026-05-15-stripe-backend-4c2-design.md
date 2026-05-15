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

### DI
`app/api/dependencies/` に `get_stripe_service()` を追加。`StripeService(user_repo, monthly_quota_repo, email_service, processed_event_repo, fs_client, settings)` を per-request 構築。設定は `Settings` から。

## Data model

### `User` entity 追加フィールド
```python
stripe_customer_id: str | None = None
stripe_subscription_id: str | None = None
subscription_status: str | None = None          # 'active'|'past_due'|'canceled'|None
subscription_cancel_at_period_end: bool = False
current_period_end: datetime | None = None
```
- `FirestoreUserRepository._to_dict`/`_from_dict` に 5 フィールド追加 (読み取り欠損時は上記デフォルト)
- `User.update_subscription(*, customer_id=None, subscription_id=..., status=..., cancel_at_period_end=..., current_period_end=...)` ヘルパーで一括更新 + `updated_at` 更新

### `MonthlyQuota` への `source_event_id` (4c-2 で追加)
4c-1 の `MonthlyQuota` dataclass に `source_event_id: str | None = None` を末尾追加 (デフォルト None で 4c-1 既存生成・migration と後方互換)。`FirestoreMonthlyQuotaRepository._to_dict`/`_from_dict` にマッピング追加。grant 前に「同 `user_id` かつ同 `source_event_id` の doc が既存 → skip」で `invoice.paid` 再送の重複 grant を防止 (クリティカル event の exactly-once 担保)。

> 4c-1 はマージ済前提のため、本変更は 4c-2 ブランチが 4c-1 マージ後の main から派生する。`source_event_id` 追加は additive で 4c-1 のテストを壊さない (デフォルト None)。

### `ProcessedEvent` — 新規
- collection `processed_stripe_events`、doc id = Stripe `event.id`
- body: `{ "event_type": str, "processed_at": datetime }`
- `ProcessedEventRepository` interface:
  - `mark_if_unprocessed(event_id: str, event_type: str) -> bool` — Firestore で `document(event_id).create({...})` を試み、`AlreadyExists` を捕捉。create 成功=True (初回)、衝突=False (重複)。`create()` は Firestore で「存在しなければ作成、あれば失敗」が atomic なので並行 webhook でも 1 つだけ True
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

### handle_webhook
1. `event = await asyncio.to_thread(stripe.Webhook.construct_event, raw_payload, sig_header, settings.stripe_webhook_secret)` — 失敗時 `stripe.error.SignatureVerificationError` を raise（endpoint が 400 に変換）
2. **冪等戦略 (event 種別で分岐)**:
   - **非クリティカル** (`checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`): `if not await processed_repo.mark_if_unprocessed(event.id, event.type): return` を**先**に実行 (claim-first)。これらの副作用は idempotent な上書き更新なので、claim 後に万一落ちても再送害は軽微
   - **クリティカル** (`invoice.paid` = quota grant): mark を**先にしない**。先に grant を実行し、`MonthlyQuota.source_event_id == invoice.id` の既存 doc があれば skip (exactly-once)。grant 成功後に `mark_if_unprocessed` を呼ぶ（記録目的）。grant 中に落ちたら未 mark → Stripe 再送で再試行され、source_event_id 重複チェックが二重 grant を防ぐ
3. `event.type` で dispatch:

| event.type | handler |
|---|---|
| `checkout.session.completed` | `event.data.object.client_reference_id` = uid → `user_repo.find_by_uid`。`stripe_customer_id`, `stripe_subscription_id`, `subscription_status='active'` を保存。`subscription` から price 取得 → `_plan_for_price` で `users.plan` + `plan_started_at=now`。**quota grant しない** |
| `invoice.paid` | `invoice.subscription` を retrieve (`to_thread`) し `subscription.metadata.firebase_uid` で User 特定。`invoice.billing_reason`: `subscription_create`/`subscription_cycle` → price→plan の `PLAN_QUOTA[plan]` 分の `MonthlyQuota` を `quota_repo.save` で grant（`granted_at=now`, `expires_at=add_two_months(now)`, `plan_at_grant=plan`, `source_event_id=invoice.id`; 同 user+source_event_id 既存なら skip）; `subscription_update` → **何もしない** (D3) |
| `customer.subscription.updated` | `subscription.items.data[0].price.id` → plan。`users.plan` 更新。`PLAN_QUOTA[new]-PLAN_QUOTA[old] > 0` の差分を即 grant (別 doc, `source_event_id=event.id`, 同 user+id 既存なら skip)。`cancel_at_period_end`/`current_period_end`(epoch→datetime)/`status` を `User.update_subscription` で反映 |
| `customer.subscription.deleted` | `subscription.metadata.firebase_uid` で User。`plan=None`, `subscription_status='canceled'`, `stripe_subscription_id=None` |
| `invoice.payment_failed` | User 特定 → `subscription_status='past_due'` 保存 + `email_service.send_payment_failed(user.email, user.name)` |
| その他 event.type | 無視 (200 で返す) |

User が特定できない (uid/metadata 取れない) 場合は error log し例外を投げない (endpoint は 200、Stripe 無限再送防止)。

## Endpoints (`app/api/endpoints/billing.py`)

```
POST /api/v1/billing/checkout   auth=get_current_user   body=CheckoutRequest      -> {url:str}
POST /api/v1/billing/portal     auth=get_current_user   body={}                   -> {url:str}
POST /api/v1/billing/webhook    認証なし (Stripe 署名検証)                          -> 200 {}
```

- `CheckoutRequest{ plan: Literal["light","standard","intensive"] }`、response `CheckoutResponse{ url: str }`、portal も `{url:str}`
- `webhook`: `payload = await request.body()`; `sig = request.headers.get("stripe-signature","")`; `stripe.error.SignatureVerificationError` → `HTTPException(400, {"code":"invalid_signature"})`; その他処理内例外 → log + **`return {}` (200)**（Stripe 無限再送防止。クリティカル grant 失敗は mark しないので Stripe 再送に委ねる ← 冪等戦略と整合）
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
| webhook 重複 (非クリティカル) | `mark_if_unprocessed`=False → 即 return 200 |
| webhook 重複 (`invoice.paid`) | `source_event_id` 既存 → grant skip、200 |
| checkout: stripe_customer_id 無 | Stripe が `customer_email` で新規 customer 作成 |
| portal: stripe_customer_id 無 | 409 `{code:"no_subscription"}` |
| webhook で User 不明 | error log、200 (再送ループ防止) |
| 支払失敗 | `subscription_status='past_due'` + メール、Stripe Smart Retries に委譲 |
| クリティカル grant 中に例外 | mark しない → 200 返さず例外を endpoint で握り 200 化するが、未 mark なので Stripe 再送 → source_event_id 重複防止下で再試行 |

## Idempotency trade-off (明記)

`invoice.paid` は「副作用成功 → mark」の 2-phase。grant 自体の重複防止は `MonthlyQuota.source_event_id` の存在チェック (exactly-once)。`mark_if_unprocessed` はクリティカル event では監査記録の意味合いが主。非クリティカル event は「mark-first」で dispatch 重複を防ぐ (副作用が冪等な上書きなので安全)。この非対称設計は意図的: クリティカルは「再送されても二重 grant しない」を source_event_id で保証し可用性優先、非クリティカルは「処理回数を最小化」する。

## Testing (pytest + Firestore emulator + Stripe SDK mock)

Stripe SDK は `unittest.mock.patch` で mock (`stripe.checkout.Session.create`, `stripe.billing_portal.Session.create`, `stripe.Webhook.construct_event`, `stripe.Subscription.retrieve`, `stripe.Invoice` 等)。実 API 不使用、`STRIPE_SECRET_KEY=sk_test_dummy`。

`tests/services/test_stripe_service.py`:
- `create_checkout_session` が正しい params (client_reference_id=uid, subscription_data.metadata.firebase_uid, price, automatic_tax) で呼ぶ
- `create_portal_session` customer 無 → 409、有 → url
- 署名不正 → 例外
- `checkout.session.completed` → users.{uid} に stripe_customer_id/subscription_id/plan 保存、**quota 作成なし**
- `invoice.paid` `subscription_create` → MonthlyQuota grant (granted=PLAN_QUOTA, expires=add_two_months, source_event_id=invoice.id)
- `invoice.paid` 同 invoice.id 再送 → grant skip (exactly-once)
- `invoice.paid` `subscription_update` → grant されない (D3)
- `customer.subscription.updated` Light→Standard → plan 更新 + 差分 4 grant、cancel_at_period_end 反映
- `customer.subscription.deleted` → plan=None, status=canceled
- `invoice.payment_failed` → email_service.send_payment_failed 呼ばれ status=past_due
- 非クリティカル event 重複 (`mark_if_unprocessed`=False) → 副作用 skip

`tests/infrastructure/repositories/test_firestore_processed_event_repository.py`:
- `mark_if_unprocessed` 初回 True、2 回目 False
- 並行シミュレーション (同 event_id を 2 回): 片方のみ True

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
- `backend/app/domain/entities/monthly_quota.py` (+`source_event_id`)
- `backend/app/infrastructure/repositories/firestore_monthly_quota_repository.py` (mapping + source_event_id existence query)
- `backend/app/services/email_service.py` (+`send_payment_failed` on Protocol + SMTP + Mock)
- `backend/app/config.py` (Stripe Settings)
- `backend/app/api/dependencies/` (`get_stripe_service`)
- `backend/app/api/schemas/user.py` (+subscription fields on UserResponse)
- `backend/app/api/endpoints/users.py` (`get_profile` fills subscription fields)
- `backend/app/main.py` (billing router)
- `backend/pyproject.toml` (`stripe` dependency)

## Out of Scope (4c-2)

frontend `/mypage/plan` (= 4c-3) / Stripe Dashboard 手動設定 (ops 手順、親 spec 記載) / 年額・クーポン / Stripe Connect / 請求書テンプレ

## Migration / Rollback

- 全て additive。`User`/`MonthlyQuota` 新フィールドはデフォルト値で後方互換。既存 booking/quota フローに影響なし
- billing endpoints は新規。webhook 未登録なら呼ばれない
- rollback: billing router を外す + Stripe Dashboard の webhook 無効化。`MonthlyQuota.source_event_id` は残っても無害 (None デフォルト)
- 本番投入は親 spec の ops 手順 (test mode → 本番 key、deploy 後 webhook secret 投入) に従う
