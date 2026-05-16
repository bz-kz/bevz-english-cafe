'use client';

import Link from 'next/link';
import { Fragment, useEffect, useState } from 'react';
import {
  listOpenSlots,
  adminListSlotBookings,
  type LessonSlot,
  type AdminBookingRow,
} from '@/lib/booking';

const TYPE_LABEL: Record<LessonSlot['lesson_type'], string> = {
  trial: '無料体験',
  group: 'グループ',
  private: 'プライベート',
  business: 'ビジネス',
  toeic: 'TOEIC',
  online: 'オンライン',
  other: 'その他',
};

export default function AdminLessonsPage() {
  const [slots, setSlots] = useState<LessonSlot[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [cache, setCache] = useState<Record<string, AdminBookingRow[]>>({});
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [error, setError] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      setSlots(await listOpenSlots());
    })();
  }, []);

  const toggle = async (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    // benign: stale-closure loading check can allow a same-tick double GET;
    // idempotent GET, last-write-wins — do NOT add lock machinery.
    if (cache[id] || loading.has(id)) return;
    setLoading(prev => new Set(prev).add(id));
    try {
      const rows = await adminListSlotBookings(id);
      setCache(prev => ({ ...prev, [id]: rows }));
      setError(prev => {
        const n = { ...prev };
        delete n[id];
        return n;
      });
    } catch {
      setError(prev => ({ ...prev, [id]: '取得に失敗しました' }));
    } finally {
      setLoading(prev => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
    }
  };

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm text-gray-600">
          枠は毎日 0:00 JST に自動生成されます (14
          日先まで)。個別の編集・閉鎖は各枠の「編集」から。
        </p>
      </section>
      <section>
        <h2 className="mb-2 text-lg font-semibold">予約可能な枠</h2>
        <table className="w-full text-sm">
          <thead className="border-b text-left">
            <tr>
              <th className="py-2">開始</th>
              <th>タイプ</th>
              <th>定員</th>
              <th>残</th>
              <th>料金</th>
              <th>予約者</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {slots.map(s => {
              const isOpen = expanded.has(s.id);
              const rows = cache[s.id];
              const confirmed = rows
                ? rows.filter(r => r.status === 'confirmed')
                : [];
              const cancelledCount = rows
                ? rows.filter(r => r.status !== 'confirmed').length
                : 0;
              return (
                <Fragment key={s.id}>
                  <tr className="border-b">
                    <td className="py-2">
                      {new Date(s.start_at).toLocaleString('ja-JP')}
                    </td>
                    <td>{TYPE_LABEL[s.lesson_type]}</td>
                    <td>{s.capacity}</td>
                    <td>{s.remaining}</td>
                    <td>
                      {s.price_yen ? `¥${s.price_yen.toLocaleString()}` : '-'}
                    </td>
                    <td>
                      {s.booked_count === 0 ? (
                        <span className="text-gray-400">予約者なし</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggle(s.id)}
                          className="text-blue-600 underline"
                          aria-expanded={isOpen}
                        >
                          {isOpen ? '▾' : '▸'} 予約者 ({s.booked_count})
                        </button>
                      )}
                    </td>
                    <td>
                      <Link
                        href={`/admin/lessons/${s.id}`}
                        className="text-blue-600 underline"
                      >
                        編集
                      </Link>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b bg-gray-50">
                      <td colSpan={7} className="px-2 py-3">
                        {loading.has(s.id) && (
                          <span className="text-gray-500">読み込み中…</span>
                        )}
                        {error[s.id] && (
                          <span className="text-red-600">{error[s.id]}</span>
                        )}
                        {rows && !loading.has(s.id) && !error[s.id] && (
                          <>
                            {confirmed.length === 0 ? (
                              <span className="text-gray-500">
                                確定予約なし
                              </span>
                            ) : (
                              <table className="w-full text-sm">
                                <thead className="text-left text-gray-500">
                                  <tr>
                                    <th className="py-1">名前</th>
                                    <th>メール</th>
                                    <th>予約日時</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {confirmed.map(b => (
                                    <tr key={b.id}>
                                      <td className="py-1">
                                        {b.user_name ?? (
                                          <span className="text-gray-400">
                                            {b.user_id}
                                          </span>
                                        )}
                                      </td>
                                      <td>
                                        {b.user_email ?? (
                                          <span className="text-gray-400">
                                            —
                                          </span>
                                        )}
                                      </td>
                                      <td>
                                        {new Date(b.created_at).toLocaleString(
                                          'ja-JP'
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                            {cancelledCount > 0 && (
                              <p className="mt-2 text-xs text-gray-400">
                                （キャンセル済 {cancelledCount} 件）
                              </p>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
