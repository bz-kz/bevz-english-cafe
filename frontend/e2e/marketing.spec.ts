import { test, expect } from '@playwright/test';
import { ROUTES } from './helpers/selectors';

test.describe('marketing landing', () => {
  test('home renders core sections', async ({ page }) => {
    const resp = await page.goto(ROUTES.home);
    expect(resp?.status()).toBeLessThan(400);
    await expect(page.locator('header').first()).toBeVisible();
    await expect(page.locator('footer').first()).toBeVisible();
    await expect(page.locator('main')).toBeVisible();
  });

  test('primary nav reaches key pages', async ({ page }) => {
    await page.goto(ROUTES.home);
    for (const path of [
      ROUTES.lessons,
      ROUTES.instructors,
      ROUTES.reviews,
      ROUTES.videos,
      ROUTES.contact,
    ]) {
      const r = await page.goto(path);
      expect(r?.status(), `GET ${path}`).toBeLessThan(400);
      await expect(page.locator('main')).toBeVisible();
    }
  });
});
