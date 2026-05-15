import { ADMIN_ERROR_MESSAGES, getAdminErrorMessage } from '@/lib/admin-errors';

describe('getAdminErrorMessage', () => {
  it('returns mapped message for a known backend code', () => {
    const err = { response: { data: { detail: { code: 'slot_full' } } } };
    expect(getAdminErrorMessage(err, 'fallback')).toBe(
      ADMIN_ERROR_MESSAGES.slot_full
    );
  });

  it('returns the fallback for an unknown code', () => {
    const err = { response: { data: { detail: { code: 'mystery' } } } };
    expect(getAdminErrorMessage(err, '予約追加に失敗しました')).toBe(
      '予約追加に失敗しました'
    );
  });

  it('returns the fallback for a non-axios error', () => {
    expect(getAdminErrorMessage(new Error('boom'), 'fallback')).toBe(
      'fallback'
    );
    expect(getAdminErrorMessage(null, 'fallback')).toBe('fallback');
    expect(getAdminErrorMessage(undefined, 'fallback')).toBe('fallback');
    expect(getAdminErrorMessage('string error', 'fallback')).toBe('fallback');
  });

  it('returns the fallback when detail is a plain string (not the admin shape)', () => {
    const err = { response: { data: { detail: 'slot_full' } } };
    expect(getAdminErrorMessage(err, 'fallback')).toBe('fallback');
  });
});
