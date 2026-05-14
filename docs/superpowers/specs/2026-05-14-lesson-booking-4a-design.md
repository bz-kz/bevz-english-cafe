# Sub-project 4a: 30分コマ × 14日 予約 UI + Cloud Scheduler 自動生成 Design

## Goal

ユーザーが /book でカレンダー形式の予約 UI を使い、9:00–16:00 の 30 分コマを
2 週間先まで自由に選択して予約できる。枠は Cloud Scheduler が毎日 0:00 JST に
14 日先の 1 日分を自動生成する。

このサブプロジェクト単体で完結する MVP — quota / Stripe は **4b / 4c で導入**。
当面は「ログイン済みユーザーは無制限に予約できる」状態で動く。

## Non-goals

- 月次コマ管理 (= 4b)
- Stripe サブスクリプション連動 (= 4c)
- 24h キャンセル規則 (= 4b で導入。4a 時点では既存の無制限キャンセルを維持)
- 講師指定予約 (= 別 sub-project)
- リマインダー通知 (= 2c)

---

## Architecture

```
┌──────────────────┐  毎日 0:00 JST   ┌─────────────────────────┐
│ Cloud Scheduler  │ ───────────────→ │ Cloud Function (Python) │
│ jst-daily-slots  │                  │  generate_daily_slots   │
└──────────────────┘                  └────────────┬────────────┘
                                                   │ Firestore Admin SDK
                                                   ▼
                                       ┌─────────────────────┐
                                       │ Firestore           │
                                       │  lesson_slots       │
                                       │  (14日先 × 14コマ)   │
                                       └──────────┬──────────┘
                                                  │
              ┌───────────────────────────────────┘
              ▼
   ┌────────────────────┐  GET /api/v1/lesson-slots?from=&to=
   │ FastAPI (Cloud Run)│ ─────────────────────────────────→ /book (Next.js)
   └────────────────────┘                                       2D grid UI
```

### 既存資産との関係

| 既存 | 4a での扱い |
|------|-------------|
| `lesson_slots` collection | そのまま流用。30 分コマも同じスキーマで保存 |
| `bookings` collection | そのまま流用 |
| `BookingService.book()` | そのまま流用 (transaction で capacity 取り合い) |
| `/api/v1/admin/lesson-slots` (CRUD) | そのまま。admin が手動で × / 編集できる |
| `/api/v1/lesson-slots` (公開一覧) | クエリパラメータ `from` / `to` を追加 |
| `/book` (現状の SlotCard グリッド) | 完全置換 (旧 SlotCard は削除) |

---

## Data Model

### lesson_slots (既存スキーマそのまま使用)

```
lesson_slots/{id}
  start_at: timestamp        # JST 9:00, 9:30, ..., 15:30
  end_at:   timestamp        # start_at + 30 min
  lesson_type: 'private'     # 4a では固定。admin が編集可
  capacity:  1               # 4a では固定。admin が編集可
  booked_count: int          # transaction で更新
  price_yen: null            # 4a では null (4c で Stripe 連動)
  teacher_id: null           # 4a では null
  notes: null
  status: 'open' | 'closed' | 'cancelled'
  created_at, updated_at
```

### 新規 Firestore 索引

無し。`bookings` の `(user_id, slot_id, status)` index は 4a で再利用。
`lesson_slots` は `start_at` 範囲クエリ + `status` フィルタなので、既存の
`(status, start_at)` 複合索引でカバー済み。

---

## Backend Changes

### 1. `GET /api/v1/lesson-slots` のクエリパラメータ拡張

```
GET /api/v1/lesson-slots?from=2026-05-14&to=2026-05-28
```

- 既存: `limit` / `offset` で開いた枠を一覧
- 追加: `from`, `to` (ISO 8601 date) で範囲指定。指定があれば
  `start_at >= from AND start_at < to + 1d` でフィルタ
- 既存の `limit` 等とは排他にしない (両方共存 — `from/to` が優先)

ファイル: `backend/app/api/endpoints/lesson_slots.py`
リポジトリ: `LessonSlotRepository.find_in_range(from_, to_) -> list[LessonSlot]` を追加

### 2. 公開エンドポイントでも closed の枠を返す (× 表示用)

現状の `find_open_future` は `status=open` のみ。`/book` UI では × も
表示したいので、`find_in_range` は **status を絞らず** 返す。フロントが
セル色を判定する。

ただし `cancelled` は完全に表示しない (= filtering out)。

### 3. ユーザーの該当期間 bookings 取得 API

```
GET /api/v1/users/me/bookings?from=2026-05-14&to=2026-05-28
```

既存の `GET /api/v1/users/me/bookings` にクエリパラメータ追加。
UI が「自分の予約済みセル」をハイライトするために使用。

### 4. Cloud Function: 毎日枠生成

新規 Terraform スタック: `terraform/envs/prod/scheduler-slots/`

```
modules/cloud-function-slot-generator/
  main.tf                    # Cloud Function Gen2 (Python 3.12) + scheduler
  source/main.py             # generate_daily_slots(event, context)
  source/requirements.txt    # google-cloud-firestore
```

