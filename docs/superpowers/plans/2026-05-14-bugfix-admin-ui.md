# Admin UI Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 「枠を閉じる」「ヘッダードロップダウン」「新規枠を作成」の3バグを修正する。

**Architecture:** UI スコープのみ。バックエンドは無変更。Header dropdown は controlled state 化、Slot 詳細ページの 「枠を閉じる」 は遷移付きフィードバック、SlotForm は notificationStore 連携 + Firebase authStateReady 待機 + refresh 失敗の隔離。

**Tech Stack:** Next.js 14 App Router / TypeScript / Tailwind / Jest + @testing-library/react / zustand (既存 `notificationStore`) / Firebase Auth v10。

---

## File Map

| パス | 種別 | 役割 |
|---|---|---|
| `frontend/src/components/layout/Header.tsx` | modify | `<details>` を controlled `<button>` dropdown に置換 |
| `frontend/src/components/layout/__tests__/Header.test.tsx` | create | dropdown の open/close と outside-click 挙動 |
| `frontend/src/app/admin/lessons/_components/SlotForm.tsx` | modify | 成功 toast / refresh failure 隔離 / busy 表示強化 |
| `frontend/src/app/admin/lessons/_components/__tests__/SlotForm.test.tsx` | create | 作成成功・失敗・refresh コケ時のフロー |
| `frontend/src/lib/booking.ts` | modify | `authHeaders()` で `firebaseAuth.authStateReady()` を待機 |
| `frontend/src/app/admin/lessons/[id]/page.tsx` | modify | 「枠を閉じる」を busy/redirect、open でない時は非表示 |
| `frontend/src/app/admin/lessons/[id]/__tests__/page.test.tsx` | create | close ボタンの busy / 遷移 / status ガード |

---

## Task 1: Header ドロップダウンを controlled state 化

**Files:**
- Modify: `frontend/src/components/layout/Header.tsx`
- Create: `frontend/src/components/layout/__tests__/Header.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/layout/__tests__/Header.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import Header from '../Header';

jest.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    user: { displayName: 'テスト太郎', email: 't@example.com' },
    isAdmin: false,
    signOut: jest.fn(),
  }),
}));

describe('Header dropdown', () => {
  it('starts closed', () => {
    render(<Header />);
    expect(screen.queryByText('マイページ')).not.toBeInTheDocument();
  });

  it('opens when the user button is clicked', () => {
    render(<Header />);
    fireEvent.click(screen.getByRole('button', { name: /テスト太郎/i }));
    expect(screen.getByText('マイページ')).toBeInTheDocument();
  });

  it('closes when an outside click occurs', () => {
    render(
      <div>
        <Header />
        <div data-testid="outside">outside</div>
      </div>
    );
    fireEvent.click(screen.getByRole('button', { name: /テスト太郎/i }));
    expect(screen.getByText('マイページ')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByText('マイページ')).not.toBeInTheDocument();
  });

  it('closes when the マイページ link is clicked', () => {
    render(<Header />);
    fireEvent.click(screen.getByRole('button', { name: /テスト太郎/i }));
    fireEvent.click(screen.getByText('マイページ'));
    expect(screen.queryByText('マイページ')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test, expect failure**

Run: `cd frontend && npm test -- src/components/layout/__tests__/Header.test.tsx`
Expected: All four tests FAIL — current `<details>` cannot be programmatically opened via click on the summary because we render with a plain `<button>` query in the test, and outside-click does not close `<details>`.

- [ ] **Step 3: Rewrite Header dropdown to controlled state**

Replace the `<details>...</details>` block in `frontend/src/components/layout/Header.tsx` (the user menu under the desktop CTA). Full replacement of the file is below (preserve existing nav / mobile menu structure; only the user-menu region changes plus added hooks):

```tsx
'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';

