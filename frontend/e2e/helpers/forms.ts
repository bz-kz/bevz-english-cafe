import { Page, expect } from '@playwright/test';
import { CONTACT } from './selectors';

export async function fillContactForm(
  page: Page,
  v: {
    name: string;
    email: string;
    message: string;
    lessonType: string;
  }
) {
  await page.fill(CONTACT.name, v.name);
  await page.fill(CONTACT.email, v.email);
  await page.selectOption(CONTACT.lessonType, v.lessonType);
  await page.fill(CONTACT.message, v.message);
}

export async function expectVisible(page: Page, selector: string) {
  await expect(page.locator(selector).first()).toBeVisible();
}
