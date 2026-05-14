'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { bookSlot, type LessonSlot } from '@/lib/booking';

const TYPE_LABEL: Record<LessonSlot['lesson_type'], string> = {
  trial: '無料体験レッスン',
  group: 'グループレッスン',
  private: 'プライベートレッスン',
  business: 'ビジネス英語',
  toeic: 'TOEIC対策',
  online: 'オンラインレッスン',
  other: 'その他',
};

export function SlotCard({
  slot,
  onBooked,
}: {
  slot: LessonSlot;
  onBooked: () => void;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const date = new Date(slot.start_at).toLocaleString('ja-JP', {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  const end = new Date(slot.end_at).toLocaleString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleBook = async () => {
    if (!user) {
      router.push('/login');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await bookSlot(slot.id);
      onBooked();
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })
        .response?.data?.detail;
      setError(detail ?? '予約に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  const soldOut = slot.remaining <= 0;

  return (
    <article className="rounded border bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between">
        <h3 className="text-lg font-semibold">
          {TYPE_LABEL[slot.lesson_type]}
        </h3>
        <span className="text-xs text-gray-500">{slot.status}</span>
      </div>
      <p className="mt-1 text-sm text-gray-700">
        {date} – {end}
      </p>
      <p className="mt-1 text-sm">
        残 <strong>{slot.remaining}</strong> / 定員 {slot.capacity}
      </p>
      {slot.price_yen != null && (
        <p className="mt-1 text-sm text-gray-700">
          ¥{slot.price_yen.toLocaleString()}
        </p>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={handleBook}
        disabled={busy || soldOut}
        className="mt-3 w-full rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50"
      >
        {soldOut
          ? '満席'
          : busy
            ? '予約中…'
            : user
              ? '予約する'
              : 'ログインして予約'}
      </button>
    </article>
  );
}
