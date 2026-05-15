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
