# Frontend Plan UI (Sub-project 4c-3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/mypage/plan` so unsubscribed users buy a Stripe Checkout subscription and subscribed users see status + a Stripe Customer Portal button. Frontend only (4c-2 backend merged).

**Architecture:** New `billing.ts` API client (mirrors `booking.ts` raw-axios + private `authHeaders`). `page.tsx` is a server wrapper that puts a `<Suspense>` around a `'use client'` `PlanPageClient` (Next 14 requires Suspense around `useSearchParams`). `SubscriptionStatus` exhaustively classifies the unconstrained `subscription_status` string with a safe fallback. Feature-flagged by `NEXT_PUBLIC_STRIPE_ENABLED`.

**Tech Stack:** Next.js 14 App Router + TypeScript + Tailwind + Zustand + jest + RTL. axios mocked; `@/lib/firebase` mocked in tests.

**Spec:** [`docs/superpowers/specs/2026-05-15-frontend-plan-ui-4c3-design.md`](../specs/2026-05-15-frontend-plan-ui-4c3-design.md). Depends on 4c-2 (PR #16, MERGED).

---

## File Structure

### Create
- `frontend/src/lib/billing.ts` — `createCheckout`, `createPortal`, `NoSubscriptionError`
- `frontend/src/lib/__tests__/billing.test.ts`
- `frontend/src/app/mypage/plan/page.tsx` — server wrapper, `<Suspense>`
- `frontend/src/app/mypage/plan/_components/PlanPageClient.tsx` — `'use client'`
- `frontend/src/app/mypage/plan/_components/PlanCard.tsx`
- `frontend/src/app/mypage/plan/_components/SubscriptionStatus.tsx`
- `frontend/src/app/mypage/plan/_components/__tests__/PlanCard.test.tsx`
- `frontend/src/app/mypage/plan/_components/__tests__/SubscriptionStatus.test.tsx`
- `frontend/src/app/mypage/plan/__tests__/page.test.tsx`

### Modify
- `frontend/src/lib/booking.ts` — `MeResponse` +4 fields
- `frontend/src/app/mypage/_components/ProfileCard.tsx` — flag-gated プラン管理 link
- `frontend/src/app/mypage/_components/__tests__/ProfileCard.test.tsx` — factory +4 fields, link tests
- `frontend/.env.example` — `NEXT_PUBLIC_STRIPE_ENABLED=false`

---

## Task 1: `MeResponse` subscription fields + test-factory + env.example

**Files:**
- Modify: `frontend/src/lib/booking.ts`
- Modify: `frontend/src/app/mypage/_components/__tests__/ProfileCard.test.tsx`
- Modify: `frontend/.env.example`

- [ ] **Step 1: Extend `MeResponse`**

In `frontend/src/lib/booking.ts`, change the `MeResponse` interface (currently ends `created_at`/`updated_at`) to add 4 fields before `created_at`:

```typescript
export interface MeResponse {
  uid: string;
  email: string;
  name: string;
  phone: string | null;
  plan: Plan | null;
  trial_used: boolean;
  quota_summary: QuotaSummary | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  subscription_cancel_at_period_end: boolean;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 2: Fix ProfileCard test factory (TS now requires the 4 fields)**

In `frontend/src/app/mypage/_components/__tests__/ProfileCard.test.tsx`, the `profile()` factory must include the new required fields. Change the factory object to:

```typescript
const profile = (overrides: Partial<MeResponse> = {}): MeResponse => ({
  uid: 'u',
  email: 'e@x.com',
  name: 'N',
  phone: null,
  plan: 'light',
  trial_used: true,
  quota_summary: null,
  stripe_subscription_id: null,
  subscription_status: null,
  subscription_cancel_at_period_end: false,
  current_period_end: null,
  created_at: '',
  updated_at: '',
  ...overrides,
});
```

- [ ] **Step 3: Add env var to example**

Append to `frontend/.env.example`:

```
# Stripe (sub-project 4c) — set "true" to expose /mypage/plan UI
NEXT_PUBLIC_STRIPE_ENABLED=false
```

- [ ] **Step 4: Verify typecheck + existing ProfileCard tests still green**

Run: `cd frontend && npx tsc --noEmit && npx jest ProfileCard`
Expected: tsc clean; existing ProfileCard tests pass (factory now satisfies TS, assertions unchanged).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/booking.ts frontend/src/app/mypage/_components/__tests__/ProfileCard.test.tsx frontend/.env.example
git commit -m "feat(billing): MeResponse subscription fields + env flag example"
```

---

## Task 2: `billing.ts` API client

**Files:**
- Create: `frontend/src/lib/billing.ts`
- Test: `frontend/src/lib/__tests__/billing.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/__tests__/billing.test.ts`:

```typescript
import axios from 'axios';
import {
  createCheckout,
  createPortal,
  NoSubscriptionError,
} from '../billing';

jest.mock('axios');
jest.mock('@/lib/firebase', () => ({
  firebaseAuth: {
    authStateReady: jest.fn().mockResolvedValue(undefined),
    currentUser: { getIdToken: jest.fn().mockResolvedValue('tok') },
  },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('billing lib', () => {
  afterEach(() => jest.clearAllMocks());

  it('createCheckout posts plan and returns url', async () => {
    mockedAxios.post.mockResolvedValue({ data: { url: 'https://co/x' } });
    const url = await createCheckout('standard');
    expect(url).toBe('https://co/x');
    const [endpoint, body] = mockedAxios.post.mock.calls[0];
    expect(endpoint).toMatch(/\/api\/v1\/billing\/checkout$/);
    expect(body).toEqual({ plan: 'standard' });
  });

  it('createPortal returns url', async () => {
    mockedAxios.post.mockResolvedValue({ data: { url: 'https://portal/x' } });
    expect(await createPortal()).toBe('https://portal/x');
  });

  it('createPortal throws NoSubscriptionError on 409 no_subscription', async () => {
    mockedAxios.post.mockRejectedValue({
      response: { status: 409, data: { detail: { code: 'no_subscription' } } },
    });
    await expect(createPortal()).rejects.toBeInstanceOf(NoSubscriptionError);
  });

  it('createPortal rethrows other errors', async () => {
    const err = { response: { status: 500, data: {} } };
    mockedAxios.post.mockRejectedValue(err);
    await expect(createPortal()).rejects.toBe(err);
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `cd frontend && npx jest billing.test`
Expected: FAIL — Cannot find module '../billing'.

- [ ] **Step 3: Implement**

Create `frontend/src/lib/billing.ts`:

```typescript
import axios from 'axios';
import { firebaseAuth } from '@/lib/firebase';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8010';

export class NoSubscriptionError extends Error {
  constructor() {
    super('no_subscription');
    this.name = 'NoSubscriptionError';
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  await firebaseAuth.authStateReady();
  const user = firebaseAuth.currentUser;
  if (!user) return {};
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

export async function createCheckout(
  plan: 'light' | 'standard' | 'intensive'
): Promise<string> {
  const resp = await axios.post<{ url: string }>(
    `${API_BASE}/api/v1/billing/checkout`,
    { plan },
    { headers: await authHeaders() }
  );
  return resp.data.url;
}

export async function createPortal(): Promise<string> {
  try {
    const resp = await axios.post<{ url: string }>(
      `${API_BASE}/api/v1/billing/portal`,
      {},
      { headers: await authHeaders() }
    );
    return resp.data.url;
  } catch (e: unknown) {
    const err = e as {
      response?: { status?: number; data?: { detail?: { code?: string } } };
    };
    if (
      err.response?.status === 409 &&
      err.response.data?.detail?.code === 'no_subscription'
    ) {
      throw new NoSubscriptionError();
    }
    throw e;
  }
}
```

- [ ] **Step 4: Run — expect pass**

Run: `cd frontend && npx jest billing.test`
Expected: 4 passed.

- [ ] **Step 5: Typecheck + lint + commit**

```bash
cd frontend && npx tsc --noEmit && npm run lint
git add frontend/src/lib/billing.ts frontend/src/lib/__tests__/billing.test.ts
git commit -m "feat(billing): createCheckout/createPortal API client + NoSubscriptionError"
```

---

## Task 3: `PlanCard` component

**Files:**
- Create: `frontend/src/app/mypage/plan/_components/PlanCard.tsx`
- Test: `frontend/src/app/mypage/plan/_components/__tests__/PlanCard.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/app/mypage/plan/_components/__tests__/PlanCard.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { PlanCard } from '../PlanCard';

describe('PlanCard', () => {
  it('shows name, price, coma and a 選択 button', () => {
    const onSelect = jest.fn();
    render(
      <PlanCard
        plan="standard"
        currentPlan={null}
        onSelect={onSelect}
        busy={false}
      />
    );
    expect(screen.getByText('スタンダード')).toBeInTheDocument();
    expect(screen.getByText(/¥10,000/)).toBeInTheDocument();
    expect(screen.getByText(/8 コマ/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /選択/ }));
    expect(onSelect).toHaveBeenCalledWith('standard');
  });

  it('disables and shows ご利用中 for the current plan', () => {
    render(
      <PlanCard
        plan="light"
        currentPlan="light"
        onSelect={jest.fn()}
        busy={false}
      />
    );
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent('ご利用中');
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `cd frontend && npx jest PlanCard`
Expected: FAIL — Cannot find module '../PlanCard'.

- [ ] **Step 3: Implement**

Create `frontend/src/app/mypage/plan/_components/PlanCard.tsx`:

```typescript
'use client';

import type { Plan } from '@/lib/booking';

const PLAN_INFO: Record<
  Plan,
  { label: string; price: string; coma: number }
> = {
  light: { label: 'ライト', price: '6,000', coma: 4 },
  standard: { label: 'スタンダード', price: '10,000', coma: 8 },
  intensive: { label: '集中', price: '15,000', coma: 16 },
};

interface Props {
  plan: Plan;
  currentPlan: Plan | null;
  onSelect: (plan: Plan) => void;
  busy: boolean;
}

export function PlanCard({ plan, currentPlan, onSelect, busy }: Props) {
  const info = PLAN_INFO[plan];
  const isCurrent = plan === currentPlan;
  return (
    <div className="flex flex-col rounded border bg-white p-4 text-center shadow-sm">
      <h3 className="text-lg font-semibold">{info.label}</h3>
      <p className="mt-2 text-2xl font-bold">¥{info.price}</p>
      <p className="text-xs text-gray-500">/ 月 (税抜)</p>
      <p className="mt-2 text-sm">{info.coma} コマ</p>
      <button
        type="button"
        disabled={isCurrent || busy}
        onClick={() => onSelect(plan)}
        className="mt-4 rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:bg-gray-300"
      >
        {isCurrent ? 'ご利用中' : '選択'}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run — expect pass**

Run: `cd frontend && npx jest PlanCard`
Expected: 2 passed.

- [ ] **Step 5: Typecheck + lint + commit**

```bash
cd frontend && npx tsc --noEmit && npm run lint
git add frontend/src/app/mypage/plan/_components/PlanCard.tsx frontend/src/app/mypage/plan/_components/__tests__/PlanCard.test.tsx
git commit -m "feat(plan-ui): PlanCard component"
```

---

## Task 4: `SubscriptionStatus` component (exhaustive classification)

**Files:**
- Create: `frontend/src/app/mypage/plan/_components/SubscriptionStatus.tsx`
- Test: `frontend/src/app/mypage/plan/_components/__tests__/SubscriptionStatus.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/app/mypage/plan/_components/__tests__/SubscriptionStatus.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { SubscriptionStatus } from '../SubscriptionStatus';
import type { MeResponse } from '@/lib/booking';

const me = (o: Partial<MeResponse> = {}): MeResponse => ({
  uid: 'u',
  email: 'e@x.com',
  name: 'N',
  phone: null,
  plan: 'standard',
  trial_used: false,
  quota_summary: null,
  stripe_subscription_id: 'sub_1',
  subscription_status: 'active',
  subscription_cancel_at_period_end: false,
  current_period_end: '2026-07-15T00:00:00Z',
  created_at: '',
  updated_at: '',
  ...o,
});

describe('SubscriptionStatus', () => {
  it('active shows ご利用中 + next renewal + portal button', () => {
    const onPortal = jest.fn();
    render(
      <SubscriptionStatus profile={me()} onPortal={onPortal} busy={false} />
    );
    expect(screen.getByText(/ご利用中/)).toBeInTheDocument();
    expect(screen.getByText(/次回更新/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button'));
    expect(onPortal).toHaveBeenCalled();
  });

  it('cancel_at_period_end shows the yellow scheduled-cancel banner', () => {
    render(
      <SubscriptionStatus
        profile={me({ subscription_cancel_at_period_end: true })}
        onPortal={jest.fn()}
        busy={false}
      />
    );
    expect(screen.getByText(/解約予定/)).toBeInTheDocument();
  });

  it('cancel_at_period_end with null period end omits the date clause', () => {
    render(
      <SubscriptionStatus
        profile={me({
          subscription_cancel_at_period_end: true,
          current_period_end: null,
        })}
        onPortal={jest.fn()}
        busy={false}
      />
    );
    const banner = screen.getByText(/解約予定/);
    expect(banner.textContent).not.toMatch(/Invalid Date/);
  });

  it('past_due shows the red banner', () => {
    render(
      <SubscriptionStatus
        profile={me({ subscription_status: 'past_due' })}
        onPortal={jest.fn()}
        busy={false}
      />
    );
    expect(
      screen.getByText(/お支払いが確認できませんでした/)
    ).toBeInTheDocument();
  });

  it('unpaid/incomplete are treated like past_due (red banner)', () => {
    for (const s of ['unpaid', 'incomplete', 'incomplete_expired']) {
      const { unmount } = render(
        <SubscriptionStatus
          profile={me({ subscription_status: s })}
          onPortal={jest.fn()}
          busy={false}
        />
      );
      expect(
        screen.getByText(/お支払いが確認できませんでした/)
      ).toBeInTheDocument();
      unmount();
    }
  });

  it('unknown non-null status falls back to a warning banner (not blank)', () => {
    render(
      <SubscriptionStatus
        profile={me({ subscription_status: 'foo_bar' })}
        onPortal={jest.fn()}
        busy={false}
      />
    );
    expect(screen.getByText(/状態をご確認ください/)).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `cd frontend && npx jest SubscriptionStatus`
Expected: FAIL — Cannot find module '../SubscriptionStatus'.

- [ ] **Step 3: Implement**

Create `frontend/src/app/mypage/plan/_components/SubscriptionStatus.tsx`:

```typescript
'use client';

import type { MeResponse, Plan } from '@/lib/booking';

const PLAN_LABEL: Record<Plan, string> = {
  light: 'ライト',
  standard: 'スタンダード',
  intensive: '集中',
};

const PROBLEM_STATUSES = [
  'past_due',
  'unpaid',
  'incomplete',
  'incomplete_expired',
];
const ACTIVE_STATUSES = ['active', 'trialing'];

interface Props {
  profile: MeResponse;
  onPortal: () => void;
  busy: boolean;
}

function PortalButton({
  onPortal,
  busy,
  danger,
}: {
  onPortal: () => void;
  busy: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onPortal}
      disabled={busy}
      className={`mt-3 rounded px-4 py-2 text-sm text-white disabled:opacity-50 ${
        danger ? 'bg-red-600' : 'bg-blue-600'
      }`}
    >
      支払い・プラン変更・解約を管理
    </button>
  );
}

export function SubscriptionStatus({ profile, onPortal, busy }: Props) {
  const status = profile.subscription_status;
  const planLabel = profile.plan ? PLAN_LABEL[profile.plan] : '—';
  const endDate = profile.current_period_end
    ? new Date(profile.current_period_end).toLocaleDateString('ja-JP')
    : null;

  if (status && PROBLEM_STATUSES.includes(status)) {
    return (
      <div className="rounded border border-red-300 bg-red-50 p-4 text-red-700">
        <p className="font-semibold">
          お支払いが確認できませんでした。
        </p>
        <p className="text-sm">
          下のボタンから支払い方法を更新してください。
        </p>
        <PortalButton onPortal={onPortal} busy={busy} danger />
      </div>
    );
  }

  if (status && ACTIVE_STATUSES.includes(status)) {
    if (profile.subscription_cancel_at_period_end) {
      return (
        <div className="rounded border border-yellow-300 bg-yellow-50 p-4 text-yellow-800">
          <p className="font-semibold">
            {endDate ? `${endDate} に解約予定です。` : '解約予定です。'}
            継続する場合は管理画面で取り消してください。
          </p>
          <PortalButton onPortal={onPortal} busy={busy} />
        </div>
      );
    }
    return (
      <div className="rounded border bg-white p-4">
        <p className="font-semibold">ご利用中: {planLabel}</p>
        {endDate && (
          <p className="text-sm text-gray-600">次回更新: {endDate}</p>
        )}
        <PortalButton onPortal={onPortal} busy={busy} />
      </div>
    );
  }

  // unknown non-null status — safe fallback, never blank
  return (
    <div className="rounded border border-yellow-300 bg-yellow-50 p-4 text-yellow-800">
      <p className="font-semibold">
        サブスクリプションの状態をご確認ください (状態: {status})
      </p>
      <PortalButton onPortal={onPortal} busy={busy} />
    </div>
  );
}
```

- [ ] **Step 4: Run — expect pass**

Run: `cd frontend && npx jest SubscriptionStatus`
Expected: 6 passed.

- [ ] **Step 5: Typecheck + lint + commit**

```bash
cd frontend && npx tsc --noEmit && npm run lint
git add frontend/src/app/mypage/plan/_components/SubscriptionStatus.tsx frontend/src/app/mypage/plan/_components/__tests__/SubscriptionStatus.test.tsx
git commit -m "feat(plan-ui): SubscriptionStatus with exhaustive status classification"
```

---

## Task 5: `PlanPageClient` + `page.tsx` (Suspense wrapper)

**Files:**
- Create: `frontend/src/app/mypage/plan/_components/PlanPageClient.tsx`
- Create: `frontend/src/app/mypage/plan/page.tsx`
- Test: `frontend/src/app/mypage/plan/__tests__/page.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/app/mypage/plan/__tests__/page.test.tsx`:

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { PlanPageClient } from '../_components/PlanPageClient';
import * as booking from '@/lib/booking';
import * as billing from '@/lib/billing';

jest.mock('@/lib/booking');
jest.mock('@/lib/billing');
jest.mock('@/lib/firebase', () => ({
  firebaseAuth: { authStateReady: jest.fn(), currentUser: {} },
}));

const search = new URLSearchParams();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => search,
}));

const notify = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock('@/stores/notificationStore', () => ({
  useNotificationStore: () => notify,
}));
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'u' }, loading: false }),
}));

const mb = booking as jest.Mocked<typeof booking>;

const me = (o = {}) => ({
  uid: 'u', email: 'e', name: 'N', phone: null, plan: null,
  trial_used: false, quota_summary: null, stripe_subscription_id: null,
  subscription_status: null, subscription_cancel_at_period_end: false,
  current_period_end: null, created_at: '', updated_at: '', ...o,
});

describe('PlanPageClient', () => {
  const OLD = process.env.NEXT_PUBLIC_STRIPE_ENABLED;
  afterEach(() => {
    process.env.NEXT_PUBLIC_STRIPE_ENABLED = OLD;
    jest.clearAllMocks();
    for (const k of [...search.keys()]) search.delete(k);
  });

  it('shows 準備中 when flag is off', () => {
    process.env.NEXT_PUBLIC_STRIPE_ENABLED = 'false';
    render(<PlanPageClient />);
    expect(screen.getByText(/準備中/)).toBeInTheDocument();
  });

  it('shows PlanCard x3 when unsubscribed', async () => {
    process.env.NEXT_PUBLIC_STRIPE_ENABLED = 'true';
    mb.getMe.mockResolvedValue(me());
    render(<PlanPageClient />);
    await waitFor(() =>
      expect(screen.getByText('ライト')).toBeInTheDocument()
    );
    expect(screen.getByText('スタンダード')).toBeInTheDocument();
    expect(screen.getByText('集中')).toBeInTheDocument();
  });

  it('shows SubscriptionStatus when subscribed (active)', async () => {
    process.env.NEXT_PUBLIC_STRIPE_ENABLED = 'true';
    mb.getMe.mockResolvedValue(
      me({ subscription_status: 'active', plan: 'standard' })
    );
    render(<PlanPageClient />);
    await waitFor(() =>
      expect(screen.getByText(/ご利用中/)).toBeInTheDocument()
    );
  });

  it('?status=success → success toast + getMe re-fetched', async () => {
    process.env.NEXT_PUBLIC_STRIPE_ENABLED = 'true';
    search.set('status', 'success');
    mb.getMe.mockResolvedValue(me());
    render(<PlanPageClient />);
    await waitFor(() => expect(notify.success).toHaveBeenCalled());
    expect(mb.getMe.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('?status=cancel → info toast', async () => {
    process.env.NEXT_PUBLIC_STRIPE_ENABLED = 'true';
    search.set('status', 'cancel');
    mb.getMe.mockResolvedValue(me());
    render(<PlanPageClient />);
    await waitFor(() => expect(notify.info).toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `cd frontend && npx jest mypage/plan/__tests__/page`
Expected: FAIL — Cannot find module '../_components/PlanPageClient'.

- [ ] **Step 3: Implement `PlanPageClient`**

Create `frontend/src/app/mypage/plan/_components/PlanPageClient.tsx`:

```typescript
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getMe, type MeResponse, type Plan } from '@/lib/booking';
import {
  createCheckout,
  createPortal,
  NoSubscriptionError,
} from '@/lib/billing';
import { useNotificationStore } from '@/stores/notificationStore';
import { PlanCard } from './PlanCard';
import { SubscriptionStatus } from './SubscriptionStatus';

const FLAG_ON = process.env.NEXT_PUBLIC_STRIPE_ENABLED === 'true';
const ALL_PLANS: Plan[] = ['light', 'standard', 'intensive'];

export function PlanPageClient() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const search = useSearchParams();
  const notify = useNotificationStore();
  const [profile, setProfile] = useState<MeResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const statusHandled = useRef(false);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  const load = useCallback(async () => {
    try {
      setProfile(await getMe());
    } catch {
      notify.error('読み込みに失敗しました');
    }
  }, [notify]);

  useEffect(() => {
    if (!FLAG_ON || !user) return;
    load();
  }, [user, load]);

  useEffect(() => {
    if (!FLAG_ON || statusHandled.current) return;
    const s = search.get('status');
    if (s === 'success') {
      statusHandled.current = true;
      notify.success('ご登録ありがとうございます');
      load();
    } else if (s === 'cancel') {
      statusHandled.current = true;
      notify.info('お手続きをキャンセルしました');
    }
  }, [search, notify, load]);

  if (!FLAG_ON) {
    return <div className="p-6 text-center">準備中です</div>;
  }
  if (loading || !user || !profile) {
    return <div className="p-6 text-center">読み込み中…</div>;
  }

  const onSelect = async (plan: Plan) => {
    setBusy(true);
    try {
      window.location.href = await createCheckout(plan);
    } catch {
      notify.error('チェックアウトを開始できませんでした');
      setBusy(false);
    }
  };

  const onPortal = async () => {
    setBusy(true);
    try {
      window.location.href = await createPortal();
    } catch (e) {
      if (e instanceof NoSubscriptionError) {
        notify.error('まだ加入していません');
      } else {
        notify.error('管理画面を開けませんでした');
      }
      setBusy(false);
    }
  };

  const subscribed =
    profile.subscription_status != null &&
    profile.subscription_status !== 'canceled';

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">プラン</h1>
      {subscribed ? (
        <SubscriptionStatus
          profile={profile}
          onPortal={onPortal}
          busy={busy}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {ALL_PLANS.map(p => (
              <PlanCard
                key={p}
                plan={p}
                currentPlan={profile.plan}
                onSelect={onSelect}
                busy={busy}
              />
            ))}
          </div>
          <p className="text-xs text-gray-500">
            価格は税抜です。決済時に消費税 10% が加算されます。
          </p>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Implement `page.tsx` (Suspense wrapper)**

Create `frontend/src/app/mypage/plan/page.tsx`:

```typescript
import { Suspense } from 'react';
import { PlanPageClient } from './_components/PlanPageClient';

export default function PlanPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center">読み込み中…</div>}>
      <PlanPageClient />
    </Suspense>
  );
}
```

- [ ] **Step 5: Run — expect pass**

Run: `cd frontend && npx jest mypage/plan/__tests__/page`
Expected: 5 passed.

- [ ] **Step 6: Production build sanity (Suspense boundary)**

Run: `cd frontend && npx tsc --noEmit && npm run lint`
Expected: clean (the `<Suspense>` wrapper prevents the `useSearchParams` prerender error; full `npm run build` is run in Task 7).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/mypage/plan/page.tsx frontend/src/app/mypage/plan/_components/PlanPageClient.tsx frontend/src/app/mypage/plan/__tests__/page.test.tsx
git commit -m "feat(plan-ui): PlanPageClient + Suspense page wrapper"
```

---

## Task 6: ProfileCard プラン管理 link (flag-gated)

**Files:**
- Modify: `frontend/src/app/mypage/_components/ProfileCard.tsx`
- Modify: `frontend/src/app/mypage/_components/__tests__/ProfileCard.test.tsx`

- [ ] **Step 1: Write the failing tests**

Append to `frontend/src/app/mypage/_components/__tests__/ProfileCard.test.tsx`:

```typescript
  it('shows プラン管理 link when stripe flag is on', () => {
    const OLD = process.env.NEXT_PUBLIC_STRIPE_ENABLED;
    process.env.NEXT_PUBLIC_STRIPE_ENABLED = 'true';
    render(<ProfileCard profile={profile()} />);
    expect(
      screen.getByRole('link', { name: /プラン管理/ })
    ).toHaveAttribute('href', '/mypage/plan');
    process.env.NEXT_PUBLIC_STRIPE_ENABLED = OLD;
  });

  it('hides プラン管理 link when stripe flag is off', () => {
    const OLD = process.env.NEXT_PUBLIC_STRIPE_ENABLED;
    process.env.NEXT_PUBLIC_STRIPE_ENABLED = 'false';
    render(<ProfileCard profile={profile()} />);
    expect(screen.queryByRole('link', { name: /プラン管理/ })).toBeNull();
    process.env.NEXT_PUBLIC_STRIPE_ENABLED = OLD;
  });
```

> Note: `NEXT_PUBLIC_*` is normally inlined at build, but jest runs un-inlined so `process.env.NEXT_PUBLIC_STRIPE_ENABLED` reads dynamically — read it inside the component render path (not a module-level const) so the tests can toggle it. See Step 3.

- [ ] **Step 2: Run — expect failure**

Run: `cd frontend && npx jest ProfileCard`
Expected: FAIL — no link with name プラン管理.

- [ ] **Step 3: Add the link (read flag at render, not module-level)**

In `frontend/src/app/mypage/_components/ProfileCard.tsx`, locate the plan display block (the `<div className="flex">` containing `プラン` `<dt>`). Immediately after that block, inside the same `<dl>`, add:

```tsx
        {process.env.NEXT_PUBLIC_STRIPE_ENABLED === 'true' && (
          <div className="flex">
            <dt className="w-32 text-gray-500" />
            <dd>
              <Link
                href="/mypage/plan"
                className="text-sm text-blue-600 hover:underline"
              >
                プラン管理
              </Link>
            </dd>
          </div>
        )}
```

Ensure `import Link from 'next/link';` is present at the top of `ProfileCard.tsx` (it already imports `Link` for the 編集 link — verify; if not, add it).

- [ ] **Step 4: Run — expect pass**

Run: `cd frontend && npx jest ProfileCard`
Expected: all ProfileCard tests pass (existing quota assertions + 2 new link tests).

- [ ] **Step 5: Typecheck + lint + commit**

```bash
cd frontend && npx tsc --noEmit && npm run lint
git add frontend/src/app/mypage/_components/ProfileCard.tsx frontend/src/app/mypage/_components/__tests__/ProfileCard.test.tsx
git commit -m "feat(mypage): flag-gated プラン管理 link in ProfileCard"
```

---

## Task 7: Full verification + PR

- [ ] **Step 1: Full frontend test suite**

Run: `cd frontend && npx jest`
Expected: all new + existing green. Pre-existing 3 Firebase-env failures (`api.test.ts`, `ContactForm.test.tsx`, `contact-form.integration.test.tsx`) may remain — unrelated, do not fix.

- [ ] **Step 2: Typecheck + lint**

Run: `cd frontend && npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 3: Production build (verifies Suspense boundary)**

Run: `cd frontend && npm run build`
Expected: build succeeds — specifically NO `useSearchParams() should be wrapped in a suspense boundary` error for `/mypage/plan` (the Task 5 `<Suspense>` wrapper prevents it). If the build errors on that, the wrapper is wrong — fix before pushing.

- [ ] **Step 4: Push + PR**

```bash
git push -u origin <branch>
gh pr create --title "feat(frontend): /mypage/plan + Stripe Customer Portal (4c-3)" --body "$(cat <<'EOF'
## Summary
sub-project 4c-3: `/mypage/plan` — 未加入は 3 プラン Stripe Checkout、加入済は契約状況 + Stripe Customer Portal ボタン。Frontend のみ (4c-2 backend マージ済)。

## What's included
- `billing.ts` (createCheckout/createPortal/NoSubscriptionError)
- `MeResponse` +4 subscription フィールド
- `PlanCard` ×3 (¥6000/10000/15000 税抜)
- `SubscriptionStatus` — status 網羅分類 (past_due/unpaid/incomplete=赤, cancel予定=黄, active=ご利用中, 未知値=安全フォールバック)
- `page.tsx` server wrapper + `<Suspense>` + `PlanPageClient` (Next14 useSearchParams 要件)
- ProfileCard flag-gated プラン管理リンク
- `NEXT_PUBLIC_STRIPE_ENABLED` で UI gate (.env.example 登録済)

## Test plan
- [x] jest: billing/PlanCard/SubscriptionStatus/PlanPageClient/ProfileCard green
- [x] tsc + eslint clean
- [x] `npm run build` 成功 (Suspense 境界で useSearchParams prerender エラー無し)
- [ ] **本番有効化 (ops)**: HCP `english-cafe-prod-vercel` の `env_vars` に `NEXT_PUBLIC_STRIPE_ENABLED="true"` 追加 (4c-2 の Stripe Dashboard/secret と同じ ops チェックリスト)

## Depends on
4c-2 (PR #16, merged). 全 additive。

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

(Do NOT merge — PR creation only per project rule.)

---

## Spec Coverage Self-Check

| Spec requirement | Task |
|---|---|
| `billing.ts` createCheckout/createPortal/NoSubscriptionError + 409 path | 2 |
| `MeResponse` +4 fields (string\|null status, C1) | 1 |
| feature flag gate + .env.example registration (I2) | 1, 5, 6 |
| `PlanCard` ×3 price/coma, current=ご利用中 disabled | 3 |
| `SubscriptionStatus` exhaustive: problem→red / active→ご利用中 / cancel→yellow / unknown→fallback (C1) | 4 |
| Q1 null current_period_end in cancel banner | 4 |
| `page.tsx` Suspense wrapper + PlanPageClient useSearchParams (I1) | 5 |
| ?status=success → success+refetch / ?status=cancel → info | 5 |
| useAuth guard, error handling matrix | 5 |
| ProfileCard flag-gated link + test factory +4 fields (M3) | 1, 6 |
| build passes (Suspense verified) | 7 |
| PR-only, no merge | 7 |
