import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('Skenario 13: formulir minta demo — persetujuan wajib, lalu masuk panel admin', async ({ page }) => {
  await page.goto('/minta-demo');
  await page.getByLabel('Nama', { exact: true }).fill('Dr. Uji E2E');
  await page.getByLabel('Instansi').fill('RS Uji E2E');
  await page.getByLabel('Peran').fill('Direktur Pelayanan');
  await page.getByLabel('Email atau nomor WhatsApp').fill('uji@rs-e2e.test');
  await page.getByLabel('Kebutuhan singkat').fill('Kami ingin mencoba pilot untuk pasien rujukan.');
  await page.waitForTimeout(2100); // humans take longer than the anti-bot minimum
  await page.getByRole('button', { name: 'Kirim permintaan' }).click();
  await expect(page.getByText('Persetujuan penggunaan data kontak wajib dicentang')).toBeVisible();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Kirim permintaan' }).click();
  await expect(page.getByText('Permintaan terkirim.')).toBeVisible();

  await login(page, 'admin@rs-contoh.test');
  await page.goto('/app/admin/leads');
  await expect(page.getByTestId('lead').filter({ hasText: 'RS Uji E2E' })).toBeVisible();
});
