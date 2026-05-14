'use client';

interface ContactItem {
  id: string;
  created_at: string;
  lesson_type: string;
  message: string;
  status: string;
}

const STATUS_LABEL: Record<string, string> = {
  pending: '未対応',
  processed: '対応済み',
  in_progress: '対応中',
};

export function ContactHistory({ contacts }: { contacts: ContactItem[] }) {
  if (contacts.length === 0) {
    return (
      <section className="rounded border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">問い合わせ履歴</h2>
        <p className="mt-4 text-gray-500">まだ問い合わせはありません</p>
      </section>
    );
  }
  return (
    <section className="rounded border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">問い合わせ履歴</h2>
      <ul className="mt-4 divide-y">
        {contacts.map(c => (
          <li key={c.id} className="py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">
                {new Date(c.created_at).toLocaleString('ja-JP')}
              </span>
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs">
                {STATUS_LABEL[c.status] ?? c.status}
              </span>
            </div>
            <p className="mt-1 text-sm font-medium">{c.lesson_type}</p>
            <p className="mt-1 line-clamp-2 text-sm text-gray-700">
              {c.message}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
