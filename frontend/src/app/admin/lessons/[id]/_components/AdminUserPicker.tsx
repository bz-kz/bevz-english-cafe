'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { searchAdminUsers, type AdminUserSummary } from '@/lib/admin-booking';

interface Props {
  onSelect: (u: AdminUserSummary) => void;
}

export function AdminUserPicker({ onSelect }: Props) {
  const [q, setQ] = useState('');
  const [candidates, setCandidates] = useState<AdminUserSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const list = await searchAdminUsers(q);
        setCandidates(list);
        // 検索結果が変わったらハイライトをリセット
        setHighlighted(-1);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (candidates.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted(prev => (prev + 1) % candidates.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted(prev => (prev <= 0 ? candidates.length - 1 : prev - 1));
    } else if (e.key === 'Enter') {
      if (highlighted >= 0 && highlighted < candidates.length) {
        e.preventDefault();
        onSelect(candidates[highlighted]);
      }
    }
  };

  return (
    <div className="space-y-2" onKeyDown={handleKeyDown}>
      <input
        type="text"
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="メール / 名前で検索"
        className="w-full rounded border px-2 py-1 text-sm"
      />
      <ul className="max-h-48 overflow-y-auto rounded border">
        {loading && <li className="p-2 text-xs text-gray-400">読み込み中…</li>}
        {!loading && candidates.length === 0 && (
          <li className="p-2 text-xs text-gray-400">候補がありません</li>
        )}
        {candidates.map((c, idx) => (
          <li key={c.uid}>
            <button
              type="button"
              role="option"
              onClick={() => onSelect(c)}
              onMouseEnter={() => setHighlighted(idx)}
              aria-selected={idx === highlighted}
              className={`block w-full px-2 py-1 text-left text-sm hover:bg-gray-100 ${
                idx === highlighted ? 'bg-blue-100' : ''
              }`}
            >
              {c.email} ({c.name})
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
