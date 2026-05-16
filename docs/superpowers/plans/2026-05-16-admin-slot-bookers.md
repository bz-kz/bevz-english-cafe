# Admin Slot Bookers Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Surface booked users per slot on the `/admin/lessons` list via an expandable, lazily-fetched, read-only row — reusing the existing admin bookings endpoint.

**Architecture:** Add a shared `AdminBookingRow` type + `adminListSlotBookings()` helper to `lib/booking.ts`; add expand/lazy-fetch UI to the list page; dedupe the type in the detail page (import the shared one — shape-identical, behaviour unchanged). Frontend only, no backend/infra change.

**Tech Stack:** Next.js 14 client component, axios, Firebase auth header (existing `authHeaders()`).

**Spec:** [`docs/superpowers/specs/2026-05-16-admin-slot-bookers-design.md`](../specs/2026-05-16-admin-slot-bookers-design.md)

> **BRANCH:** `feat/admin-slot-bookers` from post-#23 `origin/main` (`c9920ab` or later — verify `git log --oneline | grep -q c9920ab`). Independent of e2e. No merge — PR creation only. No cross-cutting-reviewer gate needed (no backend/infra/.claude/terraform change) — independent spec/plan review only.

---

## File Structure

- Modify `frontend/src/lib/booking.ts` — export `AdminBookingRow`, add `adminListSlotBookings(slotId)`.
- Modify `frontend/src/app/admin/lessons/page.tsx` — expandable bookers UI.
- Modify `frontend/src/app/admin/lessons/[id]/page.tsx` — drop local `AdminBookingRow`, import shared.

---

## Task 1: Shared type + helper in `lib/booking.ts`

**Files:** Modify `frontend/src/lib/booking.ts`

- [ ] **Step 1: Confirm branch + current helper**

Run:
```bash
cd "$(git rev-parse --show-toplevel)"
git log --oneline | grep -q c9920ab && echo "post-#23 OK"
grep -n "async function authHeaders\|^const API_BASE\|^import axios" frontend/src/lib/booking.ts
```
Expected: `post-#23 OK`; note that `authHeaders()` (private), `API_BASE`, and `import axios` already exist (the helper reuses them).

- [ ] **Step 2: Append the export type + helper**

Add to `frontend/src/lib/booking.ts` (after the existing `Booking` interface / near other exported API fns; `authHeaders`, `API_BASE`, `axios` are already in scope):

```ts
export interface AdminBookingRow {
  id: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  status: string;
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

- [ ] **Step 3: Typecheck + lint**

Run: `cd frontend && npm run lint && npx tsc --noEmit`
Expected: clean (0 errors).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/booking.ts
git commit -m "feat(admin): shared AdminBookingRow type + adminListSlotBookings helper"
```

---

## Task 2: Dedupe the type in the detail page

**Files:** Modify `frontend/src/app/admin/lessons/[id]/page.tsx`

- [ ] **Step 1: Read the local interface + import line**

Run: `sed -n '1,30p' "frontend/src/app/admin/lessons/[id]/page.tsx"`
Confirm the local `interface AdminBookingRow { ... }` (≈ line 18) and the existing `import { ... , type LessonSlot } from '@/lib/booking';` line.

- [ ] **Step 2: Remove the local interface, import the shared type**

