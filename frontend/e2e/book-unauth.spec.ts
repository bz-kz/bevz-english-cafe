import { test, expect } from '@playwright/test';
import { ROUTES } from './helpers/selectors';

test('book page redirects unauthenticated users to /login', async ({
  page,
}) => {
  await page.goto(ROUTES.book);
  await expect(page).toHaveURL(/\/login/);
});
