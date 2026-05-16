# Auth Menu Click Race + Absolute Session Expiry — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** Fix the intermittently-unclickable "Admin" header menu item (unmount-mid-click race) and add a 24h absolute session cap (forced sign-out from last real login, activity-independent).

**Architecture:** Frontend-only, 2 files. `authStore.ts`: clear-then-reschedule an absolute-expiry `setTimeout` keyed on `user.metadata.lastSignInTime`; immediate `signOut` if already past 24h. `Header.tsx`: render a stable disabled "Admin" placeholder while `loading`, swap to the active `<Link>` only once auth is resolved (admin) — eliminating the conditional-unmount that swallows the click.

**Tech Stack:** Next.js 14 client components, Zustand `useAuthStore`, Firebase Auth (`onAuthStateChanged`, `signOut`).

**Spec:** [`docs/superpowers/specs/2026-05-16-auth-menu-session-fix-design.md`](../specs/2026-05-16-auth-menu-session-fix-design.md)

> **BRANCH:** `fix/auth-admin-menu-and-session-expiry` from post-#24 `origin/main` (`a8b9a45` or later — verify `git log --oneline | grep -q a8b9a45`). No merge — PR only. No cross-cutting-reviewer gate (frontend/src only, no backend/infra/.claude/terraform) — independent spec/plan review only.

---

## File Structure
- Modify `frontend/src/stores/authStore.ts` — absolute 24h expiry (constant + module timer + `onAuthStateChanged` rewrite).
- Modify `frontend/src/components/layout/Header.tsx` — pull `loading`; stabilize the Admin menu item.

---

## Task 1: Absolute 24h session expiry in `authStore.ts`

**Files:** Modify `frontend/src/stores/authStore.ts`

- [ ] **Step 1: Confirm branch + current file**

Run:
```bash
cd "$(git rev-parse --show-toplevel)"
git log --oneline | grep -q a8b9a45 && echo "post-#24 OK"
cat -n frontend/src/stores/authStore.ts
```
Expected: `post-#24 OK`; the file is the 35-line version with the `if (typeof window !== 'undefined') { onAuthStateChanged(... await getIdTokenResult() ... setState ...) }` block at lines 25–34 and `signOut` already imported from `firebase/auth`.

- [ ] **Step 2: Replace the `onAuthStateChanged` block**

