'use client';

import { useMemo } from 'react';
import type { Booking, LessonSlot } from '@/lib/booking';
import { SlotCell, type CellState } from './SlotCell';

const TIME_SLOTS: { hour: number; minute: number; label: string }[] = (() => {
  const out: { hour: number; minute: number; label: string }[] = [];
  for (let h = 9; h < 16; h++) {
    for (const m of [0, 30] as const) {
      out.push({ hour: h, minute: m, label: `${h}:${m === 0 ? '00' : '30'}` });
    }
  }
  return out;
})();

const DAYS = 14;

function formatDayHeader(date: Date): string {
  return date.toLocaleDateString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  });
}

function slotMatchesCell(
  slot: LessonSlot,
  date: Date,
  hour: number,
  minute: number
): boolean {
  const slotDate = new Date(slot.start_at);
  return (
    slotDate.getFullYear() === date.getFullYear() &&
    slotDate.getMonth() === date.getMonth() &&
    slotDate.getDate() === date.getDate() &&
    slotDate.getHours() === hour &&
    slotDate.getMinutes() === minute
  );
}

export function BookingGrid({
  startDate,
  slots,
  bookings,
  onCellClick,
}: {
  startDate: Date;
  slots: LessonSlot[];
  bookings: Booking[];
  onCellClick: (slot: LessonSlot) => void;
}) {
  const days = useMemo(() => {
    const out: Date[] = [];
    for (let i = 0; i < DAYS; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      out.push(d);
    }
    return out;
  }, [startDate]);

  const stateFor = (date: Date, hour: number, minute: number): CellState => {
    const mine = bookings.find(
      b =>
        b.status === 'confirmed' && slotMatchesCell(b.slot, date, hour, minute)
    );
    if (mine) return { kind: 'mine', booking: mine };

    const slot = slots.find(s => slotMatchesCell(s, date, hour, minute));
    if (!slot) return { kind: 'empty' };
    if (slot.status === 'closed') return { kind: 'closed', slot };
    if (slot.remaining <= 0) return { kind: 'full', slot };
    return { kind: 'open', slot };
  };

  return (
    <div className="overflow-x-auto">
      <div
        className="grid"
        style={{
          gridTemplateColumns: `60px repeat(${DAYS}, minmax(48px, 1fr))`,
        }}
      >
        <div />
        {days.map(d => (
          <div
            key={d.toISOString()}
            data-testid="day-header"
            className="px-1 py-2 text-center text-xs font-semibold"
          >
            {formatDayHeader(d)}
          </div>
        ))}
        {TIME_SLOTS.map(t => (
          <div key={t.label} className="contents">
            <div
              data-testid="time-row"
              className="px-2 py-1 text-right text-xs text-gray-600"
            >
              {t.label}
            </div>
            {days.map(d => (
              <div
                key={`${d.toISOString()}-${t.label}`}
                className="border-b border-r border-gray-100 p-px"
              >
                <SlotCell
                  state={stateFor(d, t.hour, t.minute)}
                  onClick={onCellClick}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
