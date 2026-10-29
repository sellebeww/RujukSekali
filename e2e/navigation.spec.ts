import { expect, test } from '@playwright/test';
import { login } from './helpers';

const openMenuIfCollapsed = async (page: import('@playwright/test').Page) => {
  const menu = page.locator('summary', { hasText: 'Menu' });
  if (await menu.isVisible()) await menu.click();
};

test('Skenario 11a: tombol demo di profile → halaman masuk → "Coba mode demo" → demo', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Coba Demo Aplikasi' }).first().click();
  await expect(page).toHaveURL(/\/masuk/);
  await page.getByRole('link', { name: 'Coba mode demo tanpa akun' }).click();
  await expect(page).toHaveURL(/\/demo$/);
});

test('Skenario 11c: setelah login, profile menampilkan "Buka Dashboard"', async ({ page }) => {
  await page.goto('/');
  await openMenuIfCollapsed(page);
  await expect(page.getByRole('link', { name: 'Masuk', exact: true })).toBeVisible();
  await login(page);
  await page.goto('/');
  await openMenuIfCollapsed(page);
  await page.getByRole('link', { name: 'Buka Dashboard' }).click();
  await expect(page).toHaveURL(/\/app$/);
  // Logging out shows "Masuk" again on the profile.
  await page.getByRole('button', { name: 'Keluar' }).click();
  await expect(page).toHaveURL(/\/$/);
  await openMenuIfCollapsed(page);
  await expect(page.getByRole('link', { name: 'Masuk', exact: true })).toBeVisible();
});

test('langkah di /cara-kerja mengarah ke halaman masuk sebelum demo', async ({ page }) => {
  await page.goto('/cara-kerja');
  await page.getByRole('link', { name: /Lihat jadwal yang ditahan di demo/ }).click();
  await expect(page).toHaveURL(/\/masuk/);
});
