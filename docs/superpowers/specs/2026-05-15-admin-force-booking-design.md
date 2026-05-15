# Admin Force-Booking / Force-Cancel (PR 4d) Design

## Goal

Admin が任意のユーザー枠予約/キャンセルを、24h ルール・quota・trial 消費を bypass して操作できる機能を追加する。capacity (定員) のみ物理制約として守る。

## Motivation

運営側で発生する次のシナリオに対応:

- ユーザー本人が予約できない時間帯 (24h 以内) に電話/対面で「とにかく今日入りたい」要望
- 当日キャンセル要望 (本来 24h 規約で不可)
- 店舗都合の中止 (quota / trial を返却したい)
- 無料体験枠のスタッフ手動オーバーライド

これらを admin UI から完結させる。

## Settled Requirements

| 項目 | 決定 |
|---|---|
| Force-cancel quota 返却 | Admin が UI で選択可能 (`refund_quota: bool`) |
| Force-cancel trial 返却 | Admin が UI で選択可能 (`refund_trial: bool`) — trial 枠のみ表示 |
| Force-book quota 消費 | Admin が UI で選択可能 (`consume_quota: bool`) |
| Force-book trial 消費 | Admin が UI で選択可能 (`consume_trial: bool`) — trial 枠のみ表示 |
| User 選択 UI | 検索 input + 候補一覧 (combo-box, debounce 300ms) |
| Capacity 制約 | 守る (`SlotFullError` は raise) |
| 24h ルール | 両方 bypass |
| 重複 confirmed booking | bypass しない (`AlreadyBookedError` raise) |
| `SlotInPast` / `SlotNotOpen` | bypass する (admin は閉じた/過去枠にも入れられる) |

## Architecture

### Approach

**A. `BookingService` に admin 専用メソッド 2 つを追加** (separate AdminBookingService や `force_admin` flag よりも責務がメソッド名で明示できる)。

### Backend layering (DDD は維持)

```
api/endpoints/lesson_slots.py   ← 既存 (admin CRUD)
api/endpoints/admin.py          ← 新規 (force-book / force-cancel / search-users)
        ↓
services/booking_service.py     ← admin_force_book / admin_force_cancel 追加
        ↓
domain/repositories/            ← UserRepository.search + list_all 追加
infrastructure/repositories/    ← Firestore 実装追加
```

## API Surface

### `POST /api/v1/admin/lesson-slots/{slot_id}/bookings`

```json
Request body:
{
  "user_id": "abc-firebase-uid",
  "consume_quota": false,
  "consume_trial": false
}

Response 201:
{ "id": "...", "slot_id": "...", "user_id": "...", "status": "confirmed", "created_at": "..." }
```

エラー:
- 400 `SlotFullError`, `UserNotFoundError`, `SlotNotFoundError`, `AlreadyBookedError`
- 403 (非 admin)

### `POST /api/v1/admin/bookings/{booking_id}/cancel`

```json
Request body:
{
  "refund_quota": false,
  "refund_trial": false
}

Response 200:
{ "id": "...", "status": "cancelled", "cancelled_at": "..." }
```

エラー:
- 404 `BookingNotFoundError`
- 403 (非 admin)

(`CancelDeadlinePassedError` は raise しない — admin は 24h bypass)

### `GET /api/v1/admin/users?q=<query>&limit=50`

```json
Response 200:
[
  { "uid": "abc-...", "email": "taro@example.com", "name": "山田太郎" },
  ...
]
```

- `q` 空: 最新 updated_at desc 50 件
- `q` あり: email/name の prefix match (Firestore range query)

## Service Layer

### `BookingService.admin_force_book`

```python
async def admin_force_book(
    self,
    *,
    slot_id: str,
    user_id: str,
    consume_quota: bool,
    consume_trial: bool,
) -> Booking:
```

#### Transaction (read → write)

**Read phase**:
1. slot fetch → 不在 → `SlotNotFoundError`
2. `slot.is_full` → `SlotFullError` (β: capacity 守る)
3. 重複 confirmed booking 確認 → あれば `AlreadyBookedError`
4. user fetch → 不在 → `UserNotFoundError` (新エラー)
5. `consume_quota=true` + 非 trial: quota_ref を read (不在時の挙動は Write phase 参照)

