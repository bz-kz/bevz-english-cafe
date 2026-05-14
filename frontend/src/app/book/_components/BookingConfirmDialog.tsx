'use client';

import type { LessonSlot } from '@/lib/booking';

export function BookingConfirmDialog({
  slot,
  onConfirm,
  onCancel,
}: {
  slot: LessonSlot | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!slot) return null;
  const start = new Date(slot.start_at);
  const dateLabel = start.toLocaleString('ja-JP', {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30">
      <div className="w-80 rounded bg-white p-4 shadow">
        <p className="mb-3 text-sm">{dateLabel} のレッスンを予約しますか?</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border px-3 py-1 text-sm"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded bg-blue-600 px-3 py-1 text-sm text-white"
          >
            予約する
          </button>
        </div>
      </div>
    </div>
  );
}
