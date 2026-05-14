'use client';

import { useState } from 'react';
import {
  adminCreateSlot,
  type CreateSlotInput,
  type LessonType,
} from '@/lib/booking';
import { useNotificationStore } from '@/stores/notificationStore';

const TYPES: { value: LessonType; label: string }[] = [
  { value: 'group', label: 'グループ' },
  { value: 'private', label: 'プライベート' },
  { value: 'trial', label: '無料体験' },
  { value: 'business', label: 'ビジネス英語' },
  { value: 'toeic', label: 'TOEIC対策' },
  { value: 'online', label: 'オンライン' },
  { value: 'other', label: 'その他' },
];

export function SlotForm({
  onCreated,
}: {
  onCreated: () => void | Promise<void>;
}) {
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [lessonType, setLessonType] = useState<LessonType>('group');
  const [capacity, setCapacity] = useState(4);
  const [priceYen, setPriceYen] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const notify = useNotificationStore();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const start = new Date(startAt);
    const end = new Date(endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setError('開始と終了の日時を正しく入力してください');
      return;
    }
    if (end <= start) {
      setError('終了は開始より後の時刻にしてください');
      return;
    }

    setBusy(true);
    try {
      const input: CreateSlotInput = {
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        lesson_type: lessonType,
        capacity,
        price_yen: priceYen ? parseInt(priceYen, 10) : null,
        notes: notes || null,
      };
      await adminCreateSlot(input);
      notify.success('枠を追加しました');
      setStartAt('');
      setEndAt('');
      setCapacity(4);
      setPriceYen('');
      setNotes('');
      try {
        await onCreated();
      } catch (refreshErr) {
        console.warn('refresh after create failed', refreshErr);
      }
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })
        .response?.data?.detail;
      setError(detail ?? '作成に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded border bg-white p-4">
      <h2 className="font-semibold">新規枠を作成</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm">開始</span>
          <input
            type="datetime-local"
            required
            value={startAt}
            onChange={e => setStartAt(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
          />
        </label>
        <label className="block">
          <span className="text-sm">終了</span>
          <input
            type="datetime-local"
            required
            value={endAt}
            onChange={e => setEndAt(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
          />
        </label>
        <label className="block">
          <span className="text-sm">タイプ</span>
          <select
            value={lessonType}
            onChange={e => setLessonType(e.target.value as LessonType)}
            className="mt-1 w-full rounded border px-2 py-1"
          >
            {TYPES.map(t => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm">定員</span>
          <input
            type="number"
            min={1}
            required
            value={capacity}
            onChange={e => setCapacity(parseInt(e.target.value, 10))}
            className="mt-1 w-full rounded border px-2 py-1"
          />
        </label>
        <label className="block">
          <span className="text-sm">料金 (¥, 任意)</span>
          <input
            type="number"
            value={priceYen}
            onChange={e => setPriceYen(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
          />
        </label>
      </div>
      <label className="block">
        <span className="text-sm">メモ (admin のみ閲覧)</span>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          className="mt-1 w-full rounded border px-2 py-1"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="rounded bg-blue-600 px-3 py-2 text-white disabled:opacity-50"
      >
        {busy ? '作成中…' : '作成'}
      </button>
    </form>
  );
}
