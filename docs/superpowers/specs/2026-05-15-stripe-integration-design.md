# Stripe Integration (PR 4c) Design — v2 (decomposed)

## Goal

ユーザーが Stripe Checkout で月額サブスク (Light/Standard/Intensive) を購入し、Stripe webhook 駆動で `monthly_quota` を付与する。プラン変更・解約・支払方法更新は Stripe Customer Portal に集約する。

## Why decomposed

独立レビュー (2026-05-15) で、quota モデル変更が既存の money-adjacent transaction (booking_service の book/cancel/admin_force_*) の書き換えを伴い、Stripe 新規コードと結合すると rollback 不能になることが判明。**3 つの独立 sub-project に分割**する。各 sub-project は単体で動作・テスト可能。

| Sub-project | 内容 | 依存 | リスク |
|---|---|---|---|
| **4c-1** | MonthlyQuota multi-doc + FIFO 化 + 4b cron 整合 + migration | なし (先行) | 高 |
| **4c-2** | StripeService + webhook + billing endpoints | 4c-1 | 中 |
| **4c-3** | frontend `/mypage/plan` + Customer Portal 導線 | 4c-2 | 低 |

実装順: 4c-1 → 4c-2 → 4c-3。本ドキュメントは 4c-1 を完全仕様化し、4c-2/4c-3 はインターフェース境界のみ定義 (詳細は各 sub-project の spec で別途)。

## Settled Requirements (全 sub-project 共通)

| # | 項目 | 決定 |
|---|---|---|
| Q1 | 価格 | Light ¥6,000 / Standard ¥10,000 / Intensive ¥15,000 (税抜) |
| Q2 | 消費税 | Stripe Tax 有効化 (10% 自動加算) |
| Q3 | 課金サイクル | 加入日基準の月額 |
| Q4 | quota grant | webhook `invoice.paid` 駆動 + 加入時即時 + 有効期限 2 ヶ月 + FIFO 消費。1 日 cron は admin プラン用に存続 (新スキームに移行) |
| Q5 | プラン変更 | proration + 即時切替 + 差分 quota grant |
| Q6 | 解約 | 期間末解約、返金なし |
| Q7 | Customer Portal | Stripe Portal 使用 |
| Q8 | trial period | なし |
| Q9 | 支払失敗 | Smart Retries + メール通知 |
| Q10 | 加入 flow | Firebase login → mypage プラン選択 → Checkout |
| Q11 | user↔customer 紐付け | `client_reference_id=uid` + `subscription.metadata.firebase_uid=uid` + `users.{uid}.stripe_customer_id` |
| D1 | スコープ | 3 PR 分割 |
| D2 | doc-id 整合 | 4b cron を新スキームに移行 (reader 1 系統) |
| D3 | 二重付与 | `invoice.paid` は `billing_reason==subscription_update` 時 skip。`subscription.updated` が差分 grant |
| D4 | migration | backfill script で旧 quota 変換。pre-4c booking (consumed_quota_doc_id 無) の cancel は quota refund 諦め |

---

# Sub-project 4c-1 — Quota Model: multi-doc + FIFO + 2-month expiry

## 目的

`monthly_quota` を「1 ユーザー 1 月 1 doc」から「1 ユーザー複数 doc・各 doc 2 ヶ月有効・FIFO 消費」に変更する。Stripe を一切含まない。完了時点で既存の admin 手動プラン + 4b cron が新モデルで動作する。

## 現状 (4b) の把握

- `MonthlyQuota` dataclass: `user_id, year_month, plan_at_grant, granted, used, granted_at, expires_at` + `__post_init__` で `0 <= used <= granted`
- `FirestoreMonthlyQuotaRepository._doc_id = f"{user_id}_{year_month}"` (1 月 1 doc)
- `booking_service.py`: `book` / `cancel` / `admin_force_book` / `admin_force_cancel` が `f"{uid}_{_jst_year_month(...)}"` で単一 doc を read/update
- `monthly-quota-grant` Cloud Function (terraform `cloud-function-monthly-quota-grant`): 毎月 1 日 0:00 JST、対象ユーザーに `{uid}_{YYYY-MM}` doc を作成

## 設計

### MonthlyQuota entity (フィールド維持・意味変更)

`year_month` は廃止せず **grant 月の JST 表記 (監査・表示用メタ)** として保持。一意キーは doc id に移譲。`__post_init__` 制約はそのまま。

### doc-id スキーム