Anchor on the LITERAL block, not line numbers (review fix: the block is the file's final `if (typeof window !== 'undefined') { … }` ending at the last `}` of the file — do not trust a numeric range). Replace that entire trailing block (from `if (typeof window !== 'undefined') {` through its closing brace at EOF) with the following; the two new module-scope declarations (`ABSOLUTE_SESSION_MS`, `expiryTimer`) go immediately BEFORE that `if`:

```ts
const ABSOLUTE_SESSION_MS = 24 * 60 * 60 * 1000;
let expiryTimer: ReturnType<typeof setTimeout> | null = null;

if (typeof window !== 'undefined') {
  onAuthStateChanged(firebaseAuth, async user => {
    if (expiryTimer) {
      clearTimeout(expiryTimer);
      expiryTimer = null;
    }
    if (!user) {
      useAuthStore.setState({ user: null, isAdmin: false, loading: false });
      return;
    }
    // Absolute session cap: force sign-out 24h after the last real sign-in.
    // lastSignInTime does NOT change on silent token refresh, so this is a
    // true absolute bound regardless of activity.
    const lastSignInMs = Date.parse(user.metadata.lastSignInTime ?? '');
    if (!Number.isNaN(lastSignInMs)) {
      const ageMs = Date.now() - lastSignInMs;
      if (ageMs >= ABSOLUTE_SESSION_MS) {
        useAuthStore.setState({ user: null, isAdmin: false, loading: false });
        await signOut(firebaseAuth);
        return;
      }
      expiryTimer = setTimeout(() => {
        void signOut(firebaseAuth);
      }, ABSOLUTE_SESSION_MS - ageMs);
    }
    const tokenResult = await user.getIdTokenResult();
    const isAdmin = Boolean(tokenResult.claims.admin);
    useAuthStore.setState({ user, isAdmin, loading: false });
  });
}
```

(Keep all of lines 1–23 — imports incl. `signOut`, the `AuthState` interface, and the `create<AuthState>` store with its own `signOut` — unchanged. Only the trailing `if (typeof window …)` block is replaced; the two new module-scope declarations go immediately before it.)

- [ ] **Step 3: Typecheck + lint**

Run: `cd frontend && npm run lint && npx tsc --noEmit`
Expected: clean (no `any`; `ReturnType<typeof setTimeout>` is correct in the Next.js DOM lib so no `NodeJS.Timeout` mismatch).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/stores/authStore.ts
git commit -m "fix(auth): absolute 24h session cap from last sign-in (forced signOut)"
```

---

## Task 2: Stabilize the Admin menu item in `Header.tsx`

**Files:** Modify `frontend/src/components/layout/Header.tsx`

- [ ] **Step 1: Read the current Admin block + the useAuthStore usage**

Run:
```bash
cd "$(git rev-parse --show-toplevel)"
grep -n "useAuthStore\|isAdmin\|loading\|/admin/lessons\|closeUserMenu" frontend/src/components/layout/Header.tsx
sed -n '1,40p' frontend/src/components/layout/Header.tsx
```
Confirm how `isAdmin` (and `signOut`/`closeUserMenu`) are obtained from `useAuthStore`, and that the Admin block at ≈ lines 98–106 is `{isAdmin && (<Link href="/admin/lessons" onClick={closeUserMenu} className="block px-3 py-2 text-sm hover:bg-gray-50">Admin</Link>)}`.

- [ ] **Step 2: Pull `loading` from the store**

Verified: `Header.tsx` uses a full-store destructure (≈ line 8): `const { user, isAdmin, signOut } = useAuthStore();`. Add `loading` to that same destructure → `const { user, isAdmin, signOut, loading } = useAuthStore();`. Do NOT change to a selector or alter the other reads. (If the actual destructure list differs, add `loading` to it verbatim in the same form.)

- [ ] **Step 3: Replace the Admin conditional with the stable version**

Replace the entire `{isAdmin && ( <Link href="/admin/lessons" ... >Admin</Link> )}` block with:

```tsx
{loading ? (
  <span
    aria-disabled="true"
    className="block cursor-default px-3 py-2 text-sm text-gray-400"
  >
    Admin
  </span>
) : (
  isAdmin && (
    <Link
      href="/admin/lessons"
      onClick={closeUserMenu}
      className="block px-3 py-2 text-sm hover:bg-gray-50"
    >
      Admin
    </Link>
  )
)}
```

(Placement unchanged — between the マイページ `<Link>` and the ログアウト `<button>`. Use the file's actual `closeUserMenu` handler name as found in Step 1; do not rename anything.)

- [ ] **Step 4: Typecheck + lint**

Run: `cd frontend && npm run lint && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/layout/Header.tsx
git commit -m "fix(header): stable disabled Admin placeholder while auth resolves (no click race)"
```

---

## Task 3: Tests (required — locks the race fix + timer; review's biggest-risk item)

**Files:** Modify `frontend/src/components/layout/__tests__/Header.test.tsx`; Create `frontend/src/stores/__tests__/authStore.test.ts`

- [ ] **Step 1: Header test — include `loading`, cover the placeholder/swap**

The existing mock (≈ L7-12) returns `{ user, isAdmin:false, signOut }` with NO `loading` (tests currently pass by luck — `loading` undefined → falsy). Update the `useAuthStore` mock to be parameterizable and add:
- `loading:true` (any `isAdmin`) → a disabled `Admin` is rendered as a non-link: assert `screen.getByText('Admin')` exists AND `screen.queryByRole('link', { name: 'Admin' })` is `null` (and/or the element has `aria-disabled="true"`).
- `loading:false, isAdmin:true` → assert `screen.getByRole('link', { name: 'Admin' })` has `href="/admin/lessons"`.
- `loading:false, isAdmin:false` → assert no `Admin` text/link.
Keep the existing 6 tests green (extend the mock so they still pass — pass `loading:false` for those). Match the file's existing mocking approach (`jest.mock('@/stores/authStore', …)`); do not rewrite unrelated tests.

- [ ] **Step 2: authStore absolute-expiry test**

Create `frontend/src/stores/__tests__/authStore.test.ts`. Because `authStore.ts` subscribes `onAuthStateChanged` at module import (side-effect), mock `firebase/auth` so `onAuthStateChanged` captures the callback, and `signOut` is a `jest.fn()`; mock `@/lib/firebase`. Use `jest.useFakeTimers()`. Pattern:
```ts
jest.mock('@/lib/firebase', () => ({ firebaseAuth: {} }));
const signOut = jest.fn().mockResolvedValue(undefined);
let cb: (u: unknown) => unknown;
jest.mock('firebase/auth', () => ({
  onAuthStateChanged: (_a: unknown, fn: (u: unknown) => unknown) => { cb = fn; return () => {}; },
  signOut: (...a: unknown[]) => signOut(...a),
}));
```
- Test A — stale: `jest.useFakeTimers()`; `await import('@/stores/authStore')`; invoke `cb({ metadata: { lastSignInTime: new Date(Date.now() - 25*3600*1000).toUTCString() }, getIdTokenResult: async () => ({ claims: {} }) })`; `await Promise.resolve()` flushes; assert `signOut` was called (immediate).
- Test B — fresh: invoke `cb` with `lastSignInTime` = now; assert `signOut` NOT yet called; `jest.advanceTimersByTime(24*3600*1000)`; assert `signOut` called once (scheduled).
- Test C — null user: invoke `cb(null)`; assert no throw, `signOut` not called, store `loading:false`.
Use `jest.resetModules()` + dynamic `import()` per test so the module-load subscription re-registers cleanly. If — and only if — the import-time side-effect genuinely cannot be driven without refactoring `authStore.ts` (which is OUT OF SCOPE), STOP and report BLOCKED with the specific obstacle rather than refactoring production code or weakening the test.

- [ ] **Step 3: Run the new tests**

Run: `cd frontend && npm test -- --runInBand --watchAll=false Header authStore`
Expected: the new Header assertions + authStore A/B/C pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/layout/__tests__/Header.test.tsx frontend/src/stores/__tests__/authStore.test.ts
git commit -m "test(auth): cover Admin placeholder/swap + 24h absolute-expiry signOut"
```

---

## Task 4: Verify + PR (no merge)

- [ ] **Step 1: Full frontend gate**

Run:
```bash
cd frontend && npm run lint && npx tsc --noEmit && npm test -- --runInBand --watchAll=false
```
Expected: lint/tsc clean. jest: pre-existing `frontend/src/lib/firebase.ts` jsdom `getAuth` failures may persist (baseline issue — `ContactForm.test`, `contact-form.integration`, `api.test`); confirm **0 NEW failures** vs that baseline and that `Header.test.tsx` + any authStore-touching suite pass. If a NEW suite fails, STOP and report (do not weaken).

- [ ] **Step 2: Scope assertion**

Run:
```bash
cd "$(git rev-parse --show-toplevel)"
git diff --name-only origin/main..HEAD | sort
```
Expected: exactly `frontend/src/stores/authStore.ts`, `frontend/src/components/layout/Header.tsx`, `frontend/src/components/layout/__tests__/Header.test.tsx`, `frontend/src/stores/__tests__/authStore.test.ts`, plus `docs/superpowers/**`. NO `firebase.ts`, no backend/shared/terraform/other.

- [ ] **Step 3: Push + PR (no merge)**

```bash
git push -u origin fix/auth-admin-menu-and-session-expiry
gh pr create --title "fix(auth): Admin menu click race + 24h absolute session cap" --body "$(cat <<'EOF'
## Summary
Two auth fixes (frontend-only, 2 files):
1. **Admin menu click race** — the header `{isAdmin && <Link>Admin</Link>}` unmounted/remounted when `isAdmin` flips false→true after the async custom-claim resolve, swallowing a click landing in that window ("Admin couldn't be selected"). Now a stable disabled "Admin" placeholder holds the slot while `loading`, swapping to the active `<Link>` only once auth is resolved — the active link is rendered from a terminal-stable `isAdmin`, so clicks are reliable.
2. **Absolute 24h session cap** — there was no `setPersistence`/expiry; Firebase default `browserLocalPersistence` + silent token refresh = effectively infinite sessions. `authStore` now forces `signOut` 24h after `user.metadata.lastSignInTime` (true last real login; unchanged by token refresh), via an immediate sign-out if already past and a cleared-then-rescheduled `setTimeout` otherwise. Activity-independent, per decision.

## What changed
- `stores/authStore.ts`: `ABSOLUTE_SESSION_MS` + module `expiryTimer`; `onAuthStateChanged` clears any prior timer, immediate `signOut` if `age >= 24h` (logged-out state set first), else schedules `signOut` at the remaining time; NaN-guarded (fail open). Lines 1–23 (imports/store) unchanged.
- `components/layout/Header.tsx`: read `loading`; Admin item = disabled grey placeholder while `loading`, active `<Link>` when resolved-admin, hidden for non-admins.
- `__tests__/Header.test.tsx` (updated) + `stores/__tests__/authStore.test.ts` (new): cover the placeholder→Link swap and the immediate/scheduled 24h `signOut`.

## Process
investigate (frontend-explorer root-cause) → user decisions (Issue1 placeholder approach; Issue2 absolute 24h) → spec → independent review → plan → independent review (APPROVE-WITH-FIXES: line-anchor, concrete Header destructure, required tests) → subagent impl.

## Test plan
- [x] `npm run lint` + `npx tsc --noEmit` clean
- [x] new Header tests (loading→span / resolved-admin→Link / non-admin→none) + authStore A/B/C (stale→immediate signOut, fresh→scheduled, null→noop) pass
- [x] `npm test` 0 NEW failures vs baseline (pre-existing firebase-jsdom suite failures unrelated)
- [x] scope = 4 frontend files — 2 src + 2 test (+ docs); no firebase.ts/backend/shared/terraform → no cross-cutting gate
- [ ] (reviewer) human review before merge

## Migration / rollback
Frontend client behaviour only. `git revert` fully restores. No backend/prod impact.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
(Do NOT merge — PR creation only.)

---

## Spec Coverage Self-Check

| Spec requirement | Task |
|---|---|
| Issue 1: stable disabled placeholder while loading → active Link when resolved-admin → hidden non-admin | 2 |
| Header reads `loading` from store | 2 |
| Issue 2: absolute 24h from `lastSignInTime`, activity-independent | 1 |
| immediate signOut if past; cleared-then-rescheduled timer; NaN fail-open; logged-out state before signOut | 1 |
| lines 1–23 of authStore unchanged; only the window block replaced (literal anchor) | 1 |
| required tests: Header placeholder/swap + authStore 24h immediate/scheduled signOut | 3 |
| frontend-only scope (2 src + 2 test), no firebase.ts/backend change | 4 (scope assert) |
| lint/tsc clean, 0 new jest failures | 1–4 |
| no merge, independent review, no cross-cutting gate | 4 + header |