#### generate_daily_slots ロジック

```python
def generate_daily_slots(event, context):
    """Cloud Scheduler が毎日 0:00 JST に発火。
    
    今日から 14 日後 (= 2 週間後) の 1 日分の lesson_slots を作成する。
    既に同 start_at の枠が存在する場合はスキップ (冪等)。
    """
    target_date = jst_today() + timedelta(days=14)
    slots_to_create = []
    for hour in range(9, 16):              # 9, 10, ..., 15
        for minute in (0, 30):             # 9:00, 9:30, ..., 15:30
            start_at = jst_aware(target_date, hour, minute)
            end_at = start_at + timedelta(minutes=30)
            slots_to_create.append({
                'start_at': start_at,
                'end_at': end_at,
                'lesson_type': 'private',
                'capacity': 1,
                'booked_count': 0,
                'price_yen': None,
                'teacher_id': None,
                'notes': None,
                'status': 'open',
                'created_at': now_utc(),
                'updated_at': now_utc(),
            })
    
    db = firestore.Client(project='english-cafe-496209')
    batch = db.batch()
    for slot in slots_to_create:
        existing = db.collection('lesson_slots').where(
            'start_at', '==', slot['start_at']
        ).limit(1).get()
        if existing:
            continue  # 既存スキップ
        ref = db.collection('lesson_slots').document()
        batch.set(ref, slot)
    batch.commit()
```

#### Terraform リソース

- `google_storage_bucket` (関数ソース zip 保管、既存 bucket があれば再利用)
- `google_storage_bucket_object` (zip)
- `google_cloudfunctions2_function` (gen2, Python 3.12, eventarc trigger 不要、HTTP or Pub/Sub)
- `google_cloud_scheduler_job` (cron `0 0 * * *` TZ `Asia/Tokyo`)
- 専用 SA + `roles/datastore.user` (Firestore 書込)

#### 初回 backfill

リリース直後は枠が 0 件のため、手動で 14 日分一気に作る:

```
gcloud functions call generate-daily-slots --region=asia-northeast1
# を 14 回繰り返す or
python scripts/backfill_slots.py --days=14
```

新規スクリプト `scripts/backfill_slots.py` を追加。`generate_daily_slots` と
同じロジックを `--days N` で N 日分まわす。

---

## Frontend Changes

### 1. `/book` ページの全面刷新

**ファイル**: `frontend/src/app/book/page.tsx` (rewrite) + `frontend/src/app/book/_components/`

#### 構造

```
/book
  ├ <BookingGrid days={14} timeSlots={14}>
  │   ├ <GridHeader>          # 14日分の日付ヘッダ
  │   ├ <TimeColumn>          # 9:00 〜 15:30 の縦軸
  │   └ <CellGrid>            # 14 × 14 = 196 cells
  │       └ <SlotCell>        # ○ / × / - / 自分の予約済 をレンダー
  └ <BookingConfirmDialog>    # ○ クリック時のモーダル
```

#### セル状態判定

```ts
type CellState =
  | { kind: 'open'; slot: LessonSlot }       // ○ 緑、クリック可
  | { kind: 'closed'; slot: LessonSlot }     // × グレー、クリック不可
  | { kind: 'full'; slot: LessonSlot }       // × グレー、クリック不可
  | { kind: 'mine'; booking: Booking }       // 「予約済」青、クリック → /mypage
  | { kind: 'empty' };                       // - 灰、レコード無し (= scheduler 未到達)
```

データソース:
- `listSlotsInRange(from, to)` → `LessonSlot[]`
- `listMyBookingsInRange(from, to)` → `Booking[]` (要ログイン)
- マージして 14×14 グリッドに割当

#### スタイル

- Tailwind 利用。`grid-cols-15` (1 列の時間軸 + 14 列の日付) × `grid-rows-15` (1 行のヘッダ + 14 行の時間)
- セルサイズ: モバイル `w-12 h-8`、PC `w-20 h-10`
- 色: open=`bg-green-100 hover:bg-green-200`, closed/full=`bg-gray-200 text-gray-400`,
  mine=`bg-blue-500 text-white`, empty=`bg-gray-50 text-gray-300`
- ヘッダ: 「5/14 (水)」のように `Intl.DateTimeFormat('ja-JP', {month:'numeric', day:'numeric', weekday:'short'})`

#### 操作フロー

1. ページロード → 未ログインなら「ログインして予約する」CTA を表示、グリッドは閲覧可
2. open セルクリック → `<BookingConfirmDialog>` で「5/20 (火) 10:30〜11:00 のレッスンを予約しますか?」 → 確定 → `bookSlot(slot.id)` → グリッド再取得
3. mine セルクリック → `/mypage#booking-{id}` へ遷移
4. closed / full / empty セル: クリック無効、ツールチップ「予約不可」

### 2. lib/booking.ts に範囲取得関数を追加

```ts
export async function listSlotsInRange(
  from: string,  // 'YYYY-MM-DD'
  to: string
): Promise<LessonSlot[]>;

export async function listMyBookingsInRange(
  from: string,
  to: string
): Promise<Booking[]>;
```

