import { test, expect } from '@playwright/test';
import { ROUTES } from './helpers/selectors';

// Observed guard contract (I2 — assert what the code does, not an assumption):
// frontend/src/app/book/page.tsx does NOT redirect unauthenticated users on
// load. The grid renders read-only; the redirect to /login fires only inside
// handleCellClick (`if (!user) router.push('/login')`). So the unauth contract
// is: page stays on /book and surfaces the "click → login" guidance hint.
test('book page is viewable while unauthenticated and shows the login hint', async ({
  page,
}) => {
  await page.goto(ROUTES.book);
  await expect(page).toHaveURL(/\/book/);
  await expect(page.locator('main').first()).toBeVisible();
  await expect(
    page.getByText('ログイン画面に進みます', { exact: false })
  ).toBeVisible();
});
