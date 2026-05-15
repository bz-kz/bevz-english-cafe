import { render, screen } from '@testing-library/react';
import { ProfileCard } from '../ProfileCard';
import type { MeResponse } from '@/lib/booking';

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

describe('ProfileCard', () => {
  it('renders aggregate quota when quota_summary present', () => {
    render(
      <ProfileCard
        profile={profile({
          quota_summary: {
            total_remaining: 7,
            next_expiry: '2026-07-15T00:00:00Z',
          },
        })}
      />
    );
    expect(screen.getByText(/残 7/)).toBeInTheDocument();
    expect(screen.getByText(/最短失効/)).toBeInTheDocument();
  });

  it('omits the expiry note when next_expiry is null', () => {
    render(
      <ProfileCard
        profile={profile({
          quota_summary: { total_remaining: 4, next_expiry: null },
        })}
      />
    );
    expect(screen.getByText(/残 4/)).toBeInTheDocument();
    expect(screen.queryByText(/最短失効/)).not.toBeInTheDocument();
  });

  it('hides the quota row when quota_summary is null', () => {
    render(<ProfileCard profile={profile({ quota_summary: null })} />);
    expect(screen.queryByText('コマ残高')).not.toBeInTheDocument();
  });
});
