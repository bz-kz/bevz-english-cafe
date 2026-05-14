'use client';

import { useAdminGuard } from '@/hooks/useAdminGuard';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAdmin, loading } = useAdminGuard();
  if (loading || !isAdmin) {
    return <div className="p-6 text-center">確認中…</div>;
  }
  return (
    <div className="mx-auto max-w-6xl p-6">
      <header className="mb-6 border-b pb-3">
        <h1 className="text-xl font-bold">Admin</h1>
      </header>
      {children}
    </div>
  );
}
