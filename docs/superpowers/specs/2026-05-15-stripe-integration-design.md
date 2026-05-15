# Stripe Integration (PR 4c) Design

## Goal

ユーザーが Stripe Checkout で月額サブスクリプション (Light / Standard / Intensive) を購入し、Stripe webhook 駆動で `monthly_quota` を付与する。プラン変更・解約・支払方法更新は Stripe Customer Portal に集約する。

## Motivation

sub-project 4b で plan + monthly_quota の仕組みは実装済みだが、quota は admin が手動 (script) で付与するしかない。実際の課金 → 自動 quota 付与のループを Stripe で閉じる。

## Settled Requirements

| # | 項目 | 決定 |
|---|---|---|
| Q1 | 価格 | Light ¥6,000 / Standard ¥10,000 / Intensive ¥15,000 (税抜) |
| Q2 | 消費税 | Stripe Tax 有効化 (10% 自動加算, JP インボイス対応) |
| Q3 | 課金サイクル | 加入日基準の月額 (Stripe デフォルト) |
| Q4 | quota grant | Stripe webhook `invoice.paid` 駆動 + 加入時即時 + 有効期限 2 ヶ月 + FIFO 消費。毎月 1 日 cron は admin 手動プラン用に残す |
| Q5 | プラン変更 | proration (日割り) + 即時切替 + 差分 quota grant |
| Q6 | 解約 | 期間末解約 (`cancel_at_period_end`)、返金なし |
| Q7 | Customer Portal | Stripe Portal 使用 (支払方法/解約/プラン変更/請求書) |
| Q8 | trial period | なし (加入即課金) |
| Q9 | 支払失敗 | Stripe Smart Retries + ユーザーへメール通知 (失敗時 / 最終 cancel 時) |
| Q10 | 加入 flow | Firebase login → mypage プラン選択 → Checkout |
| Q11 | user↔customer 紐付け | `client_reference_id = uid` + `users.{uid}.stripe_customer_id` 保存 |

## Architecture

### Approach

**Stripe Python SDK 直接統合**。`StripeService` が Checkout / Portal session 作成と webhook dispatch を担う。Firebase Extension (`firestore-stripe-payments`) は Firestore Native + 自前 backend と相性が悪いため不採用。

### Data flow

```
User (Firebase logged in)
  │  mypage プラン選択
  ▼
Frontend POST /api/v1/billing/checkout { plan }
  │  StripeService.create_checkout_session (mode=subscription, automatic_tax, client_reference_id=uid)
  ▼
Stripe Checkout (hosted)
  │  payment success → redirect /mypage/plan?status=success
  │  ──────────────────────────────────────────────► Stripe Webhook
  ▼                                                          │
                                          POST /api/v1/billing/webhook
                                                  │ signature verify
                                                  │ idempotency check (processed_stripe_events)
                                                  ▼
                                          dispatch by event.type:
                                          - checkout.session.completed → save stripe_customer_id / subscription_id
                                          - invoice.paid               → grant MonthlyQuota (+2mo expiry)
                                          - customer.subscription.updated → users.plan 更新 + 差分 quota grant
                                          - customer.subscription.deleted → users.plan = null
                                          - invoice.payment_failed     → email 通知
```

### Stripe Dashboard 手動設定 (terraform 化しない)

| 項目 | 設定 |
|---|---|
| Products | `light`, `standard`, `intensive` |
| Prices | 各 product に Recurring monthly (JPY 税抜 6,000 / 10,000 / 15,000) |
| Tax | Stripe Tax 有効化、Japan registration |
| Customer Portal | 有効化: payment method update / cancel (period end) / plan switch / invoice history |
| Webhook endpoint | `https://api.bz-kz.com/api/v1/billing/webhook` |
| Webhook events | `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted` |

### Environment variables