**Skip**:
- `SlotNotOpenError` (admin は closed 枠にも入れられる)
- `SlotInPastError` (admin は過去枠にも入れられる)
- 24h チェックなし

**Write phase**:
- `slot.booked_count += 1`
- booking doc 作成 (status=CONFIRMED)
- `consume_trial=true` + trial 枠 → `user.trial_used = true`
- `consume_quota=true` + 非 trial:
  - quota doc 存在: `used += 1` (上限 `used > granted` 許容)
  - quota doc 不在: warning log のみ、quota は触らない (booking 自体は成功)

### `BookingService.admin_force_cancel`

```python
async def admin_force_cancel(
    self,
    *,
    booking_id: str,
    refund_quota: bool,
    refund_trial: bool,
) -> Booking:
```

**Read phase**:
1. booking fetch → `BookingNotFoundError`
2. 既に CANCELLED → idempotent return (no write)
3. slot fetch (decrement 用)
4. `refund_quota=true` + 非 trial: quota_ref read
5. `refund_trial=true` + trial: user_ref read

**Write phase**:
- `slot.booked_count = max(0, current - 1)`
- `refund_quota=true` + 非 trial: `quota.used = max(0, used - 1)`
- `refund_trial=true` + trial: `user.trial_used = false`
- booking status → CANCELLED, cancelled_at = now

**Skip**:
- 24h チェックなし
- ownership チェックなし (admin は任意ユーザーの booking を操作可)

## User Search (combo-box backend)

### `UserRepository.search(q: str, limit: int) -> list[User]`

```python
async def search(self, q: str, *, limit: int = 50) -> list[User]:
    """email / name の prefix match (case-sensitive)。最大 limit 件。"""
```

実装:
- email range: `>= q AND < q + ''`
- name range: 同様
- 結果 set ユニオン (uid で重複除去)
- limit でカット

### `UserRepository.list_all(limit: int = 50) -> list[User]`

```python
async def list_all(self, *, limit: int = 50) -> list[User]:
    """updated_at desc で limit 件 (admin combo-box デフォルト)。"""
```

### Firestore index 追加 (`firestore.indexes.json`)

- `users.email` ascending (collection scope)
- `users.name` ascending
- `users.updated_at` descending

## Frontend UI

### Layout (`/admin/lessons/[id]` page)

既存ページに 2 つの新規要素:

```
[ 既存: 枠情報 / 編集 ]

予約者 (N 人)                      [+ 予約を追加]   ← 新規 button
┌─ table ───────────────────────────────────────┐
│ 名前 | メール | 状態 | 日時 |  [強制キャンセル] │  ← confirmed のみ
└────────────────────────────────────────────────┘
```

### Components (新規)

| File | 役割 |
|---|---|
| `frontend/src/app/admin/lessons/[id]/_components/AddBookingDialog.tsx` | 予約追加 modal: combo-box + checkbox + submit |
| `frontend/src/app/admin/lessons/[id]/_components/ForceCancelDialog.tsx` | 強制キャンセル confirm: checkbox + submit |
| `frontend/src/app/admin/lessons/[id]/_components/AdminUserPicker.tsx` | combo-box (debounce search + arrow nav) |
| `frontend/src/lib/admin-booking.ts` | `searchAdminUsers`, `adminForceBook`, `adminForceCancel` |

### Lesson type 別のチェックボックス表示 (mutually exclusive)

- `slot.lesson_type === 'trial'`:
  - AddBookingDialog: 「☐ trial を消費する」のみ表示 (quota チェックボックスは非表示)
  - ForceCancelDialog: 「☐ trial を返却する」のみ表示
- それ以外 (`group`, `private`, など):
  - AddBookingDialog: 「☐ quota を消費する」のみ表示
  - ForceCancelDialog: 「☐ quota を返却する」のみ表示

API body には常に両フラグを乗せる (`consume_quota` / `consume_trial`, `refund_quota` / `refund_trial`)。non-trial 枠で `consume_trial=true` が来ても backend は no-op (lesson_type 判定で分岐済み)。

### UX 詳細

- AddBookingDialog 開閉: 「予約を追加」ボタンで開く
- AdminUserPicker:
  - debounce 300ms で `/admin/users?q=` fetch
  - q 空でも開いたら最新 50 件表示
  - 上下キーで navigation
  - Enter で確定
  - 候補表示: `{email} ({name})`
- ForceCancelDialog: 予約行の「強制キャンセル」リンクで開く

