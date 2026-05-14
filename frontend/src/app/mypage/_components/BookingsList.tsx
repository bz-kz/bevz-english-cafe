'use client';

import { useEffect, useState } from 'react';
import {
  cancelBooking,
  listMyBookings,
  type Booking,
  type LessonType,
} from '@/lib/booking';
import { useNotificationStore } from '@/stores/notificationStore';

const TYPE_LABEL: Record<LessonType, string> = {
  trial: '無料体験レッスン',
  group: 'グループレッスン',
  private: 'プライベートレッスン',
  business: 'ビジネス英語',
  toeic: 'TOEIC対策',
  online: 'オンラインレッスン',
  other: 'その他',
};

export function BookingsList() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const notify = useNotificationStore();

  useEffect(() => {
    (async () => {
      setBookings(await listMyBookings());
      setLoading(false);
    })();
  }, []);

  const handleCancel = async (id: string) => {
    if (!confirm('この予約をキャンセルしますか?')) return;
    setBusyId(id);
    try {
      const updated = await cancelBooking(id);
      setBookings(bs =>
        bs.map(b =>
          b.id === updated.id ? { ...b, status: updated.status } : b
        )
      );
      notify.success('キャンセルしました');
    } catch (e: unknown) {
      const detail =
        (e as { response?: { data?: { detail?: string } } }).response?.data
          ?.detail ?? '';
      const friendly =
        detail === 'cancel_deadline_passed'
          ? '24時間以内の予約はキャンセルできません。'
          : 'キャンセルに失敗しました';
      notify.error(friendly);
    } finally {
      setBusyId(null);
    }
  };

  if (loading)
    return (
      <section className="rounded border bg-white p-6">読み込み中…</section>
    );

  const now = Date.now();
  const upcoming = bookings.filter(
    b => b.status === 'confirmed' && new Date(b.slot.start_at).getTime() > now
  );
  const past = bookings.filter(
    b => b.status === 'cancelled' || new Date(b.slot.start_at).getTime() <= now
  );

  return (
    <section className="rounded border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">レッスン予約</h2>

      <h3 className="mt-4 text-sm font-semibold text-gray-700">今後の予約</h3>
      {upcoming.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">予約はありません</p>
      ) : (
        <ul className="mt-2 divide-y">
          {upcoming.map(b => {
            const ms24h = 24 * 60 * 60 * 1000;
            const within24h =
              new Date(b.slot.start_at).getTime() - Date.now() < ms24h;
            return (
              <li key={b.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">
                    {TYPE_LABEL[b.slot.lesson_type]}
                  </p>
                  <p className="text-sm text-gray-700">
                    {new Date(b.slot.start_at).toLocaleString('ja-JP')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCancel(b.id)}
                  disabled={busyId === b.id || within24h}
                  title={within24h ? '24時間以内はキャンセル不可' : undefined}
                  className="rounded border px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-50"
                >
                  {busyId === b.id ? 'キャンセル中…' : 'キャンセル'}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <h3 className="mt-6 text-sm font-semibold text-gray-700">
        過去・キャンセル済み
      </h3>
      {past.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">履歴はありません</p>
      ) : (
        <ul className="mt-2 divide-y">
          {past.map(b => (
            <li key={b.id} className="py-3">
              <div className="flex justify-between text-sm">
                <span className="font-medium">
                  {TYPE_LABEL[b.slot.lesson_type]}
                </span>
                <span
                  className={
                    b.status === 'cancelled' ? 'text-red-600' : 'text-gray-500'
                  }
                >
                  {b.status === 'cancelled' ? 'キャンセル済' : '受講済'}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                {new Date(b.slot.start_at).toLocaleString('ja-JP')}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