新: `{uid}_{granted_at:%Y%m%d%H%M%S%f}` (マイクロ秒まで含め衝突回避)。`FirestoreMonthlyQuotaRepository`:
- `save(quota)` → 新 doc-id で set
- `find(user_id, year_month)` (既存 API) は **deprecated**、内部利用箇所を `find_active_for_user` に置換後に削除
- 新 `find_active_for_user(user_id: str, at: datetime) -> list[MonthlyQuota]`:
  - query は `where("user_id", "==", uid)` の **単一等価フィルタのみ** (C3 回避: 複合 index 不要)
  - 取得後 Python 側で `expires_at > at AND used < granted` を filter
  - `granted_at` ASC sort (FIFO)
  - 1 ユーザーの quota doc は高々数件なので全件取得で問題なし
- 新 `find_by_doc_id(doc_id: str) -> MonthlyQuota | None` (cancel の refund 用)

### expires_at 計算

`granted_at` の 2 ヶ月後・同日・同時刻。月末日跨ぎは標準ライブラリのみで実装 (dateutil 追加しない):

```python
def add_two_months(dt: datetime) -> datetime:
    month = dt.month - 1 + 2
    year = dt.year + month // 12
    month = month % 12 + 1
    # 翌々月に day が無ければ月末へ丸め (1/31 -> 3/31, 12/31 -> 2/28|29)
    import calendar
    day = min(dt.day, calendar.monthrange(year, month)[1])
    return dt.replace(year=year, month=month, day=day)
```

### `Booking` entity 追加

```python
consumed_quota_doc_id: str | None = None  # FIFO で減算した quota doc。trial / pre-4c は None
```

`FirestoreBookingRepository._to_dict`/`_from_dict` にマッピング追加 (欠損時 None)。

### `BookingService` FIFO 改修 (4 メソッド)

`book` (非 trial) transaction:
1. **read phase**: `find_active_for_user(uid, now)` を transaction 外で事前取得は不可 (整合性) → transaction 内で `users` 等価 query を stream。Firestore async txn は collection query read を許容。取得 docs を granted_at ASC、`used < granted` filter
2. 該当無し → doc が 1 件も無ければ `NoActiveQuotaError`、全て exhausted なら `QuotaExhaustedError`
3. 最古 doc を選択し doc-id を確定
4. **write phase**: 当該 doc を `used += 1`、booking に `consumed_quota_doc_id` セット

`cancel` / `admin_force_cancel`:
- `booking.consumed_quota_doc_id` が非 None → `find_by_doc_id` で読んで `used = max(0, used-1)`
- None (trial / pre-4c) → quota refund skip (trial は従来の `trial_used` ロールバックのみ)

`admin_force_book` (`consume_quota=True`, 非 trial): 上記 FIFO と同一パス。active doc 皆無なら warning log + skip (4d 既存挙動踏襲、booking 自体は成功)。

### 4b Cloud Function 移行 (D2=a)

`terraform/modules/cloud-function-monthly-quota-grant/source/main.py` を改修:
- doc-id を `{uid}_{granted_at:%Y%m%d%H%M%S%f}` に
- `expires_at = add_two_months(granted_at)` (同ロジックを関数内に複製 — Cloud Function は backend を import しない)
- `year_month` は grant 実行時の JST 月
- 冪等性: 「同一ユーザーで今月 grant 済みなら skip」を `granted_at` の JST 月一致で判定 (旧: doc 存在チェック)

### Migration script (D4=a)

`scripts/migrate_quota_to_multidoc.py`:
- 既存 `{uid}_{YYYY-MM}` パターンの doc を走査
- 各々 `granted_at = year_month の 1 日 0:00 JST`、`expires_at = add_two_months(granted_at)` で新 doc-id に複製
- 旧 doc は削除 (--dry-run で確認可)
- pre-4c の booking は `consumed_quota_doc_id` を後付けしない (cancel refund は諦め: 本番未ローンチで件数僅少)

### `/users/me` quota 表示改修 (I3)

`api/endpoints/users.py` の `/users/me`:
- 旧 `current_month_quota: MonthQuotaSummary | null` を廃止
- 新 `quota_summary: { total_remaining: int, next_expiry: datetime | null }`
  - `find_active_for_user(uid, now)` を集計、`total_remaining = Σ(granted-used)`、`next_expiry = min(expires_at)`
- frontend `booking.ts` `MeResponse` + `ProfileCard.tsx` を新フィールドに追従 (4c-1 スコープ内、frontend も触る)

