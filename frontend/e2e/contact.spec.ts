import { test, expect } from '@playwright/test';
import { ROUTES, CONTACT } from './helpers/selectors';
import { fillContactForm } from './helpers/forms';

test.describe('contact form', () => {
  test('submit disabled and errors shown when invalid', async ({ page }) => {
    await page.goto(ROUTES.contact);
    await expect(page.locator(CONTACT.submit)).toBeDisabled();
    await page.fill(CONTACT.name, 'テスト');
    await page.fill(CONTACT.email, 'bad-email');
    await page.fill(CONTACT.message, 'short');
    await page.locator(CONTACT.message).blur();
    await expect(page.locator(CONTACT.fieldError).first()).toBeVisible();
    await expect(page.locator(CONTACT.submit)).toBeDisabled();
  });

  test('message length boundary 9 invalid / 10 valid', async ({ page }) => {
    await page.goto(ROUTES.contact);
    await fillContactForm(page, {
      name: '山田',
      email: 'y@example.com',
      lessonType: 'trial',
      message: '123456789',
    });
    await page.locator(CONTACT.message).blur();
    await expect(page.locator(CONTACT.submit)).toBeDisabled();
    await page.fill(CONTACT.message, '1234567890');
    await expect(page.locator(CONTACT.submit)).toBeEnabled();
  });

  test('happy path posts to backend and shows success', async ({ page }) => {
    await page.goto(ROUTES.contact);
    await fillContactForm(page, {
      name: '結合テスト',
      email: 'e2e@example.com',
      lessonType: 'trial',
      message: 'これは10文字以上の問い合わせ本文です。',
    });
    const [resp] = await Promise.all([
      page.waitForResponse(
        r =>
          r.url().includes('/api/v1/contacts') &&
          r.request().method() === 'POST'
      ),
      page.click(CONTACT.submit),
    ]);
    expect(resp.status()).toBeLessThan(300);
    await expect(page.locator(CONTACT.successToast)).toBeVisible();
  });

  test('backend 500 shows submit error block', async ({ page }) => {
    await page.route('**/api/v1/contacts**', r =>
      r.fulfill({
        status: 500,
        contentType: 'application/json',
        body: '{"detail":"boom"}',
      })
    );
    await page.goto(ROUTES.contact);
    await fillContactForm(page, {
      name: '失敗',
      email: 'f@example.com',
      lessonType: 'trial',
      message: 'サーバエラー検証用の十分な長さの本文。',
    });
    await page.click(CONTACT.submit);
    // ContactForm renders the inline error block as <h3 class="...text-red-800">送信エラー</h3>
    // AND fires a toast whose title is also "送信エラー", so a bare text= locator
    // resolves to 2 elements (Playwright strict-mode failure). Scope to the inline
    // error heading specifically — a stricter, not weaker, assertion of the same contract.
    await expect(
      page.locator('h3.text-red-800', { hasText: '送信エラー' })
    ).toBeVisible();
  });
});
