'use client';

import { useState } from 'react';
import { adminForceBook, type AdminUserSummary } from '@/lib/admin-booking';
import { useNotificationStore } from '@/stores/notificationStore';
import { AdminUserPicker } from './AdminUserPicker';

interface Props {
  slotId: string;
  lessonType: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddBookingDialog({
  slotId,
  lessonType,
  onClose,
  onSuccess,
}: Props) {
  const [picked, setPicked] = useState<AdminUserSummary | null>(null);
  const [consumeQuota, setConsumeQuota] = useState(false);
  const [consumeTrial, setConsumeTrial] = useState(false);
  const [busy, setBusy] = useState(false);
  const notify = useNotificationStore();
  const isTrial = lessonType === 'trial';

  const submit = async () => {
    if (!picked) return;
    setBusy(true);
    try {
      await adminForceBook(slotId, {
        user_id: picked.uid,
        consume_quota: consumeQuota,
        consume_trial: consumeTrial,
      });
      notify.success('予約を追加しました');
      onSuccess();
    } catch (e: unknown) {
      const msg =
        typeof e === 'object' && e !== null && 'message' in e
          ? String((e as { message: unknown }).message)
          : '予約追加に失敗しました';
      notify.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
      <div className="w-[440px] space-y-4 rounded bg-white p-4 shadow-lg">
        <h3 className="font-semibold">予約を追加</h3>

        <div>
          <label className="text-sm font-medium">ユーザー</label>
          {picked ? (
            <div className="flex items-center justify-between rounded border bg-gray-50 px-2 py-1 text-sm">
              <span>
                {picked.email} ({picked.name})
              </span>
              <button
                type="button"
                onClick={() => setPicked(null)}
                className="text-xs text-blue-600"
              >
                変更
              </button>
            </div>
          ) : (
            <AdminUserPicker onSelect={setPicked} />
          )}
        </div>

        <div className="space-y-1">
          {isTrial ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={consumeTrial}
                onChange={e => setConsumeTrial(e.target.checked)}
              />
              trial を消費する
            </label>
          ) : (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={consumeQuota}
                onChange={e => setConsumeQuota(e.target.checked)}
              />
              quota を消費する
            </label>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded border px-3 py-1 text-sm disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !picked}
            className="rounded bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-50"
          >
            {busy ? '追加中…' : '予約を追加'}
          </button>
        </div>
      </div>
    </div>
  );
}
