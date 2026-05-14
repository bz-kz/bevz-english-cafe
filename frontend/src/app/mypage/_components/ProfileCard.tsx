'use client';

import Link from 'next/link';

interface Profile {
  uid: string;
  email: string;
  name: string;
  phone: string | null;
}

export function ProfileCard({ profile }: { profile: Profile }) {
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
      </dl>
    </section>
  );
}
