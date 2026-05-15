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

const ALL_PLANS: Plan[] = ['light', 'standard', 'intensive'];

export function PlanPageClient() {
  // (C1) read the flag at RENDER time, not a module-level const — jest
  // toggles process.env per-test after import; a module const would freeze.
  // Same pattern as ProfileCard (Task 6).
  const flagOn = process.env.NEXT_PUBLIC_STRIPE_ENABLED === 'true';
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
    if (!flagOn || !user) return;
    load();
  }, [user, load, flagOn]);

  useEffect(() => {
    if (!flagOn || statusHandled.current) return;
    const s = search.get('status');
    if (s === 'success') {
      statusHandled.current = true;
      notify.success('ご登録ありがとうございます');
      load();
    } else if (s === 'cancel') {
      statusHandled.current = true;
      notify.info('お手続きをキャンセルしました');
    }
  }, [search, notify, load, flagOn]);

  if (!flagOn) {
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
        <SubscriptionStatus profile={profile} onPortal={onPortal} busy={busy} />
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