| Var | Scope | 値 | 管理 |
|---|---|---|---|
| `STRIPE_SECRET_KEY` | backend | `sk_live_...` / `sk_test_...` | HCP workspace sensitive var → Cloud Run env |
| `STRIPE_WEBHOOK_SECRET` | backend | `whsec_...` | 同上 (deploy 後に投入) |
| `STRIPE_PRICE_LIGHT` | backend | `price_...` | HCP var |
| `STRIPE_PRICE_STANDARD` | backend | `price_...` | HCP var |
| `STRIPE_PRICE_INTENSIVE` | backend | `price_...` | HCP var |
| `NEXT_PUBLIC_STRIPE_ENABLED` | frontend | `true` | Vercel env (HCP `env_vars`) — UI feature flag |

ローカル test は `STRIPE_SECRET_KEY=sk_test_dummy` + SDK mock。実 key 不要。

## Backend Changes

### `User` entity 追加フィールド

```python
stripe_customer_id: str | None = None
stripe_subscription_id: str | None = None
subscription_status: str | None = None  # 'active' | 'past_due' | 'canceled' | None
subscription_cancel_at_period_end: bool = False
current_period_end: datetime | None = None
```

`FirestoreUserRepository._to_dict` / `_from_dict` に上記をマッピング追加。

### `MonthlyQuota` の複数 doc + FIFO

既存 `MonthlyQuota` (user_id, year_month, plan_at_grant, granted, used, granted_at, expires_at) を維持。変更点:

- `expires_at` = granted_at の 2 ヶ月後の同日 (例: 5/15 grant → 7/15 00:00 JST に失効)。月末日跨ぎは `dateutil.relativedelta(months=2)` 相当のロジックで算出 (5/31 → 7/31, 12/31 → 翌2/28)
- doc id を `{uid}_{granted_at:%Y%m%d%H%M%S}` に変更し、1 ユーザーが複数 active doc を持てる
- 新 query: `FirestoreMonthlyQuotaRepository.find_active_for_user(user_id: str, at: datetime) -> list[MonthlyQuota]`
  - 条件: `user_id == uid AND expires_at > at`
  - 残数 > 0 (used < granted) を Python 側でフィルタ
  - `granted_at` ASC ソート (FIFO)

### `Booking` entity 追加フィールド

```python
consumed_quota_doc_id: str | None = None  # どの MonthlyQuota から 1 コマ引いたか (trial は None)
```

`FirestoreBookingRepository` の dict マッピングに追加。

### `BookingService.book` FIFO 改修

非 trial 予約 transaction 内:
1. `find_active_for_user(uid, now)` で active quota docs 取得 (read phase)
2. 残数合計 0 → `QuotaExhaustedError`、doc が 1 件も無い → `NoActiveQuotaError`
3. 最古 (granted_at 最小) の残ありの doc を選択
4. write phase で当該 quota doc `used += 1`、booking に `consumed_quota_doc_id` を記録

`admin_force_book` の `consume_quota=True` も同じ FIFO パスを通す。quota doc が 1 件も無い場合は warning log + skip (4d 既存仕様)。

### `BookingService.cancel` / `admin_force_cancel` refund 改修

`booking.consumed_quota_doc_id` が非 None なら当該 doc を `used = max(0, used - 1)`。trial は従来通り `users.trial_used` ロールバック (admin force-cancel `refund_trial`)。`consumed_quota_doc_id` が None (古いデータ / trial) の場合は quota refund skip。

### 新サービス `StripeService`

`app/services/stripe_service.py`:

```python
class StripeService:
    def __init__(self, *, secret_key, webhook_secret, price_map: dict[Plan, str],
                 user_repo, quota_repo, email_service, fs_client): ...

    async def create_checkout_session(self, *, user: User, plan: Plan) -> str
    async def create_portal_session(self, *, user: User) -> str
    async def handle_webhook(self, *, raw_payload: bytes, sig_header: str) -> None
```

- `create_checkout_session`: `stripe.checkout.Session.create(mode="subscription", line_items=[{price, quantity:1}], client_reference_id=user.uid, subscription_data={"metadata": {"firebase_uid": user.uid}}, customer=user.stripe_customer_id or None, customer_email=user.email if no customer, automatic_tax={"enabled": True}, success_url, cancel_url)` → returns `session.url`
  - `subscription_data.metadata.firebase_uid` を必ず設定する。これにより後続の全 invoice/subscription event で `subscription.metadata.firebase_uid` から uid を引ける (webhook 配信順序に依存しない)
