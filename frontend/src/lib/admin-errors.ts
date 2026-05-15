// バックエンドが返す `detail: { code: string }` を JA メッセージに対応付ける。
// `frontend/src/app/book/page.tsx` の ERROR_MESSAGES と同じ思想だが、
// admin 系エンドポイント (`/api/v1/admin/...`) 専用のキーを扱う。

export const ADMIN_ERROR_MESSAGES: Record<string, string> = {
  slot_full: '定員に達しています。先に定員を増やしてください',
  user_not_found: 'ユーザーが見つかりません',
  already_booked: 'すでに同じ枠に予約があります',
  slot_not_found: '枠が見つかりません',
  booking_not_found: '予約が見つかりません',
};

interface AxiosLikeError {
  response?: {
    data?: {
      detail?: unknown;
    };
  };
}

function extractCode(err: unknown): string | null {
  if (typeof err !== 'object' || err === null) return null;
  const detail = (err as AxiosLikeError).response?.data?.detail;
  if (typeof detail === 'object' && detail !== null && 'code' in detail) {
    const code = (detail as { code: unknown }).code;
    return typeof code === 'string' ? code : null;
  }
  return null;
}

export function getAdminErrorMessage(err: unknown, fallback: string): string {
  const code = extractCode(err);
  if (code && code in ADMIN_ERROR_MESSAGES) {
    return ADMIN_ERROR_MESSAGES[code];
  }
  return fallback;
}
