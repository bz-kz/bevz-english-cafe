import { test, expect } from '@playwright/test';
import { ROUTES } from './helpers/selectors';

test.describe('public browse', () => {
  for (const path of [
    ROUTES.lessons,
    ROUTES.instructors,
    ROUTES.reviews,
    ROUTES.videos,
    ROUTES.reviewsSubmit,
  ]) {
    test(`renders ${path}`, async ({ page }) => {
      const r = await page.goto(path);
      expect(r?.status(), path).toBeLessThan(400);
      await expect(page.locator('main')).toBeVisible();
    });
  }

  test('instructors list -> first detail [id]', async ({ page }) => {
    await page.goto(ROUTES.instructors);
    const link = page.locator('a[href^="/instructors/"]').first();
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/instructors\/.+/);
    await expect(page.locator('main')).toBeVisible();
  });

  test('lessons list -> first detail [id]', async ({ page }) => {
    await page.goto(ROUTES.lessons);
    const link = page.locator('a[href^="/lessons/"]').first();
    if (await link.count()) {
      await link.click();
      await expect(page).toHaveURL(/\/lessons\/.+/);
      await expect(page.locator('main')).toBeVisible();
    }
  });
});
