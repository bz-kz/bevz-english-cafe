'use client';

import { useState } from 'react';
import { adminForceCancel } from '@/lib/admin-booking';
import { useNotificationStore } from '@/stores/notificationStore';

interface Props {
  bookingId: string;
  userLabel: string;
  lessonType: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function ForceCancelDialog({
  bookingId,
  userLabel,
  lessonType,
  onClose,
  onSuccess,
}: Props) {
  const [refundQuota, setRefundQuota] = useState(false);
  const [refundTrial, setRefundTrial] = useState(false);
  const [busy, setBusy] = useState(false);
  const notify = useNotificationStore();
  const isTrial = lessonType === 'trial';

  const submit = async () => {
    setBusy(true);
    try {
      await adminForceCancel(bookingId, {
        refund_quota: refundQuota,
        refund_trial: refundTrial,
      });
      notify.success('予約を取消しました');
      onSuccess();
    } catch {
      notify.error('キャンセルに失敗しました');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
      <div className="w-[400px] space-y-4 rounded bg-white p-4 shadow-lg">
        <h3 className="font-semibold">予約を強制キャンセル</h3>
        <p className="text-sm text-gray-700">
          {userLabel} の予約をキャンセルしますか?
        </p>
        {isTrial ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={refundTrial}
              onChange={e => setRefundTrial(e.target.checked)}
            />
            trial を返却する
          </label>
        ) : (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={refundQuota}
              onChange={e => setRefundQuota(e.target.checked)}
            />
            quota を返却する
          </label>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded border px-3 py-1 text-sm disabled:opacity-50"
          >
            いいえ
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="rounded bg-red-600 px-3 py-1 text-sm text-white disabled:opacity-50"
          >
            {busy ? '処理中…' : 'はい、キャンセルする'}
          </button>
        </div>
      </div>
    </div>
  );
}