Delete the entire local `interface AdminBookingRow { ... }` block. Add `AdminBookingRow` to the existing `@/lib/booking` import as a type, e.g.:
```ts
import {
  adminDeleteSlot,
  adminUpdateSlot,
  type LessonSlot,
  type AdminBookingRow,
} from '@/lib/booking';
```
(Match the file's actual existing import shape — only add `type AdminBookingRow`. Do NOT change the direct axios call or any behaviour; the shared interface is shape-identical so all existing usages compile unchanged.)

- [ ] **Step 3: Typecheck + lint + existing tests**

Run: `cd frontend && npm run lint && npx tsc --noEmit && npm test -- --runInBand --watchAll=false`
Expected: lint/tsc clean; jest green (no regression — detail page behaviour unchanged).

- [ ] **Step 4: Commit**

```bash
git add "frontend/src/app/admin/lessons/[id]/page.tsx"
git commit -m "refactor(admin): use shared AdminBookingRow type in slot detail"
```

---

## Task 3: Expandable bookers UI on the list page

**Files:** Modify `frontend/src/app/admin/lessons/page.tsx`

- [ ] **Step 1: Replace the component with the expand-enabled version**

Rewrite `frontend/src/app/admin/lessons/page.tsx` to add lazy expand. Exact file content:

```tsx
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  listOpenSlots,
  adminListSlotBookings,
  type LessonSlot,
  type AdminBookingRow,
} from '@/lib/booking';

const TYPE_LABEL: Record<LessonSlot['lesson_type'], string> = {
  trial: '無料体験',
  group: 'グループ',
  private: 'プライベート',
  business: 'ビジネス',
  toeic: 'TOEIC',
  online: 'オンライン',
  other: 'その他',
};

export default function AdminLessonsPage() {
  const [slots, setSlots] = useState<LessonSlot[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [cache, setCache] = useState<Record<string, AdminBookingRow[]>>({});
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [error, setError] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      setSlots(await listOpenSlots());
    })();
  }, []);

  const toggle = async (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    // NOTE: `loading.has(id)` reads the stale closure value, so a same-tick
    // double-click can fire two GETs. This is benign (idempotent GET,
    // last-write-wins on setCache) — do NOT add ref/lock machinery for it.
    if (cache[id] || loading.has(id)) return;
    setLoading(prev => new Set(prev).add(id));
    try {
      const rows = await adminListSlotBookings(id);
      setCache(prev => ({ ...prev, [id]: rows }));
      setError(prev => {
        const n = { ...prev };
        delete n[id];
        return n;
      });
    } catch {
      setError(prev => ({ ...prev, [id]: '取得に失敗しました' }));
    } finally {
      setLoading(prev => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
    }
  };

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm text-gray-600">
          枠は毎日 0:00 JST に自動生成されます (14
          日先まで)。個別の編集・閉鎖は各枠の「編集」から。
        </p>
      </section>
      <section>
        <h2 className="mb-2 text-lg font-semibold">予約可能な枠</h2>
        <table className="w-full text-sm">
          <thead className="border-b text-left">
            <tr>
              <th className="py-2">開始</th>
              <th>タイプ</th>
              <th>定員</th>
              <th>残</th>
              <th>料金</th>
              <th>予約者</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {slots.map(s => {
              const isOpen = expanded.has(s.id);
              const rows = cache[s.id];
              const confirmed = rows
                ? rows.filter(r => r.status === 'confirmed')
                : [];
              const cancelledCount = rows
                ? rows.filter(r => r.status !== 'confirmed').length
                : 0;
              return (
                <>
                  <tr key={s.id} className="border-b">
                    <td className="py-2">
                      {new Date(s.start_at).toLocaleString('ja-JP')}
                    </td>
                    <td>{TYPE_LABEL[s.lesson_type]}</td>
                    <td>{s.capacity}</td>
                    <td>{s.remaining}</td>
                    <td>
                      {s.price_yen ? `¥${s.price_yen.toLocaleString()}` : '-'}
                    </td>
                    <td>
                      {s.booked_count === 0 ? (
                        <span className="text-gray-400">予約者なし</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggle(s.id)}
                          className="text-blue-600 underline"
                          aria-expanded={isOpen}
                        >
                          {isOpen ? '▾' : '▸'} 予約者 ({s.booked_count})
                        </button>
                      )}
                    </td>
                    <td>
                      <Link
                        href={`/admin/lessons/${s.id}`}
                        className="text-blue-600 underline"
                      >
                        編集
                      </Link>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr key={`${s.id}-detail`} className="border-b bg-gray-50">
                      <td colSpan={7} className="px-2 py-3">
                        {loading.has(s.id) && (
                          <span className="text-gray-500">読み込み中…</span>
                        )}
                        {error[s.id] && (
                          <span className="text-red-600">{error[s.id]}</span>
                        )}
                        {rows && !loading.has(s.id) && !error[s.id] && (
                          <>
                            {confirmed.length === 0 ? (
                              <span className="text-gray-500">
                                確定予約なし
                              </span>
                            ) : (
                              <table className="w-full text-sm">
                                <thead className="text-left text-gray-500">
                                  <tr>
                                    <th className="py-1">名前</th>
                                    <th>メール</th>
                                    <th>予約日時</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {confirmed.map(b => (
                                    <tr key={b.id}>
                                      <td className="py-1">
                                        {b.user_name ?? (
                                          <span className="text-gray-400">
                                            {b.user_id}
                                          </span>
                                        )}
                                      </td>
                                      <td>
                                        {b.user_email ?? (
                                          <span className="text-gray-400">
                                            —
                                          </span>
                                        )}
                                      </td>
                                      <td>
                                        {new Date(
                                          b.created_at,
                                        ).toLocaleString('ja-JP')}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                            {cancelledCount > 0 && (
                              <p className="mt-2 text-xs text-gray-400">
                                （キャンセル済 {cancelledCount} 件）
                              </p>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Fix the React key on the fragment**

`<>` cannot take a `key`. Replace the `<>...</>` wrapping the two `<tr>`s with `<Fragment key={s.id}>` (import `Fragment` from `react`) and remove the now-redundant `key={s.id}` on the first `<tr>`. Apply this edit so the list has stable keys with no console warning.

- [ ] **Step 3: Typecheck + lint**

Run: `cd frontend && npm run lint && npx tsc --noEmit`
Expected: clean (no `any`, no missing-key warning at build).

- [ ] **Step 4: Manual smoke (if dev stack available)**

If `docker compose up -d` is runnable: open `/admin/lessons` as an admin, expand a slot with bookings → name/email/予約日時 shown; collapse works; a `booked_count===0` slot shows `予約者なし` with no toggle; a fetch failure shows `取得に失敗しました`. If the stack is not available, state so — do not fabricate.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/admin/lessons/page.tsx
git commit -m "feat(admin): expandable per-slot bookers on lessons list (lazy, read-only)"
```

---

## Task 4: Verify + PR (no merge)

- [ ] **Step 1: Full frontend gate**

Run:
```bash
cd frontend && npm run lint && npx tsc --noEmit && npm test -- --runInBand --watchAll=false
```
Expected: lint/tsc clean; jest green (no regression).

- [ ] **Step 2: Scope assertion**

Run:
```bash
cd "$(git rev-parse --show-toplevel)"
git diff --name-only origin/main..HEAD | sort
```
Expected: exactly `frontend/src/lib/booking.ts`, `frontend/src/app/admin/lessons/page.tsx`, `frontend/src/app/admin/lessons/[id]/page.tsx`, plus `docs/superpowers/**` (spec/plan). NO backend/shared/terraform/other.

- [ ] **Step 3: Push + PR (no merge)**

```bash
git push -u origin feat/admin-slot-bookers
gh pr create --title "feat(admin): show booked users per slot on the lessons list" --body "$(cat <<'EOF'
## Summary
On `/admin/lessons`, each slot row gains a lazy, read-only **予約者 (N)** expander showing the confirmed bookers (name / email / 予約日時) without entering the per-slot edit page. Reuses the existing `GET /api/v1/admin/lesson-slots/{id}/bookings` endpoint — no backend change.

## What changed
- `lib/booking.ts`: exported `AdminBookingRow` + `adminListSlotBookings(slotId)` (reuses existing `authHeaders()`).
- `admin/lessons/page.tsx`: expandable row, per-slot lazy fetch + cache, confirmed-only table, `予約者なし` when `booked_count===0`, cancelled count footnote, loading/error states.
- `admin/lessons/[id]/page.tsx`: dropped the duplicate local `AdminBookingRow`, imports the shared type (shape-identical, behaviour unchanged).

## Test plan
- [x] `npm run lint` + `npx tsc --noEmit` clean
- [x] `npm test` green (no regression; detail page behaviour unchanged)
- [x] scope = 3 frontend files (+ docs); no backend/shared/terraform
- [ ] (reviewer) independent spec/plan review + human review

## Migration / rollback
Frontend only. `git revert` fully restores. No backend/prod impact.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
(Do NOT merge — PR creation only.)

---

## Spec Coverage Self-Check

| Spec requirement | Task |
|---|---|
| Shared `AdminBookingRow` + `adminListSlotBookings` helper (DRY) | 1 |
| Detail page uses shared type (dedupe, behaviour unchanged) | 2 |
| Expandable row, lazy fetch + per-slot cache, toggle | 3 |
| Read-only confirmed name/email/予約日時; `予約者なし` at 0; cancelled count footnote; loading/error | 3 |
| No backend/infra change; frontend-only scope | 4 (scope assert) |
| lint/tsc/jest green, no regression | 1–4 |
| No merge, independent review (no cross-cutting gate needed) | 4 + header |
