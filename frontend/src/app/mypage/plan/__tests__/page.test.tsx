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
  uid: 'u',
  email: 'e',
  name: 'N',
  phone: null,
  plan: null,
  trial_used: false,
  quota_summary: null,
  stripe_subscription_id: null,
  subscription_status: null,
  subscription_cancel_at_period_end: false,
  current_period_end: null,
  created_at: '',
  updated_at: '',
  ...o,
});

describe('PlanPageClient', () => {
  const OLD = process.env.NEXT_PUBLIC_STRIPE_ENABLED;
  afterEach(() => {
    process.env.NEXT_PUBLIC_STRIPE_ENABLED = OLD;
    jest.clearAllMocks();
    for (const k of Array.from(search.keys())) search.delete(k);
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
    await waitFor(() => expect(screen.getByText('ライト')).toBeInTheDocument());
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