## Error Handling

### Backend → Frontend エラーマップ

| Backend exception | HTTP | Frontend message (notification) |
|---|---|---|
| `SlotFullError` | 400 (code: `slot_full`) | 「定員に達しています。先に定員を増やしてください」 |
| `UserNotFoundError` | 404 (code: `user_not_found`) | 「ユーザーが見つかりません」 |
| `AlreadyBookedError` | 409 (code: `already_booked`) | 「すでに同じ枠に予約があります」 |
| `BookingNotFoundError` | 404 (code: `booking_not_found`) | 「予約が見つかりません」 |
| 403 | 403 | 「権限がありません」 |

既存の error code mapping パターン (sub-project 4b で導入済み) を踏襲。

## Testing

### Backend (`tests/services/test_booking_service_admin.py`)

- `admin_force_book` happy path (consume_quota=false で quota 触らない)
- `admin_force_book` 24h 以内枠予約成功
- `admin_force_book` 過去枠 / closed 枠予約成功
- `admin_force_book` capacity 満員 → `SlotFullError`
- `admin_force_book` user 不在 → `UserNotFoundError`
- `admin_force_book` 重複 → `AlreadyBookedError`
- `admin_force_book` consume_trial=true で `trial_used = true`
- `admin_force_book` consume_quota=true + quota doc 不在で create
- `admin_force_book` consume_quota=true + 残数 0 でも成功 (`used > granted` 許容)
- `admin_force_cancel` happy path
- `admin_force_cancel` 24h 以内でも成功
- `admin_force_cancel` 既にキャンセル済 → idempotent return
- `admin_force_cancel` refund_quota=true で `used -= 1`
- `admin_force_cancel` refund_trial=true で `trial_used = false`

### Backend API (`tests/api/test_admin_endpoints.py`)

- 非 admin → 403
- POST force-book happy path
- POST force-cancel happy path
- GET /admin/users?q=foo → prefix match
- GET /admin/users (q 空) → 最新 50 件

### Frontend (jest + RTL)

- `AddBookingDialog.test.tsx`: debounce search, submit, trial 枠時のみ trial checkbox
- `ForceCancelDialog.test.tsx`: open/cancel, checkbox の値が API body に乗る
- `AdminUserPicker.test.tsx`: debounce, arrow navigation, Enter で確定

## Files Touched

### Create
- `backend/app/api/endpoints/admin.py`
- `backend/app/api/schemas/admin.py` (`ForceBookRequest`, `ForceCancelRequest`, `UserSummaryResponse`)
- `backend/app/services/booking_errors.py` 追加: `UserNotFoundError`
- `backend/tests/services/test_booking_service_admin.py`
- `backend/tests/api/test_admin_endpoints.py`
- `frontend/src/lib/admin-booking.ts`
- `frontend/src/app/admin/lessons/[id]/_components/AddBookingDialog.tsx`
- `frontend/src/app/admin/lessons/[id]/_components/ForceCancelDialog.tsx`
- `frontend/src/app/admin/lessons/[id]/_components/AdminUserPicker.tsx`
- `frontend/src/app/admin/lessons/[id]/_components/__tests__/AddBookingDialog.test.tsx`
- `frontend/src/app/admin/lessons/[id]/_components/__tests__/ForceCancelDialog.test.tsx`
- `frontend/src/app/admin/lessons/[id]/_components/__tests__/AdminUserPicker.test.tsx`

### Modify
- `backend/app/services/booking_service.py` (admin_force_book / admin_force_cancel)
- `backend/app/domain/repositories/user_repository.py` (search, list_all 追加)
- `backend/app/infrastructure/repositories/firestore_user_repository.py` (実装追加)
- `backend/app/main.py` (admin router 登録)
- `frontend/src/app/admin/lessons/[id]/page.tsx` (新 UI 統合)
- `firestore.indexes.json` (新 index)

## Out of Scope

- Stripe / 課金処理 (PR 4c)
- E2E Playwright テスト (任意。MVP では unit テストで担保)
- Audit log (誰が誰の予約を強制したか) — 将来 4e で別途

## Migration / Rollback

- 新 endpoint 追加のみ。既存 API は変更なし → rollback 安全
- Firestore index 追加は backward compatible
- Frontend: 既存ページに UI 追加のみ → 既存機能影響なし
