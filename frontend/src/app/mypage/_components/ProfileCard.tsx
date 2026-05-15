'use client';

import Link from 'next/link';
import type { MeResponse, Plan } from '@/lib/booking';

const PLAN_LABEL: Record<Plan, string> = {
  light: 'ライトプラン',
  standard: 'スタンダードプラン',
  intensive: '集中プラン',
};

export function ProfileCard({ profile }: { profile: MeResponse }) {
  return (
    <section className="rounded border bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">プロフィール</h2>
        <Link
          href="/mypage/edit"
          className="text-sm text-blue-600 hover:underline"
        >
          編集
        </Link>
      </div>
      <dl className="mt-4 space-y-3">
        <div className="flex">
          <dt className="w-32 text-gray-500">お名前</dt>
          <dd>{profile.name}</dd>
        </div>
        <div className="flex">
          <dt className="w-32 text-gray-500">メール</dt>
          <dd>{profile.email}</dd>
        </div>
        <div className="flex">
          <dt className="w-32 text-gray-500">電話</dt>
          <dd>
            {profile.phone ?? <span className="text-gray-400">未設定</span>}
          </dd>
        </div>
        <div className="flex">
          <dt className="w-32 text-gray-500">プラン</dt>
          <dd>
            {profile.plan ? (
              <strong>{PLAN_LABEL[profile.plan]}</strong>
            ) : (
              <span className="text-gray-400">未契約</span>
            )}
          </dd>
        </div>
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
        {profile.quota_summary && (
          <div className="flex">
            <dt className="w-32 text-gray-500">コマ残高</dt>
            <dd>
              残 {profile.quota_summary.total_remaining}
              {profile.quota_summary.next_expiry && (
                <span className="ml-2 text-xs text-gray-400">
                  (最短失効{' '}
                  {new Date(
                    profile.quota_summary.next_expiry
                  ).toLocaleDateString('ja-JP')}
                  )
                </span>
              )}
            </dd>
          </div>
        )}
        {!profile.trial_used && (
          <div className="flex">
            <dt className="w-32 text-gray-500" />
            <dd>
              <span className="rounded bg-green-50 px-2 py-1 text-xs text-green-700">
                無料体験予約あり
              </span>
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}