const Header = () => {
  const { user, isAdmin, signOut } = useAuthStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isUserMenuOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsUserMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [isUserMenuOpen]);

  const navigation = [
    { name: 'ホーム', href: '/' },
    { name: '講師紹介', href: '/instructors' },
    { name: 'レッスン', href: '/lessons' },
    { name: '予約', href: '/book' },
    { name: '動画', href: '/videos' },
    { name: 'お問い合わせ', href: '/contact' },
  ];

  const closeUserMenu = () => setIsUserMenuOpen(false);

  return (
    <header className="bg-white shadow-sm">
      <nav className="container-custom">
        <div className="flex h-16 items-center justify-between">
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center">
              <span className="text-2xl font-bold text-primary-600">
                英会話カフェ
              </span>
            </Link>
          </div>

          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              {navigation.map(item => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-primary-600"
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </div>

          <div className="hidden md:flex md:items-center md:gap-3">
            <Link href="/contact" className="btn-primary">
              無料体験予約
            </Link>
            {user ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen(v => !v)}
                  aria-haspopup="menu"
                  aria-expanded={isUserMenuOpen}
                  className="rounded px-3 py-2 text-sm hover:bg-gray-100"
                >
                  {user.displayName ?? user.email ?? 'ユーザー'}
                </button>
                {isUserMenuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 z-10 mt-1 w-40 rounded border bg-white shadow"
                  >
                    <Link
                      href="/mypage"
                      onClick={closeUserMenu}
                      className="block px-3 py-2 text-sm hover:bg-gray-50"
                    >
                      マイページ
                    </Link>
                    {isAdmin && (
                      <Link
                        href="/admin/lessons"
                        onClick={closeUserMenu}
                        className="block px-3 py-2 text-sm hover:bg-gray-50"
                      >
                        Admin
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        closeUserMenu();
                        signOut();
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                    >
                      ログアウト
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/login"
                className="rounded px-3 py-2 text-sm hover:bg-gray-100"
              >
                ログイン
              </Link>
            )}
          </div>

          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="inline-flex items-center justify-center rounded-md p-2 text-gray-700 hover:bg-gray-100 hover:text-primary-600"
              aria-expanded="false"
            >
              <span className="sr-only">メニューを開く</span>
              {!isMenuOpen ? (
                <svg
                  className="block h-6 w-6"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              ) : (
                <svg
                  className="block h-6 w-6"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        {isMenuOpen && (
          <div className="md:hidden">
            <div className="space-y-1 px-2 pb-3 pt-2 sm:px-3">
              {navigation.map(item => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="block rounded-md px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-100 hover:text-primary-600"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.name}
                </Link>
              ))}
              <Link
                href="/contact"
                className="mt-4 block w-full rounded-lg bg-primary-600 px-4 py-2 text-center font-medium text-white hover:bg-primary-700"
                onClick={() => setIsMenuOpen(false)}
              >
                無料体験予約
              </Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
};

export default Header;
```

- [ ] **Step 4: Run the test, expect pass**

Run: `cd frontend && npm test -- src/components/layout/__tests__/Header.test.tsx`
Expected: All 4 tests PASS.

- [ ] **Step 5: Type-check + lint**

Run:
```
cd frontend && npx tsc --noEmit
cd frontend && npm run lint -- src/components/layout/Header.tsx
```
Expected: 0 errors / 0 warnings on those scopes.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/layout/Header.tsx \
        frontend/src/components/layout/__tests__/Header.test.tsx
git commit -m "fix(header): controlled dropdown closes on outside click + link nav (bug 2)"
```

---

## Task 2: `authHeaders()` で Firebase auth state を待機

**Files:**
- Modify: `frontend/src/lib/booking.ts` (`authHeaders` function only)

このタスクは Task 3 の SlotForm 信頼性に必要。

- [ ] **Step 1: Read the current implementation context**

Current `authHeaders()` (lines 42–47 of `frontend/src/lib/booking.ts`):

```ts
async function authHeaders(): Promise<Record<string, string>> {
  const user = firebaseAuth.currentUser;
  if (!user) return {};
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}
```

Issue: on a fresh page load `currentUser` is `null` until Firebase Auth's onAuthStateChanged fires. Admin pages render after `useAdminGuard` confirms auth, but other call sites (or fast double-clicks) can race.

- [ ] **Step 2: Update `authHeaders` to await `authStateReady()`**

Replace the function body in `frontend/src/lib/booking.ts`:

```ts
async function authHeaders(): Promise<Record<string, string>> {
  await firebaseAuth.authStateReady();
  const user = firebaseAuth.currentUser;
  if (!user) return {};
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}
```

Notes:
- `firebaseAuth.authStateReady()` resolves once Firebase has fully initialized — it is a no-op after first call (cached).
- This guarantees that admin requests never silently drop the Authorization header.

- [ ] **Step 3: Run existing booking-related tests**

Run:
```
cd frontend && npm test -- src/lib
```
Expected: existing tests still pass (or none exist for booking.ts, which is fine).

- [ ] **Step 4: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/booking.ts
git commit -m "fix(booking): await authStateReady before reading currentUser (bug 3 prereq)"
```

---

## Task 3: SlotForm に成功 toast + refresh 失敗隔離 + 検証強化

**Files:**
- Modify: `frontend/src/app/admin/lessons/_components/SlotForm.tsx`
- Create: `frontend/src/app/admin/lessons/_components/__tests__/SlotForm.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/app/admin/lessons/_components/__tests__/SlotForm.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SlotForm } from '../SlotForm';

jest.mock('@/lib/booking', () => ({
  adminCreateSlot: jest.fn(),
}));

const mockSuccess = jest.fn();
jest.mock('@/stores/notificationStore', () => ({
  useNotificationStore: () => ({
    success: mockSuccess,
    error: jest.fn(),
  }),
}));

import { adminCreateSlot } from '@/lib/booking';

const adminCreateSlotMock = adminCreateSlot as jest.MockedFunction<
  typeof adminCreateSlot
>;

const fill = (label: string, value: string) => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
};

describe('SlotForm', () => {
  beforeEach(() => {
    adminCreateSlotMock.mockReset();
    mockSuccess.mockReset();
  });

  it('shows error when end is before start', async () => {
    const onCreated = jest.fn();
    render(<SlotForm onCreated={onCreated} />);
    fill('開始', '2026-05-20T10:00');
    fill('終了', '2026-05-20T09:00');
    fireEvent.click(screen.getByRole('button', { name: '作成' }));
    expect(
      await screen.findByText(/終了は開始より後/i)
    ).toBeInTheDocument();
    expect(adminCreateSlotMock).not.toHaveBeenCalled();
  });

  it('calls adminCreateSlot and shows success toast on happy path', async () => {
    adminCreateSlotMock.mockResolvedValueOnce({} as never);
    const onCreated = jest.fn().mockResolvedValueOnce(undefined);
    render(<SlotForm onCreated={onCreated} />);
    fill('開始', '2026-05-20T10:00');
    fill('終了', '2026-05-20T10:30');
    fireEvent.click(screen.getByRole('button', { name: '作成' }));
    await waitFor(() => expect(adminCreateSlotMock).toHaveBeenCalledTimes(1));
    expect(mockSuccess).toHaveBeenCalledWith(
      expect.stringContaining('枠を追加しました')
    );
    expect(onCreated).toHaveBeenCalled();
  });

  it('still shows success toast even when refresh fails', async () => {
    adminCreateSlotMock.mockResolvedValueOnce({} as never);
    const onCreated = jest.fn().mockRejectedValueOnce(new Error('boom'));
    render(<SlotForm onCreated={onCreated} />);
    fill('開始', '2026-05-20T10:00');
    fill('終了', '2026-05-20T10:30');
    fireEvent.click(screen.getByRole('button', { name: '作成' }));
    await waitFor(() => expect(mockSuccess).toHaveBeenCalled());
    expect(
      screen.queryByText(/作成に失敗しました/)
    ).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test, expect failure**

Run: `cd frontend && npm test -- src/app/admin/lessons/_components/__tests__/SlotForm.test.tsx`
Expected: All 3 tests FAIL (notificationStore not used yet, no `終了は開始より後` validation, refresh failure surfaces as `作成に失敗しました`).

- [ ] **Step 3: Update SlotForm**

Replace `frontend/src/app/admin/lessons/_components/SlotForm.tsx` with:

```tsx
'use client';

import { useState } from 'react';
import {
  adminCreateSlot,
  type CreateSlotInput,
  type LessonType,
} from '@/lib/booking';
import { useNotificationStore } from '@/stores/notificationStore';

const TYPES: { value: LessonType; label: string }[] = [
  { value: 'group', label: 'グループ' },
  { value: 'private', label: 'プライベート' },
  { value: 'trial', label: '無料体験' },
  { value: 'business', label: 'ビジネス英語' },
  { value: 'toeic', label: 'TOEIC対策' },
  { value: 'online', label: 'オンライン' },
  { value: 'other', label: 'その他' },
];

export function SlotForm({ onCreated }: { onCreated: () => void | Promise<void> }) {
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [lessonType, setLessonType] = useState<LessonType>('group');
  const [capacity, setCapacity] = useState(4);
  const [priceYen, setPriceYen] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const notify = useNotificationStore();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const start = new Date(startAt);
    const end = new Date(endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setError('開始と終了の日時を正しく入力してください');
      return;
    }
    if (end <= start) {
      setError('終了は開始より後の時刻にしてください');
      return;
    }

    setBusy(true);
    try {
      const input: CreateSlotInput = {
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        lesson_type: lessonType,
        capacity,
        price_yen: priceYen ? parseInt(priceYen, 10) : null,
        notes: notes || null,
      };
      await adminCreateSlot(input);
      notify.success('枠を追加しました');
      setStartAt('');
      setEndAt('');
      setCapacity(4);
      setPriceYen('');
      setNotes('');
      try {
        await onCreated();
      } catch (refreshErr) {
        console.warn('refresh after create failed', refreshErr);
      }
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })
        .response?.data?.detail;
      setError(detail ?? '作成に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded border bg-white p-4">
      <h2 className="font-semibold">新規枠を作成</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm">開始</span>
          <input
            type="datetime-local"
            required
            value={startAt}
            onChange={e => setStartAt(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
          />
        </label>
        <label className="block">
          <span className="text-sm">終了</span>
          <input
            type="datetime-local"
            required
            value={endAt}
            onChange={e => setEndAt(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
          />
        </label>
        <label className="block">
          <span className="text-sm">タイプ</span>
          <select
            value={lessonType}
            onChange={e => setLessonType(e.target.value as LessonType)}
            className="mt-1 w-full rounded border px-2 py-1"
          >
            {TYPES.map(t => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm">定員</span>
          <input
            type="number"
            min={1}
            required
            value={capacity}
            onChange={e => setCapacity(parseInt(e.target.value, 10))}
            className="mt-1 w-full rounded border px-2 py-1"
          />
        </label>
        <label className="block">
          <span className="text-sm">料金 (¥, 任意)</span>
          <input
            type="number"
            value={priceYen}
            onChange={e => setPriceYen(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
          />
        </label>
      </div>
      <label className="block">
        <span className="text-sm">メモ (admin のみ閲覧)</span>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          className="mt-1 w-full rounded border px-2 py-1"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="rounded bg-blue-600 px-3 py-2 text-white disabled:opacity-50"
      >
        {busy ? '作成中…' : '作成'}
      </button>
    </form>
  );
}
```

Key changes:
- Validate `end > start` on the client before calling the API
- Wrap `onCreated()` in inner try/catch so a refresh failure does NOT mask a successful create
- Show `notify.success('枠を追加しました')` immediately on successful POST
- `onCreated` type widened to `() => void | Promise<void>` so we can `await` it safely

- [ ] **Step 4: Run the test, expect pass**

Run: `cd frontend && npm test -- src/app/admin/lessons/_components/__tests__/SlotForm.test.tsx`
Expected: 3 tests PASS.

- [ ] **Step 5: Type-check + lint**

Run:
```
cd frontend && npx tsc --noEmit
cd frontend && npm run lint -- src/app/admin/lessons/_components/SlotForm.tsx
```
Expected: 0 errors / 0 warnings.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/admin/lessons/_components/SlotForm.tsx \
        frontend/src/app/admin/lessons/_components/__tests__/SlotForm.test.tsx
git commit -m "fix(admin): SlotForm success toast + isolate refresh failure (bug 3)"
```

---

## Task 4: 「枠を閉じる」ボタンに busy 状態 + 遷移 + status ガード

**Files:**
- Modify: `frontend/src/app/admin/lessons/[id]/page.tsx`
- Create: `frontend/src/app/admin/lessons/[id]/__tests__/page.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/app/admin/lessons/[id]/__tests__/page.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'abc' }),
  useRouter: () => ({ push }),
}));

jest.mock('@/lib/firebase', () => ({
  firebaseAuth: { currentUser: { getIdToken: () => Promise.resolve('t') } },
}));

const adminUpdateSlot = jest.fn();
const adminDeleteSlot = jest.fn();
jest.mock('@/lib/booking', () => ({
  adminUpdateSlot: (...args: unknown[]) => adminUpdateSlot(...args),
  adminDeleteSlot: (...args: unknown[]) => adminDeleteSlot(...args),
}));

const get = jest.fn();
jest.mock('axios', () => ({
  __esModule: true,
  default: { get: (...args: unknown[]) => get(...args) },
}));

import AdminLessonEditPage from '../page';

const baseSlot = {
  id: 'abc',
  start_at: '2026-05-20T10:00:00Z',
  end_at: '2026-05-20T10:30:00Z',
  lesson_type: 'private',
  capacity: 1,
  booked_count: 0,
  remaining: 1,
  status: 'open',
  price_yen: null,
};

describe('AdminLessonEditPage', () => {
  beforeEach(() => {
    push.mockReset();
    adminUpdateSlot.mockReset();
    adminDeleteSlot.mockReset();
    get.mockReset();
  });

  it('shows 枠を閉じる while status=open', async () => {
    get.mockResolvedValueOnce({ data: baseSlot });
    get.mockResolvedValueOnce({ data: [] });
    render(<AdminLessonEditPage />);
    expect(
      await screen.findByRole('button', { name: '枠を閉じる' })
    ).toBeInTheDocument();
  });

  it('hides 枠を閉じる when status=closed', async () => {
    get.mockResolvedValueOnce({ data: { ...baseSlot, status: 'closed' } });
    get.mockResolvedValueOnce({ data: [] });
    render(<AdminLessonEditPage />);
    await screen.findByText('枠 #abc');
    expect(
      screen.queryByRole('button', { name: '枠を閉じる' })
    ).not.toBeInTheDocument();
  });

  it('calls update and navigates back on close', async () => {
    get.mockResolvedValueOnce({ data: baseSlot });
    get.mockResolvedValueOnce({ data: [] });
    adminUpdateSlot.mockResolvedValueOnce({});
    render(<AdminLessonEditPage />);
    fireEvent.click(
      await screen.findByRole('button', { name: '枠を閉じる' })
    );
    await waitFor(() =>
      expect(adminUpdateSlot).toHaveBeenCalledWith('abc', { status: 'closed' })
    );
    expect(push).toHaveBeenCalledWith('/admin/lessons');
  });
});
```

- [ ] **Step 2: Run the test, expect failure**

Run: `cd frontend && npm test -- src/app/admin/lessons/\\[id\\]/__tests__/page.test.tsx`
Expected: tests for hide-when-closed and navigate-after-close FAIL.

- [ ] **Step 3: Update the page**

Replace `frontend/src/app/admin/lessons/[id]/page.tsx`:

```tsx
'use client';

import axios from 'axios';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  adminDeleteSlot,
  adminUpdateSlot,
  type LessonSlot,
} from '@/lib/booking';
import { firebaseAuth } from '@/lib/firebase';
import { useNotificationStore } from '@/stores/notificationStore';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8010';

interface AdminBookingRow {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
}

export default function AdminLessonEditPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const notify = useNotificationStore();
  const [slot, setSlot] = useState<LessonSlot | null>(null);
  const [bookings, setBookings] = useState<AdminBookingRow[]>([]);
  const [teacherId, setTeacherId] = useState('');
  const [notes, setNotes] = useState('');
  const [capacity, setCapacity] = useState(0);
  const [busy, setBusy] = useState<null | 'save' | 'close' | 'delete'>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const headers: Record<string, string> = {};
    const token = await firebaseAuth.currentUser?.getIdToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const slotResp = await axios.get<LessonSlot>(
      `${API_BASE}/api/v1/lesson-slots/${id}`
    );
    setSlot(slotResp.data);
    setCapacity(slotResp.data.capacity);

    const bookingsResp = await axios.get<AdminBookingRow[]>(
      `${API_BASE}/api/v1/admin/lesson-slots/${id}/bookings`,
      { headers }
    );
    setBookings(bookingsResp.data);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!slot) return <p>読み込み中…</p>;

  const handleSave = async () => {
    setBusy('save');
    try {
      await adminUpdateSlot(slot.id, {
        teacher_id: teacherId || null,
        notes: notes || null,
        capacity,
      });
      notify.success('保存しました');
      await load();
    } finally {
      setBusy(null);
    }
  };

  const handleClose = async () => {
    if (!confirm('この枠を閉じますか? (一覧から非表示になります)')) return;
    setBusy('close');
    try {
      await adminUpdateSlot(slot.id, { status: 'closed' });
      notify.success('枠を閉じました');
      router.push('/admin/lessons');
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    const confirmed = bookings.filter(b => b.status === 'confirmed').length;
    if (
      confirmed > 0 &&
      !confirm(`${confirmed} 件の確定予約があります。強制削除しますか?`)
    )
      return;
    setBusy('delete');
    try {
      await adminDeleteSlot(slot.id, confirmed > 0);
      notify.success('枠を削除しました');
      router.push('/admin/lessons');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">枠 #{slot.id}</h2>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="text-gray-500">開始</dt>
        <dd>{new Date(slot.start_at).toLocaleString('ja-JP')}</dd>
        <dt className="text-gray-500">終了</dt>
        <dd>{new Date(slot.end_at).toLocaleString('ja-JP')}</dd>
        <dt className="text-gray-500">タイプ</dt>
        <dd>{slot.lesson_type}</dd>
        <dt className="text-gray-500">ステータス</dt>
        <dd>{slot.status}</dd>
        <dt className="text-gray-500">予約数</dt>
        <dd>
          {slot.booked_count} / {slot.capacity}
        </dd>
      </dl>

      <div className="space-y-3 rounded border bg-white p-4">
        <h3 className="font-semibold">編集</h3>
        <label className="block text-sm">
          講師 ID
          <input
            type="text"
            value={teacherId}
            onChange={e => setTeacherId(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
          />
        </label>
        <label className="block text-sm">
          定員
          <input
            type="number"
            min={slot.booked_count}
            value={capacity}
            onChange={e => setCapacity(parseInt(e.target.value, 10))}
            className="mt-1 w-full rounded border px-2 py-1"
          />
        </label>
        <label className="block text-sm">
          メモ
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
          />
        </label>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={busy !== null}
            className="rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            {busy === 'save' ? '保存中…' : '保存'}
          </button>
          {slot.status === 'open' && (
            <button
              onClick={handleClose}
              disabled={busy !== null}
              className="rounded border px-3 py-2 text-sm disabled:opacity-50"
            >
              {busy === 'close' ? '閉じています…' : '枠を閉じる'}
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={busy !== null}
            className="rounded border px-3 py-2 text-sm text-red-600 disabled:opacity-50"
          >
            {busy === 'delete' ? '削除中…' : '枠を削除'}
          </button>
        </div>
      </div>

      <section>
        <h3 className="mb-2 font-semibold">予約者</h3>
        {bookings.length === 0 ? (
          <p className="text-sm text-gray-500">まだ予約はありません</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b text-left">
              <tr>
                <th className="py-2">ユーザー</th>
                <th>状態</th>
                <th>予約日時</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map(b => (
                <tr key={b.id} className="border-b">
                  <td className="py-2">{b.user_id}</td>
                  <td>{b.status}</td>
                  <td>{new Date(b.created_at).toLocaleString('ja-JP')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
```

Key changes:
- `busy` is a discriminated state (`null | 'save' | 'close' | 'delete'`), each button shows its own label and all are disabled while any operation runs
- `handleClose` shows a confirm dialog, then `router.push('/admin/lessons')` on success
- `<button>枠を閉じる</button>` is only rendered when `slot.status === 'open'`
- 3 actions all emit a success toast via `notify.success`
- Removed unused stale `notes`/`teacherId` defaults handling — preserved existing semantics

- [ ] **Step 4: Stub confirm() in the test**

Add to the top of `frontend/src/app/admin/lessons/[id]/__tests__/page.test.tsx` (inside `describe`'s `beforeEach`):

```tsx
beforeEach(() => {
  push.mockReset();
  adminUpdateSlot.mockReset();
  adminDeleteSlot.mockReset();
  get.mockReset();
  window.confirm = jest.fn(() => true);
});
```

- [ ] **Step 5: Run the test, expect pass**

Run: `cd frontend && npm test -- src/app/admin/lessons/\\[id\\]/__tests__/page.test.tsx`
Expected: 3 tests PASS.

- [ ] **Step 6: Type-check + lint**

Run:
```
cd frontend && npx tsc --noEmit
cd frontend && npm run lint -- "src/app/admin/lessons/[id]/page.tsx"
```
Expected: 0 errors / 0 warnings.

- [ ] **Step 7: Commit**

```bash
git add "frontend/src/app/admin/lessons/[id]/page.tsx" \
        "frontend/src/app/admin/lessons/[id]/__tests__/page.test.tsx"
git commit -m "fix(admin): close-slot button shows feedback + redirects (bug 1)"
```

---

## Task 5: Full regression + manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full frontend jest suite**

Run: `cd frontend && npm test`
Expected: All tests PASS. Coverage thresholds (≥70%) still met.

- [ ] **Step 2: Type-check the whole frontend**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Lint the whole frontend**

Run: `cd frontend && npm run lint`
Expected: 0 warnings.

- [ ] **Step 4: Start dev server and manually verify all 3 bugs**

```
cd /Users/kz/work/english-caf/kz-bz-english2
npm run dev  # docker-compose: frontend + backend + firestore-emulator
```

Then in the browser:

1. **Bug 2 (Header dropdown)**
   - Log in (any account)
   - Click the user-name button in the header → dropdown opens
   - Click somewhere else on the page → dropdown closes
   - Click the user button again → dropdown opens → click 「マイページ」 → navigates, dropdown is no longer open on the mypage header
2. **Bug 3 (新規枠を作成)**
   - Promote your user to admin (`uv run python scripts/grant_admin.py <uid> --grant`) and re-login
   - Go to `/admin/lessons`
   - Submit the form with start=end → see 「終了は開始より後の時刻にしてください」 error, no API call
   - Submit a valid pair → see success toast 「枠を追加しました」 + list refreshed
3. **Bug 1 (枠を閉じる)**
   - Click 「編集」 on a fresh open slot
   - Click 「枠を閉じる」 → confirm → navigates back to `/admin/lessons`; the closed slot is no longer in the list

- [ ] **Step 5: Final push + PR**

```bash
git push -u origin fix/admin-ui-bugs

gh pr create --title "fix: admin UI bug fixes (close-slot, dropdown, create-slot)" \
  --body "$(cat <<'EOF'
## Summary
- **Bug 1 (枠を閉じる)** — adds confirm + busy state + redirect, hides button when not open
- **Bug 2 (ヘッダードロップダウン)** — replaces `<details>` with controlled state, closes on outside click + Link nav + Esc
- **Bug 3 (新規枠を作成)** — wraps refresh in inner try/catch so a transient refresh failure no longer masks the successful POST; adds a success toast; awaits Firebase `authStateReady()` so the Authorization header is never silently dropped; adds client-side end>start validation

## Test plan
- [x] jest: `frontend && npm test` (Header / SlotForm / [id]/page unit tests added)
- [x] tsc + lint clean
- [ ] manual: dropdown / create / close flows on dev server

Spec: docs/superpowers/specs/2026-05-14-bugfix-admin-ui.md
EOF
)"
```

- [ ] **Step 6: Done — wait for human merge**

PR は作成のみ。マージは行わない (CLAUDE.md ルール)。

---

## Critical Files (for the implementer)

- Spec to satisfy: `docs/superpowers/specs/2026-05-14-bugfix-admin-ui.md`
- Existing notification store: `frontend/src/stores/notificationStore.ts` — uses `useNotificationStore().success(msg)` API
- Firebase auth singleton: `frontend/src/lib/firebase.ts` — exposes `firebaseAuth` with `authStateReady()`
- Test conventions: co-located under `<sibling>/__tests__/<name>.test.tsx`, `@testing-library/react` + `@testing-library/jest-dom` (already set up via `jest.setup.js`)
