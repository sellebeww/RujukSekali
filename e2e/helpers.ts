import { expect, type Page } from '@playwright/test';

export async function login(page: Page, email = 'koordinator@rs-contoh.test') {
  await page.goto('/masuk');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Kata sandi').fill('e2e-password');
  await page.getByRole('button', { name: 'Masuk' }).click();
  await expect(page).toHaveURL(/\/app$/);
}
