import { test, expect } from './helpers/auth';
import { ROUTES } from './helpers/selectors';

test.describe('booking (authed, seeded slot)', () => {
  test('happy path: book the seeded open slot', async ({ asUser }) => {
    await asUser.goto(ROUTES.book);
    await expect(
      asUser.getByRole('heading', { name: 'レッスン予約' })
    ).toBeVisible();

    // SlotCell renders an open slot as <button>○</button>; closed/full/past
    // render a non-interactive ×/- span. The seeded slot (status open,
    // start 3d out 10:00 local) is the only open cell.
    const openCell = asUser.locator('button', { hasText: '○' }).first();
    await expect(openCell).toBeVisible({ timeout: 15000 });
    await openCell.click();

    // BookingConfirmDialog → 予約する triggers POST /api/v1/bookings.
    const confirm = asUser.getByRole('button', { name: '予約する' });
    await expect(confirm).toBeVisible();
    const [resp] = await Promise.all([
      asUser.waitForResponse(
        r =>
          r.url().includes('/api/v1/bookings') &&
          r.request().method() === 'POST'
      ),
      confirm.click(),
    ]);
    // Seeded monthly_quota (granted 8 / used 0) makes book() succeed (201);
    // without it backend returns 409 no_active_quota.
    expect(resp.status()).toBeLessThan(400);
    await expect(asUser.getByText('予約しました')).toBeVisible();
  });
});
