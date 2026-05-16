import { test, expect } from '@playwright/test';
import { ROUTES } from './helpers/selectors';

test.describe('auth pages (render + client validation)', () => {
  test('login renders; empty submit blocked by native validation (no network)', async ({
    page,
  }) => {
    await page.goto(ROUTES.login);
    await expect(page.locator('form')).toBeVisible();
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('input[type="email"]')).toHaveJSProperty(
      'validity.valid',
      false
    );
    expect(page.url()).toContain('/login');
  });

  test('signup renders with required email + password fields', async ({
    page,
  }) => {
    await page.goto(ROUTES.signup);
    await expect(page.locator('form')).toBeVisible();
    await expect(page.locator('input[type="email"]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });
});
