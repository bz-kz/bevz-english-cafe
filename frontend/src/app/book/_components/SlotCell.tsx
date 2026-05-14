'use client';

import type { Booking, LessonSlot } from '@/lib/booking';

export type CellState =
  | { kind: 'open'; slot: LessonSlot }
  | { kind: 'within24h'; slot: LessonSlot }
  | { kind: 'closed'; slot: LessonSlot }
  | { kind: 'full'; slot: LessonSlot }
  | { kind: 'mine'; booking: Booking }
  | { kind: 'empty' };

export function SlotCell({
  state,
  onClick,
}: {
  state: CellState;
  onClick: (slot: LessonSlot) => void;
}) {
  if (state.kind === 'open') {
    return (
      <button
        type="button"
        onClick={() => onClick(state.slot)}
        className="flex h-8 w-full items-center justify-center bg-green-100 text-sm hover:bg-green-200"
      >
        ○
      </button>
    );
  }
  if (
    state.kind === 'within24h' ||
    state.kind === 'closed' ||
    state.kind === 'full'
  ) {
    const title =
      state.kind === 'within24h' ? '24時間以内のため予約不可' : undefined;
    return (
      <span
        title={title}
        className="flex h-8 w-full items-center justify-center bg-gray-200 text-sm text-gray-400"
      >
        ×
      </span>
    );
  }
  if (state.kind === 'mine') {
    return (
      <span className="flex h-8 w-full items-center justify-center bg-blue-500 text-xs text-white">
        予約済
      </span>
    );
  }
  return (
    <span className="flex h-8 w-full items-center justify-center bg-gray-50 text-sm text-gray-300">
      -
    </span>
  );
}