## 4c-1 Testing

`tests/services/test_booking_service.py` 拡張:
- 複数 active doc 合算で残数判定
- FIFO: 最古 doc から `used+1`、`booking.consumed_quota_doc_id` 記録
- 期限切れ doc は残数に数えない
- cancel が `consumed_quota_doc_id` の doc を refund
- pre-4c booking (consumed_quota_doc_id=None) cancel は refund skip・例外なし
- admin_force_book consume_quota で FIFO 経路 / 該当無しで warning skip

`tests/infrastructure/repositories/test_firestore_monthly_quota_repository.py` 拡張:
- `find_active_for_user` が expired / exhausted を除外し granted_at ASC
- `find_by_doc_id`
- `add_two_months` 単体 (1/31→3/31, 12/31→2/28, 通常)

`terraform/modules/cloud-function-monthly-quota-grant/source/test_main.py` 拡張:
- 新 doc-id・expires_at
- 同月二重実行で skip

migration script: `scripts/` に簡易テスト or `--dry-run` 手動検証手順を README 化。

frontend: `ProfileCard` テストを新 `quota_summary` 形に更新。

## 4c-1 Migration / Rollback

- backfill script は冪等 (旧 doc 削除前に新 doc 作成、--dry-run あり)
- rollback: 4c-1 は feature flag 無し。問題時は git revert + 逆 migration (新→旧) script が必要 → **本番 quota データが少ない段階で投入する** ことを ops 前提とする
- 4b cron 改修と migration script は同一 PR 内 (中途半端な doc-id 混在を残さない)

---

# Sub-project 4c-2 — Stripe Backend (interface only here)

詳細仕様は 4c-2 着手時に別 spec。境界のみ確定:

- `StripeService` (`app/services/stripe_service.py`): `create_checkout_session`, `create_portal_session`, `handle_webhook`
- 依存: `UserRepository`, `MonthlyQuotaRepository` (4c-1 の `save` を使い grant), `EmailService`, `ProcessedEventRepository` (新規・I4 対応)
- endpoints `app/api/endpoints/billing.py`: `POST /billing/checkout`, `POST /billing/portal`, `POST /billing/webhook`
- `User` entity 追加: `stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, `subscription_cancel_at_period_end`, `current_period_end`
- webhook idempotency (I4): `ProcessedEventRepository.create_if_absent(event_id)` を **Firestore transaction で create (既存なら例外) → 副作用** を 1 トランザクション化。並行配信で二重 grant しない
- 二重付与回避 (D3): `invoice.paid` handler は `invoice.billing_reason == "subscription_update"` の時 grant skip。`customer.subscription.updated` が `PLAN_QUOTA[new]-PLAN_QUOTA[old]>0` の差分を 4c-1 の `MonthlyQuotaRepository.save` で grant
- quota grant は必ず 4c-1 の `save` (新 doc-id) を経由 — 4c-2 は doc-id スキームを知らない
- env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_LIGHT|STANDARD|INTENSIVE` (HCP sensitive)
- Stripe SDK は test で mock。実 key 不要

---

# Sub-project 4c-3 — Frontend Plan UI (interface only here)

詳細仕様は 4c-3 着手時に別 spec。境界のみ:

- `/mypage/plan` ページ: 未加入=3 プラン self-checkout、加入済=現状表示 + Stripe Portal ボタン (プラン変更/解約は Portal 集約)
- `frontend/src/lib/billing.ts`: `createCheckout(plan)`, `createPortal()`
- `NEXT_PUBLIC_STRIPE_ENABLED` feature flag で UI gate
- `?status=success` で getMe 再取得 + トースト
- ProfileCard / nav 導線追加 (4c-1 で `quota_summary` 化済の上に積む)

---

## Stripe Dashboard 手動設定 (terraform 化しない・4c-2 着手前)

| 項目 | 設定 |
|---|---|
| Products | `light`, `standard`, `intensive` |
| Prices | Recurring monthly JPY 税抜 6,000 / 10,000 / 15,000 |
| Tax | Stripe Tax 有効化 + Japan registration |
| Customer Portal | payment method / cancel(period end) / plan switch / invoice |
| Webhook | `https://api.bz-kz.com/api/v1/billing/webhook`、events: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted` |

## Out of Scope (全体)

年額プラン / クーポン / 1user複数sub / Stripe Connect / invoice テンプレ / proration の厳密日割り quota (full grant 簡略化) / pre-4c booking の quota refund 救済
