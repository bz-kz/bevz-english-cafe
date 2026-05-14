# Sub-project 4b: 月次 quota + 24h キャンセル規則 + trial カウンタ Design

## Goal

ユーザーごとに月次でコマを付与・消費する仕組みと、当日キャンセル不可ルール、trial の生涯1回管理を導入する。Stripe 連動 (4c) の前提となる土台。

## Non-goals

- Stripe サブスクリプション課金 / webhook (= 4c)
- プランの自動アップグレード/ダウングレード
- コマの繰越 (期限切れで消滅)
- 追加コマ購入

---

## Plan & quota rules (確定済)

| プラン | 月次付与コマ |
|---|---|
| `light` | 4 |
| `standard` | 8 |
| `intensive` | 16 |
| `null` (未契約) | 0 |

- **付与タイミング**: 毎月1日 0:00 JST (Cloud Scheduler)
- **失効**: 毎月末 23:59 JST (繰越なし、次月初の付与で前月分は無視)
- **月の帰属**: **予約時点の JST 月** から消費 (= 5/31 に 6/3 のコマを予約すると 5月のコマ消費)
- **trial** (`lesson_type=trial`): コマを消費しない。`users/{uid}.trial_used` の boolean 1回フラグで管理。`true` なら trial 予約不可。
- **コマ不足**: 単純に予約 API が 409 Conflict、UI でエラー表示

## Cancellation rules (確定済)

| 状況 | キャンセル可否 | コマ返却 |
|---|---|---|
| 開始 24h 以上前 | 可 | する |
| 開始 24h 未満 (当日含む直前) | **不可** (= API 拒否) | 消費維持 |
| 既にキャンセル済 (idempotent) | 可 (no-op) | しない |
| trial の予約 | 24h ルールは同じ。ただしコマ返却対象外 (trial はそもそも quota 非消費) |

## プラン割当方法

- **4b 時点**: admin が手動で `users/{uid}.plan` を set する CLI ツール (`scripts/set_plan.py`)
- **4c 以降**: Stripe webhook が自動で set (この PR では用意しない)

---

## Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                     New Data Model                                  │
└────────────────────────────────────────────────────────────────────┘

users/{uid}                                    (existing collection)
  +plan: 'light' | 'standard' | 'intensive' | null   ← NEW
  +plan_started_at: timestamp                          ← NEW
  +trial_used: bool = false                            ← NEW

monthly_quota/{uid}_{YYYY-MM}                  (NEW collection)
  user_id: string
  year_month: string ('2026-05')
  plan_at_grant: string  # snapshot of plan at grant time
  granted: int
  used: int             # incremented on book(), decremented on >=24h cancel
  granted_at: timestamp
  expires_at: timestamp # last day of month + 1d (24:00 JST)

┌────────────────────────────────────────────────────────────────────┐
│                Cloud Scheduler: monthly grant                       │
└────────────────────────────────────────────────────────────────────┘
        Cron `0 0 1 * *` Asia/Tokyo (毎月1日 0:00 JST)
              │
              ▼ Pub/Sub
   ┌─────────────────────────────────────────┐
   │ Cloud Function: grant_monthly_quota     │
   │  ────────────────────────────────────── │
   │  for user in users where plan != null:  │
   │    if monthly_quota/{uid}_{YYYY-MM}     │
   │       does not exist:                   │
   │      create granted=PLAN_QUOTA[plan]    │
   │                used=0                   │
   │                expires=月末24:00 JST    │
   └─────────────────────────────────────────┘