- `create_portal_session`: `stripe.billing_portal.Session.create(customer=user.stripe_customer_id, return_url)` → returns `session.url`。stripe_customer_id 無ければ `HTTPException 409`
- `handle_webhook`:
  1. `stripe.Webhook.construct_event(payload, sig_header, webhook_secret)` — 失敗時 raise → endpoint が 400
  2. idempotency: `processed_stripe_events/{event.id}` doc 存在チェック、あれば return。無ければ処理後に記録
  3. `event.type` で dispatch:

| event.type | handler 動作 |
|---|---|
| `checkout.session.completed` | `client_reference_id`=uid で User 取得、`stripe_customer_id` / `stripe_subscription_id` / `subscription_status='active'` を保存。plan を price→Plan 逆引きして `users.plan` / `plan_started_at` set |
| `invoice.paid` | `subscription.metadata.firebase_uid` で User 特定 (event 順序非依存)。subscription の price から plan 判定 → `PLAN_QUOTA[plan]` 分の MonthlyQuota 新規作成 (granted_at=now, expires_at=now+2mo, plan_at_grant=plan)。`billing_reason` が `subscription_update` (proration) の場合も full grant (簡略化) |
| `customer.subscription.updated` | price→plan 逆引き。`users.plan` 更新。旧 plan より上位なら差分 `PLAN_QUOTA[new]-PLAN_QUOTA[old]` を即 grant (正のときのみ、別 MonthlyQuota doc)。`cancel_at_period_end` / `current_period_end` / `status` を User に反映 |
| `customer.subscription.deleted` | `users.plan=null`, `subscription_status='canceled'`, `stripe_subscription_id=null` |
| `invoice.payment_failed` | `subscription_status='past_due'` set + `EmailService` で支払失敗通知メール。Stripe Smart Retries が最終失敗 → `customer.subscription.deleted` が別途飛ぶ |

price→Plan 逆引きは env の `STRIPE_PRICE_*` から構築した `dict[str, Plan]`。

### 新 endpoints `app/api/endpoints/billing.py`

```
POST /api/v1/billing/checkout   auth=get_current_user  body={plan}      -> {url}
POST /api/v1/billing/portal     auth=get_current_user  body={}          -> {url}
POST /api/v1/billing/webhook    認証なし (Stripe 署名で検証)            -> 200 {}
```

`/users/me` (既存) のレスポンスに subscription フィールド (`stripe_subscription_id`, `subscription_status`, `subscription_cancel_at_period_end`, `current_period_end`) を追加。

`webhook` endpoint は raw body が必要 (`await request.body()`)。CORS 対象外 (Stripe からのサーバ間 POST)。

### Idempotency collection

`processed_stripe_events/{event_id}` — `{ "processed_at": datetime }`。webhook 二重配信を防ぐ。

## Frontend Changes

### 新規ページ `/mypage/plan`

| File | 役割 |
|---|---|
| `frontend/src/app/mypage/plan/page.tsx` | プランページ (client component) |
| `frontend/src/app/mypage/plan/_components/PlanCard.tsx` | 1 プラン表示 + 選択ボタン |
| `frontend/src/app/mypage/plan/_components/SubscriptionStatus.tsx` | 現契約状況 + Portal ボタン |
| `frontend/src/lib/billing.ts` | `createCheckout(plan)`, `createPortal()`, 型 |

挙動:
- 未加入: 3 プランカードに `[選択]` → `POST /billing/checkout` → `window.location = url`
- 加入済: 現プランは「現在」表示。プラン変更/解約は `[支払い・解約を管理]` → `POST /billing/portal` → Portal へ redirect (自前のプラン変更ロジックは持たない)
- `?status=success` クエリ時: 「ご登録ありがとうございます」トースト + `getMe()` 再取得

### 既存変更

