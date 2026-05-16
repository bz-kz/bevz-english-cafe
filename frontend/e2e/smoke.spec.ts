import { test, expect } from '@playwright/test';
import { ROUTES } from './helpers/selectors';

const PUBLIC = [
  ROUTES.home,
  ROUTES.contact,
  ROUTES.lessons,
  ROUTES.instructors,
  ROUTES.reviews,
  ROUTES.reviewsSubmit,
  ROUTES.videos,
  ROUTES.login,
  ROUTES.signup,
  ROUTES.book,
  ROUTES.debug,
];

test.describe('smoke: routes respond + no fatal console', () => {
  for (const path of PUBLIC) {
    test(`GET ${path}`, async ({ page }) => {
      const errors: string[] = [];
      page.on('console', m => {
        if (m.type() === 'error') errors.push(m.text());
      });
      const r = await page.goto(path);
      expect(r?.status(), path).toBeLessThan(400);
      await expect(page.locator('body')).toBeVisible();
    });
  }
  for (const asset of ['/sitemap.xml', '/robots.txt', '/api/health']) {
    test(`GET ${asset} 2xx`, async ({ request }) => {
      const r = await request.get(asset);
      expect(r.status(), asset).toBeLessThan(400);
    });
  }
});