```

## API changes

### `POST /api/v1/bookings` (book)
既存挙動 + 以下追加:
1. **trial check**: 予約しようとしている slot の `lesson_type=='trial'` の場合、`users/{user.uid}.trial_used` を確認。`true` なら 409 `TrialAlreadyUsed`. `false` なら予約成功時に `trial_used=true` をセット (同一トランザクション内)。
2. **quota check** (lesson_type が trial 以外): 予約時点の JST 月 `YYYY-MM` を計算し、`monthly_quota/{uid}_{YYYY-MM}` をトランザクション内で読む:
   - レコード無し → 409 `NoActiveQuota` (プラン未設定 or grant 未実行)
   - `granted - used <= 0` → 409 `QuotaExhausted`
   - 残あり → `used += 1` を同一トランザクション内で書き、予約も commit

### `PATCH /api/v1/bookings/{id}/cancel` (cancel)
既存挙動 + 以下追加:
1. **24h check**: `slot.start_at - now()` < 24h なら 409 `CancelDeadlinePassed`。コマ消費は維持 (no quota mutation)
2. **quota refund**: 24h 以上 + trial 以外なら、予約時に消費した `monthly_quota` の `used` を `-= 1`。月の帰属は **予約時の `created_at`** から逆算 (じゃないと月をまたいだ予約の返却先がズレる)

### `GET /api/v1/users/me` (extend response)
既存 + 以下追加:
- `plan: 'light' | 'standard' | 'intensive' | null`
- `trial_used: bool`
- `current_month_quota: { granted, used, remaining }` (現月のみ、サマリ用)

## Frontend changes

### `/mypage`
- プラン名表示 (「スタンダードプラン」など)
- 「今月のコマ: 5 / 8 残り」のような表示
- trial 未使用なら「無料体験予約あり」バッジ

### `/book` (BookingGrid)
- ログイン中 + プラン未契約: ○ クリック時に dialog で「プラン契約が必要」案内 → /pricing or /settings
- ログイン中 + コマ残 0: ○ クリック時に「今月のコマを使い切りました」案内
- 当日コマ (start_at < now+24h): ○ ではなく ▲ (グレー、クリック可だがツールチップで「キャンセル不可枠」と明示)

### `/mypage` キャンセルボタン
- `slot.start_at < now+24h` の予約のキャンセルボタンを disable + ツールチップ「24時間以内はキャンセル不可」

## scripts/set_plan.py (新規)

```
uv run python scripts/set_plan.py <uid> --plan light|standard|intensive|null
```

- `users/{uid}.plan` と `plan_started_at` を上書き
- `null` を指定すると plan + plan_started_at を None にセット
- **付与は別 step**: 設定直後に当月の monthly_quota が無ければ手動で `--grant-now` フラグで作成 (またはユーザーが翌月1日まで待つ)

## Cloud Scheduler / Function (新規)

新しい terraform module `terraform/modules/cloud-function-monthly-quota-grant/`:
- 構造は `cloud-function-slot-generator/` をミラー
- Cron: `0 0 1 * *` TZ `Asia/Tokyo`
- Function: `grant_monthly_quota` (Python 3.12)
  - 全ユーザー `users` collection を walk
  - `plan != null` のユーザーに対し、`monthly_quota/{uid}_{YYYY-MM}` が無ければ作成
- IAM: `roles/datastore.user`
- 新 HCP workspace `english-cafe-prod-monthly-quota`

## Data backfill (一回限り)

`scripts/backfill_monthly_quota.py`:
- `--month YYYY-MM` でその月の全アクティブプランユーザーに quota を即時付与
- リリース当月の手動 backfill 用 (次月以降は Cloud Scheduler 任せ)

---

## Tests

### Backend
- `tests/services/test_booking_service.py`:
  - book: trial 1回目 → 成功 + trial_used=true
  - book: trial 2回目 → TrialAlreadyUsed
  - book: quota 残あり → 成功 + used+=1
  - book: quota レコード無し → NoActiveQuota
  - book: 残 0 → QuotaExhausted
  - cancel: 24h以上前 + quota 返却
  - cancel: 24h未満 → CancelDeadlinePassed (quota 消費維持)
  - cancel: trial → 24h ルールのみ、quota 触らない
  - 月跨ぎ予約: 5/31 に 6/3 のコマを予約 → 5月の quota から消費
- `tests/infrastructure/repositories/test_firestore_monthly_quota_repository.py`:
  - find_for_user_month, create
- Cloud Function unit tests (mocked Firestore client)

### Frontend
- /mypage で plan + quota 表示
- /book で プラン未契約 / quota 0 / 24h以内 の 3 状態クリック挙動

---

## Critical Files

### Backend
- `backend/app/services/booking_service.py` — book/cancel に quota/trial/24h ロジック追加
- `backend/app/domain/entities/user.py` — `plan`, `plan_started_at`, `trial_used` フィールド
- 新規 `backend/app/domain/entities/monthly_quota.py`
- 新規 `backend/app/domain/repositories/monthly_quota_repository.py`
- 新規 `backend/app/infrastructure/repositories/firestore_monthly_quota_repository.py`
- `backend/app/services/booking_errors.py` — `TrialAlreadyUsed`, `NoActiveQuota`, `QuotaExhausted`, `CancelDeadlinePassed`
- `backend/app/api/endpoints/bookings.py` — 新エラーの HTTP マッピング
- `backend/app/api/endpoints/users.py` — `/users/me` 拡張

### Infra
- 新規 `terraform/modules/cloud-function-monthly-quota-grant/`
- 新規 `terraform/envs/prod/monthly-quota/terragrunt.hcl`

### Scripts
- 新規 `scripts/set_plan.py`
- 新規 `scripts/backfill_monthly_quota.py`

### Frontend
- `frontend/src/lib/booking.ts` — User 型拡張
- `frontend/src/app/mypage/_components/ProfileCard.tsx` — plan + quota 表示
- `frontend/src/app/book/_components/SlotCell.tsx` — ▲ (24h以内) state 追加
- `frontend/src/app/book/page.tsx` — エラー dialog ハンドリング

---

## Out of scope (4c で扱う)

- Stripe checkout / webhook
- プラン変更時の quota 再計算 (月の途中で plan アップグレード時の挙動など)
- グレード変更のプロレーション

## Migration (リリース手順)

1. Backend deploy (新 entity / endpoint, 既存ユーザー全員 plan=null → quota check で QuotaExhausted を返す)
2. Frontend deploy (plan 未契約 dialog 表示)
3. terraform apply for monthly-quota stack (Cloud Function + Scheduler)
4. 手動 `scripts/set_plan.py` で kz さんに `intensive` plan 付与 (テスト用)
5. 手動 `scripts/backfill_monthly_quota.py --month 2026-05` でリリース当月分付与
6. /book で予約 → quota 消費確認
7. 5/31 経過後、6/1 0:00 JST に Cloud Scheduler 動作確認
