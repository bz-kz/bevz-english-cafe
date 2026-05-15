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
        <p className="font-semibold">お支払いが確認できませんでした。</p>
        <p className="text-sm">下のボタンから支払い方法を更新してください。</p>
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
