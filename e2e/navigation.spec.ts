import { expect, test } from '@playwright/test';
import { login } from './helpers';

const openMenuIfCollapsed = async (page: import('@playwright/test').Page) => {
  const menu = page.locator('summary', { hasText: 'Menu' });
  if (await menu.isVisible()) await menu.click();
};

test('Skenario 11a: profile → demo koordinator → "Tentang" kembali ke profile', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Coba sebagai Koordinator' }).first().click();
  await expect(page).toHaveURL(/\/demo\/koordinator/);
  await expect(page.getByText('Mode demo — data sintetis')).toBeVisible();
  await openMenuIfCollapsed(page);
  await page.getByRole('link', { name: 'Tentang', exact: true }).first().click();
  await expect(page).toHaveURL(/\/tentang$/);
});

test('Skenario 11b: profile → demo pasien → "Kembali ke situs" ke halaman asal', async ({ page }) => {
  await page.goto('/cara-kerja');
  await page.getByRole('link', { name: 'Lihat Contoh Perjalanan Pasien' }).first().click();
  await expect(page).toHaveURL(/\/demo\/pasien\//);
  await page.getByRole('link', { name: 'Kembali ke situs' }).click();
  await expect(page).toHaveURL(/\/cara-kerja$/);
});

test('Skenario 11c: setelah login, profile menampilkan "Buka Dashboard"', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Masuk', exact: true })).toBeVisible();
  await login(page);
  await page.goto('/');
  await page.getByRole('link', { name: 'Buka Dashboard' }).click();
  await expect(page).toHaveURL(/\/app$/);
  // Logging out shows "Masuk" again on the profile.
  await page.getByRole('button', { name: 'Keluar' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('link', { name: 'Masuk', exact: true })).toBeVisible();
});

test('langkah di /cara-kerja punya deep link ke layar demo yang sesuai', async ({ page }) => {
  await page.goto('/cara-kerja');
  await page.getByRole('link', { name: /Lihat jadwal yang ditahan di demo/ }).click();
  await expect(page.getByTestId('plan-HELD')).toBeVisible();
});
