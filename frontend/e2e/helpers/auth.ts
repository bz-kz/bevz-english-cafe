import { test as base, expect, Page } from '@playwright/test';

async function uiLogin(page: Page, email: string) {
  await page.goto('/login');
  // LoginForm inputs carry no id/name — only type + placeholder.
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', process.env.E2E_PASSWORD!);
  await page.locator('button[type="submit"]').click();

  // LoginForm does router.push('/mypage') immediately after
  // signInWithEmailAndPassword resolves — but that fires BEFORE
  // onAuthStateChanged hydrates authStore. Waiting for the URL alone is
  // insufficient: useAdminGuard keys off store `loading`, so an admin spec
  // that navigates too early gets a spurious redirect.
  await page.waitForURL('**/mypage', { timeout: 15000 });

  // Settled signal: MyPage renders "読み込み中…" while
  // (loading || !user || !profile); the <h1>マイページ</h1> heading appears
  // ONLY once authStore.loading===false && user!==null AND the backend
  // GET /users/me succeeded (profile!==null). Its visibility therefore also
  // proves the C1 token-verify / Firestore-namespace contract holds.
  await expect(page.getByRole('heading', { name: 'マイページ' })).toBeVisible({
    timeout: 15000,
  });
}

export const test = base.extend<{ asUser: Page; asAdmin: Page }>({
  asUser: async ({ page }, use) => {
    await uiLogin(page, process.env.E2E_USER_EMAIL!);
    await use(page);
  },
  asAdmin: async ({ page }, use) => {
    await uiLogin(page, process.env.E2E_ADMIN_EMAIL!);
    await use(page);
  },
});

export { expect };
