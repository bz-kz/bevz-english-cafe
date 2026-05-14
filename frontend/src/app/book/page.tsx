'use client';

import { useCallback, useEffect, useState } from 'react';
import { listOpenSlots, type LessonSlot } from '@/lib/booking';
import { SlotCard } from './_components/SlotCard';

export default function BookPage() {
  const [slots, setSlots] = useState<LessonSlot[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setSlots(await listOpenSlots());
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-3xl font-bold">レッスン予約</h1>
      {loading ? (
        <p>読み込み中…</p>
      ) : slots.length === 0 ? (
        <p className="text-gray-500">現在予約可能な枠はありません</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {slots.map(slot => (
            <SlotCard key={slot.id} slot={slot} onBooked={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}