### 3. ヘッダー「予約」リンクは既存のまま (`/book` を指す)

---

## Existing Admin UI への影響

最小限。`/admin/lessons` の既存 CRUD はそのまま動く。ただし:

- 一覧画面 (`/admin/lessons`) は今でも `listOpenSlots` を呼んでいるため、
  open 状態の枠だけが見える。Scheduler が毎日生成する 14 コマも自動的に
  ここに並ぶ — 「今後 14 日分の予約可能枠」が長い表になる
- 表示件数が多すぎる場合は別途 4b でフィルタ追加検討。4a では放置 (YAGNI)

---

## Tests

### Backend

- `tests/api/test_lesson_slots.py` に `from/to` クエリのテストを追加
  - 同日複数枠を作成 → range で 1 日範囲指定で全件取得
  - status=closed を含めるテスト
- `tests/api/test_bookings.py` に `from/to` クエリのテストを追加
- Cloud Function は pytest で単体テスト (`generate_daily_slots` を mock した
  Firestore client で呼ぶ)

### Frontend

- `frontend/__tests__/app/book/BookingGrid.test.tsx` — グリッドのセル状態判定
- `frontend/__tests__/app/book/SlotCell.test.tsx` — open / closed / mine / empty の
  各表示・クリック挙動
- e2e (Playwright): ログイン → /book → ○ クリック → 確認 → 予約成功 → 該当セルが
  「予約済」に変わる

### Cloud Function 検証

- `gcloud functions call generate-daily-slots --region=asia-northeast1` を手動実行
- Firestore Console で `lesson_slots` collection に 14 件追加されたことを確認
- 同じ start_at で再実行 → スキップされ重複が出ないことを確認

---

## Deployment Sequence

```
1. backend code 変更 → docker build + push → gcloud run services update
2. terraform/envs/prod/scheduler-slots/ apply → Cloud Function + Scheduler 配備
3. python scripts/backfill_slots.py --days=14 で初期 14 日分を投入
4. frontend 変更 → Vercel 自動 deploy
5. /book を実機確認
```

---

## Verification (end-to-end)

```bash
# 1. backfill 後の枠確認
curl https://api.bz-kz.com/api/v1/lesson-slots?from=2026-05-14&to=2026-05-28
# 14日 × 14コマ = 196 件返ること

# 2. UI 確認
open https://english-cafe.bz-kz.com/book
# - 2週間分のグリッド表示
# - ○ セルをクリック → 確認ダイアログ → 予約 → 「予約済」に変化

# 3. scheduler 確認
gcloud scheduler jobs describe jst-daily-slots --location=asia-northeast1
# - 翌日 0:00 JST に発火予定
# - 翌日 0:01 JST に Firestore で +14 件確認

# 4. admin が closed にした枠が × 表示になることを確認
# - /admin/lessons で 1 枠を「枠を閉じる」 → /book に戻ると × グレー表示
```

---

## Risks

- **Cloud Function コスト**: 1日1回 + 196件/月の write は無料枠に十分収まる
- **重複生成**: existing チェックを batch 前に行うが、複数の scheduler 実行が
  同時発火するとレース。冪等化のため `lesson_slots/{date}_{HHMM}` のような
  決定的 ID を採用する案もあるが、4a では現行 UUID + start_at where クエリで
  十分 (scheduler は 1 ジョブ 1 リージョン)
- **タイムゾーン**: すべて UTC 保存 + JST 表示。Cloud Scheduler TZ `Asia/Tokyo` 設定
  必須。Cloud Function 内では `zoneinfo.ZoneInfo('Asia/Tokyo')` を明示的に使う

---

## Open Questions → 4b で解決

- 「予約可能数の上限」(= quota) は 4b
- 「24h 以内のキャンセル不可」は 4b
- 「trial の生涯1回」は 4b

---

## Critical Files

### Backend
- `/Users/kz/work/english-caf/kz-bz-english2/backend/app/api/endpoints/lesson_slots.py`
- `/Users/kz/work/english-caf/kz-bz-english2/backend/app/api/endpoints/bookings.py`
- `/Users/kz/work/english-caf/kz-bz-english2/backend/app/domain/repositories/lesson_slot_repository.py`
- `/Users/kz/work/english-caf/kz-bz-english2/backend/app/infrastructure/repositories/firestore_lesson_slot_repository.py`

### Frontend
- `/Users/kz/work/english-caf/kz-bz-english2/frontend/src/app/book/page.tsx` (rewrite)
- 新規 `frontend/src/app/book/_components/BookingGrid.tsx`
- 新規 `frontend/src/app/book/_components/SlotCell.tsx`
- 新規 `frontend/src/app/book/_components/BookingConfirmDialog.tsx`
- `/Users/kz/work/english-caf/kz-bz-english2/frontend/src/lib/booking.ts`

### Infra
- 新規 `terraform/envs/prod/scheduler-slots/terragrunt.hcl`
- 新規 `terraform/modules/cloud-function-slot-generator/main.tf`
- 新規 `terraform/modules/cloud-function-slot-generator/source/main.py`

### Scripts
- 新規 `scripts/backfill_slots.py`
