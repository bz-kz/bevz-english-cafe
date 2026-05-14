'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import {
  bookSlot,
  listMyBookingsInRange,
  listSlotsInRange,
  type Booking,
  type LessonSlot,
} from '@/lib/booking';
import { useNotificationStore } from '@/stores/notificationStore';
import { BookingGrid } from './_components/BookingGrid';
import { BookingConfirmDialog } from './_components/BookingConfirmDialog';

const DAYS = 14;

function jstMidnightToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function BookPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const notify = useNotificationStore();
  const [startDate] = useState<Date>(jstMidnightToday());
  const [slots, setSlots] = useState<LessonSlot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<LessonSlot | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const end = new Date(startDate);
    end.setDate(end.getDate() + DAYS);
    const from = startDate.toISOString();
    const to = end.toISOString();
    const [s, b] = await Promise.all([
      listSlotsInRange(from, to),
      user
        ? listMyBookingsInRange(from, to).catch(() => [] as Booking[])
        : Promise.resolve([] as Booking[]),
    ]);
    setSlots(s);
    setBookings(b);
    setLoading(false);
  }, [startDate, user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCellClick = (slot: LessonSlot) => {
    if (!user) {
      router.push('/login');
      return;
    }
    setPending(slot);
  };

  const handleConfirm = async () => {
    if (!pending) return;
    try {
      await bookSlot(pending.id);
      notify.success('予約しました');
      setPending(null);
      await refresh();
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })
        .response?.data?.detail;
      notify.error(detail ?? '予約に失敗しました');
      setPending(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4">
      <h1 className="text-2xl font-bold">レッスン予約</h1>
      {!user && (
        <p className="text-sm text-gray-600">
          ○ をクリックすると、ログイン画面に進みます。
        </p>
      )}
      {loading ? (
        <p>読み込み中…</p>
      ) : (
        <BookingGrid
          startDate={startDate}
          slots={slots}
          bookings={bookings}
          onCellClick={handleCellClick}
        />
      )}
      <BookingConfirmDialog
        slot={pending}
        onConfirm={handleConfirm}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
