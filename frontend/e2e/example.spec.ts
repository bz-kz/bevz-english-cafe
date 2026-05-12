import { test, expect } from '@playwright/test';

test('homepage has title and heading', async ({ page }) => {
  await page.goto('/');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/英会話カフェ/);

  // Expect a heading to be visible
  await expect(
    page.getByRole('heading', { name: '英会話カフェへようこそ' })
  ).toBeVisible();
});

test('contact form navigation', async ({ page }) => {
  await page.goto('/');

  // Navigate to contact page (when implemented)
  // This is a placeholder test for future implementation
  await expect(page.locator('body')).toBeVisible();
});