- `frontend/src/lib/booking.ts` `MeResponse` に subscription フィールド追加
- `frontend/src/app/mypage/_components/ProfileCard.tsx` に「プラン管理」リンク (`/mypage/plan`)
- mypage ナビに導線追加
- `NEXT_PUBLIC_STRIPE_ENABLED !== 'true'` の時はプラン UI 非表示 (feature flag)

## Error Handling

| 状況 | 挙動 |
|---|---|
| webhook 署名不正 | endpoint 400、処理しない |
| webhook 重複 event | idempotency で skip、200 返す |
| checkout で stripe_customer_id 未設定 | Stripe が新規 customer 作成 (customer_email 渡す) |
| portal で stripe_customer_id 無し | 409 + フロントは「まだ加入していません」表示 |
| `invoice.paid` で user 不明 (subscription.metadata.firebase_uid 取れない) | error log、200 返す (Stripe 再送ループ防止) |
| 支払失敗 | `subscription_status='past_due'` + メール、Stripe retry に委譲 |

## Testing

### Backend (pytest + Firestore emulator + Stripe SDK mock)

`tests/services/test_stripe_service.py`:
- `create_checkout_session` が正しい params (client_reference_id, price, automatic_tax) で `stripe.checkout.Session.create` 呼ぶ
- webhook signature 不正 → 例外
- `checkout.session.completed` → users.{uid} に stripe_customer_id / subscription_id / plan 保存
- `invoice.paid` → MonthlyQuota 作成 (granted=PLAN_QUOTA, expires=+2mo)
- `invoice.paid` 重複 event id → idempotent skip
- `customer.subscription.updated` Light→Standard → plan 更新 + 差分 4 quota grant
- `customer.subscription.updated` `cancel_at_period_end=true` → User フラグ反映
- `customer.subscription.deleted` → plan=null
- `invoice.payment_failed` → EmailService 呼ばれる + status=past_due

`tests/services/test_booking_service.py` 拡張:
- 複数 active quota の合算で残数判定
- FIFO: 最古 doc から used+1、booking.consumed_quota_doc_id 記録
- cancel が consumed_quota_doc_id の doc を refund
- 期限切れ quota は残数に数えない

`tests/api/test_billing_endpoints.py`:
- checkout/portal 非ログイン → 401
- checkout がログイン時 url 返す
- webhook 無署名 → 400
- webhook 正常 → 200

### Frontend (jest + RTL)

- `billing.ts` export テスト
- `PlanCard` — 現プランは選択不可表示、他は `[選択]` ボタン
- `SubscriptionStatus` — active / past_due / 解約予定 の表示分岐
- `mypage/plan/page` smoke (feature flag false で非表示)

## Out of Scope

- 年額プラン (月額のみ)
- クーポン / プロモコード
- 1 user 複数サブスク (1 plan 前提)
- Stripe Connect / マルチテナント
- 請求書テンプレートカスタマイズ (Stripe デフォルト invoice)
- proration 時の厳密な日割り quota (簡略化: full grant)

## Migration / Rollback

- 全て新規追加。既存予約フローへの影響は MonthlyQuota FIFO 改修のみ
- FIFO 改修は単一 doc でも動作 (後方互換)
- `NEXT_PUBLIC_STRIPE_ENABLED=false` で UI 非表示 → feature flag rollback
- webhook 障害時: Stripe 自動 retry (最大 3 日) + `processed_stripe_events` で重複防御
- `monthly-quota-grant` Cloud Function (4b) は削除せず admin 手動プラン用に存続

## Ops 手順 (本番投入)

1. Stripe Dashboard: Product / Price / Tax / Customer Portal 設定 (test mode 先行)
2. HCP workspace `english-cafe-prod-cloudrun` に `STRIPE_SECRET_KEY` / `STRIPE_PRICE_*` (sensitive) 投入
3. backend deploy
4. Stripe Dashboard で webhook endpoint (`https://api.bz-kz.com/api/v1/billing/webhook`) 登録 → `STRIPE_WEBHOOK_SECRET` 取得 → HCP 投入 → 再 deploy
5. Vercel に `NEXT_PUBLIC_STRIPE_ENABLED=true` 投入 → frontend deploy
6. test mode で E2E (テストカード `4242...`) → 本番 key に切替
