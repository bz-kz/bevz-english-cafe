'use client';

import axios from 'axios';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  adminDeleteSlot,
  adminUpdateSlot,
  type LessonSlot,
} from '@/lib/booking';
import { firebaseAuth } from '@/lib/firebase';
import { useNotificationStore } from '@/stores/notificationStore';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8010';

interface AdminBookingRow {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
}

export default function AdminLessonEditPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const notify = useNotificationStore();
  const [slot, setSlot] = useState<LessonSlot | null>(null);
  const [bookings, setBookings] = useState<AdminBookingRow[]>([]);
  const [teacherId, setTeacherId] = useState('');
  const [notes, setNotes] = useState('');
  const [capacity, setCapacity] = useState(0);
  const [busy, setBusy] = useState<null | 'save' | 'close' | 'delete'>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const headers: Record<string, string> = {};
    const token = await firebaseAuth.currentUser?.getIdToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const slotResp = await axios.get<LessonSlot>(
      `${API_BASE}/api/v1/lesson-slots/${id}`
    );
    setSlot(slotResp.data);
    setCapacity(slotResp.data.capacity);

    const bookingsResp = await axios.get<AdminBookingRow[]>(
      `${API_BASE}/api/v1/admin/lesson-slots/${id}/bookings`,
      { headers }
    );
    setBookings(bookingsResp.data);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!slot) return <p>読み込み中…</p>;

  const handleSave = async () => {
    setBusy('save');
    try {
      await adminUpdateSlot(slot.id, {
        teacher_id: teacherId || null,
        notes: notes || null,
        capacity,
      });
      notify.success('保存しました');
      await load();
    } finally {
      setBusy(null);
    }
  };

  const handleClose = async () => {
    if (!confirm('この枠を閉じますか? (一覧から非表示になります)')) return;
    setBusy('close');
    try {
      await adminUpdateSlot(slot.id, { status: 'closed' });
      notify.success('枠を閉じました');
      router.push('/admin/lessons');
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    const confirmed = bookings.filter(b => b.status === 'confirmed').length;
    if (
      confirmed > 0 &&
      !confirm(`${confirmed} 件の確定予約があります。強制削除しますか?`)
    )
      return;
    setBusy('delete');
    try {
      await adminDeleteSlot(slot.id, confirmed > 0);
      notify.success('枠を削除しました');
      router.push('/admin/lessons');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">枠 #{slot.id}</h2>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="text-gray-500">開始</dt>
        <dd>{new Date(slot.start_at).toLocaleString('ja-JP')}</dd>
        <dt className="text-gray-500">終了</dt>
        <dd>{new Date(slot.end_at).toLocaleString('ja-JP')}</dd>
        <dt className="text-gray-500">タイプ</dt>
        <dd>{slot.lesson_type}</dd>
        <dt className="text-gray-500">ステータス</dt>
        <dd>{slot.status}</dd>
        <dt className="text-gray-500">予約数</dt>
        <dd>
          {slot.booked_count} / {slot.capacity}
        </dd>
      </dl>

      <div className="space-y-3 rounded border bg-white p-4">
        <h3 className="font-semibold">編集</h3>
        <label className="block text-sm">
          講師 ID
          <input
            type="text"
            value={teacherId}
            onChange={e => setTeacherId(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
          />
        </label>
        <label className="block text-sm">
          定員
          <input
            type="number"
            min={slot.booked_count}
            value={capacity}
            onChange={e => setCapacity(parseInt(e.target.value, 10))}
            className="mt-1 w-full rounded border px-2 py-1"
          />
        </label>
        <label className="block text-sm">
          メモ
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
          />
        </label>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={busy !== null}
            className="rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            {busy === 'save' ? '保存中…' : '保存'}
          </button>
          {slot.status === 'open' && (
            <button
              onClick={handleClose}
              disabled={busy !== null}
              className="rounded border px-3 py-2 text-sm disabled:opacity-50"
            >
              {busy === 'close' ? '閉じています…' : '枠を閉じる'}
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={busy !== null}
            className="rounded border px-3 py-2 text-sm text-red-600 disabled:opacity-50"
          >
            {busy === 'delete' ? '削除中…' : '枠を削除'}
          </button>
        </div>
      </div>

      <section>
        <h3 className="mb-2 font-semibold">予約者</h3>
        {bookings.length === 0 ? (
          <p className="text-sm text-gray-500">まだ予約はありません</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b text-left">
              <tr>
                <th className="py-2">ユーザー</th>
                <th>状態</th>
                <th>予約日時</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map(b => (
                <tr key={b.id} className="border-b">
                  <td className="py-2">{b.user_id}</td>
                  <td>{b.status}</td>
                  <td>{new Date(b.created_at).toLocaleString('ja-JP')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
