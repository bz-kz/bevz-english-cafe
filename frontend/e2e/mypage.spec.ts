import { test, expect } from './helpers/auth';
import { ROUTES } from './helpers/selectors';

test.describe('mypage (authed)', () => {
  test('mypage renders profile/bookings sections', async ({ asUser }) => {
    await asUser.goto(ROUTES.mypage);
    await expect(
      asUser.getByRole('heading', { name: 'マイページ' })
    ).toBeVisible();
    expect(asUser.url()).not.toContain('/login');
  });

  test('edit profile PUT users/me', async ({ asUser }) => {
    await asUser.goto(ROUTES.mypageEdit);
    // Name is prefilled from GET /users/me (seed name "E2E User"); the form
    // is submittable. Save → axios.put(/api/v1/users/me) → push('/mypage').
    await expect(asUser.locator('input[type="text"]')).toHaveValue(/.+/);
    const [resp] = await Promise.all([
      asUser.waitForResponse(
        r =>
          r.url().includes('/api/v1/users/me') && r.request().method() === 'PUT'
      ),
      asUser.locator('button[type="submit"]').click(),
    ]);
    expect(resp.status()).toBeLessThan(400);
  });

  test('plan checkout boundary — no real Stripe (I3)', async ({ asUser }) => {
    let checkoutHit = false;
    let stripeAborted = false;
    // axios posts an absolute cross-origin URL — use URL predicate matchers
    // (a string glob does not intercept those, verified in contact.spec).
    await asUser.route(
      url => url.pathname.endsWith('/api/v1/billing/checkout'),
      r => {
        checkoutHit = true;
        r.fulfill({
          status: 200,
          contentType: 'application/json',
          body: '{"url":"https://checkout.stripe.com/test"}',
        });
      }
    );
    await asUser.route(
      url => url.host === 'checkout.stripe.com',
      r => {
        stripeAborted = true;
        r.abort();
      }
    );
    await asUser.goto(ROUTES.mypagePlan);
    // PlanCard: selectable plans show 選択 (enabled), the current plan shows
    // ご利用中 (disabled). Seed user is plan:"standard" → first 選択 button is
    // a different tier. No data-plan attribute exists.
    await asUser.locator('button:has-text("選択")').first().click();
    await expect.poll(() => checkoutHit).toBe(true);
    await expect.poll(() => stripeAborted).toBe(true);
  });
});
