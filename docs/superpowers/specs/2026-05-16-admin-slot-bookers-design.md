# Admin Slot Bookers Visibility (一覧で予約者表示) Design

## Goal

Admin の「予約可能な枠」一覧（`/admin/lessons`）で、各枠の「編集」詳細に入らずとも**予約したユーザー**が分かるようにする。

## Context

- 一覧 `frontend/src/app/admin/lessons/page.tsx` は `listOpenSlots()`（`GET /api/v1/lesson-slots`、予約者情報なし）で 開始/タイプ/定員/残/料金/編集 を表示。
- 詳細 `frontend/src/app/admin/lessons/[id]/page.tsx` には既に「予約者」表（名前/メール/状態/予約日時 + 強制キャンセル）があり、**`GET /api/v1/admin/lesson-slots/{id}/bookings`**（admin 認証、`AdminBookingRow[]` を返す）を使用。`AdminBookingRow` interface は同ファイル :18 にローカル定義、エンドポイント直書き axios（:57）。
- `frontend/src/lib/booking.ts` に private `authHeaders()`（:42、`firebaseAuth.authStateReady()` + `currentUser.getIdToken()`）。

要望は「一覧画面で予約者を可視化」。backend は既存エンドポイント流用で**変更不要**。フロント一覧の UI 拡張。

## Settled decisions（ユーザー承認済）

| # | 決定 |
|---|---|
| 表示方式 | A: 行展開（クリックで行直下にインライン展開、その枠だけ遅延取得・slot 単位キャッシュ・開閉トグル） |
| 内容 | read-only。confirmed の 名前/メール/予約日時。cancelled は除外し件数のみ添記 |
| 操作 | 強制キャンセル/予約追加は従来どおり詳細ページに集約。一覧は閲覧のみ |
| backend | 変更なし（既存 admin bookings API 流用） |
| DRY | `AdminBookingRow` 型 + 取得ヘルパを `lib/booking.ts` に正規化。詳細ページもその型を import（重複定義除去、挙動不変） |

## Architecture

### `frontend/src/lib/booking.ts` — 共有型 + ヘルパ追加

```ts
export interface AdminBookingRow {
  id: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  status: string;            // 'confirmed' | 'cancelled'
  created_at: string;
  cancelled_at: string | null;
}

export async function adminListSlotBookings(
  slotId: string,
): Promise<AdminBookingRow[]> {
  const resp = await axios.get<AdminBookingRow[]>(
    `${API_BASE}/api/v1/admin/lesson-slots/${slotId}/bookings`,
    { headers: await authHeaders() },
  );
  return resp.data;
}
```
（`authHeaders()` は既存 private を流用。新規 export はこの 2 つのみ。）

### `frontend/src/app/admin/lessons/page.tsx` — 行展開 UI

- state 追加: `expanded: Set<string>`、`cache: Record<string, AdminBookingRow[]>`、`loading: Set<string>`、`error: Record<string,string>`。
- 各行に展開トグルセル追加（`編集` の左、新 `<th></th>`/`<td>`）:
  - `s.booked_count === 0` → 非トグルで淡色 `予約者なし`。
  - `> 0` → `<button>` ラベル `{expanded? '▾':'▸'} 予約者 ({s.booked_count})`。
- トグル click: `expanded` に slot id を toggle。開く際 `cache[id]` 未取得なら `loading` に入れ `adminListSlotBookings(id)` 取得 → `cache[id]=rows`（失敗時 `error[id]`）→ `loading` から除外。
- 展開時、その行直下に `colSpan` で 1 行差し込み:
  - `loading` 中: 「読み込み中…」
  - `error[id]`: 「取得に失敗しました」
  - 取得済: `rows.filter(r=>r.status==='confirmed')` を 名前/メール/予約日時 の小テーブルで表示。confirmed 0 件なら「確定予約なし」。cancelled が存在すれば末尾に `（キャンセル済 M 件）`。
- 名前は `user_name ?? user_id`（詳細ページと同一フォールバック）、メールは `user_email ?? '—'`、日時は `new Date(created_at).toLocaleString('ja-JP')`。

### `frontend/src/app/admin/lessons/[id]/page.tsx` — 型の正規化のみ

ローカル `interface AdminBookingRow {…}`（:18）を削除し `import { adminListSlotBookings? , type AdminBookingRow } from '@/lib/booking'`。型は同一形状なので**挙動不変**。直書き axios はスコープ外（将来 `adminListSlotBookings` へ寄せる、本 PR では触らない）。

## Error handling / risk

| リスク | 対応 |
|---|---|
| N+1 取得で重い | 遅延（展開した枠のみ）+ slot 単位キャッシュ。一覧全体は取得しない |
| 型の二重定義ドリフト | `lib/booking.ts` を単一の真実にし詳細ページもそこから import |
| 詳細ページの回帰 | 変更は型 import 差し替えのみ（形状同一）。`npm run lint` + `npx tsc --noEmit` + 既存 jest で検証。直書き axios・操作系は不変 |
| 認証ヘッダ | 既存 `authHeaders()` 流用（detail と同じ admin トークン経路）|
| booked_count と実 confirmed 件数の差 | トグル表示は `booked_count`（slot 由来）。展開実値は API の confirmed。差異は通常なし（cancelled は booked_count に含まれない設計）。差異時も実 API 値を表示＝正 |

## Testing

- `cd frontend && npm run lint && npx tsc --noEmit`（型/lint）。
- `npm test`（既存 jest 緑、回帰なし）。
- 手動/Playwright（任意・本 PR 必須外）: admin で `/admin/lessons` → 予約のある枠の `予約者 (N)` 展開 → 名前/メール/日時表示、再クリックで閉、`予約者なし` 表示の枠。e2e 追加は任意（既存 `admin.spec.ts` の枠内に 1 ケース追加可だが本スコープ必須外）。
- 独立レビュー（spec/plan は別エージェント、自己レビュー禁止）。frontend のみ・infra 非該当のため cross-cutting-reviewer gate は不要（backend/infra 変更なし）。

## Files

### Modify
- `frontend/src/lib/booking.ts`（`AdminBookingRow` export + `adminListSlotBookings` 追加）
- `frontend/src/app/admin/lessons/page.tsx`（行展開 UI）
- `frontend/src/app/admin/lessons/[id]/page.tsx`（ローカル型削除 → 共有型 import のみ）

### 明示的に不変
- backend 全般（既存エンドポイント流用）、`shared/`、terraform、他ページ、詳細ページの操作系/直書き axios。

## Out of scope

- backend 変更、一覧での予約操作（強制キャンセル/追加）
- 詳細ページの axios を `adminListSlotBookings` へ寄せる移行（将来）
- ページング（予約数 = 定員程度の少数）
- e2e の必須追加（任意）

## Migration / rollback

フロント 3 ファイルのみ。`git revert` で完全復旧。backend/本番影響なし。
