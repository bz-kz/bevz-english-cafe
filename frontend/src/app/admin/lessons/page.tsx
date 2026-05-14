'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { listOpenSlots, type LessonSlot } from '@/lib/booking';

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

  useEffect(() => {
    (async () => {
      setSlots(await listOpenSlots());
    })();
  }, []);

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
              <th></th>
            </tr>
          </thead>
          <tbody>
            {slots.map(s => (
              <tr key={s.id} className="border-b">
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
                  <Link
                    href={`/admin/lessons/${s.id}`}
                    className="text-blue-600 underline"
                  >
                    編集
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
