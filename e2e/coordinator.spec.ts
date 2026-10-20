import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('Skenario 1 E2E: koordinator menahan & menyetujui rencana 1 hari, pasien melihatnya', async ({
  page,
  browser,
}) => {
  await login(page);
  await page
    .getByRole('link', { name: /Belum disusun|Opsi siap dipilih/ })
    .first()
    .waitFor();
  await page.getByTestId('queue-item').filter({ hasText: 'Pasien S1' }).click();
  await expect(page.getByRole('heading', { name: 'Pasien S1' })).toBeVisible();

  const option = page.getByTestId('plan-PROPOSED').first();
  await expect(option).toContainText('1 hari kunjungan');
  await option.getByRole('button', { name: 'Tahan jadwal ini' }).click();
  const held = page.getByTestId('plan-HELD');
  // If another patient took a slot meanwhile, the system offers fresh options: hold the new best one.
  if (
    await page
      .getByText('baru saja diambil pasien lain')
      .first()
      .isVisible()
      .catch(() => false)
  ) {
    await page.getByTestId('plan-PROPOSED').first().getByRole('button', { name: 'Tahan jadwal ini' }).click();
  }
  await expect(held).toBeVisible();
  await expect(held).toContainText('berakhir');

  await held.getByRole('button', { name: 'Setujui rencana' }).click();
  await expect(page.getByTestId('plan-CONFIRMED')).toBeVisible();

  await page.getByRole('button', { name: 'Buat tautan pasien' }).click();
  const link = (await page.getByTestId('secret').textContent())!.trim();
  expect(link).toMatch(/\/p\/[\w-]{20,}$/);

  const patient = await (await browser.newContext()).newPage();
  await patient.goto(link);
  // Token is exchanged for a cookie and removed from the address bar.
  await expect(patient).toHaveURL(/\/p$/);
  await expect(patient.getByRole('heading', { name: 'Jadwal Anda sudah pasti' })).toBeVisible();
  await expect(patient.getByRole('heading', { name: 'Cukup datang 1 hari' })).toBeVisible();
});

test('alasan wajib saat melepas jadwal', async ({ page }) => {
  await login(page);
  await page.getByTestId('queue-item').filter({ hasText: 'Pasien S5' }).click();
  const held = page.getByTestId('plan-HELD');
  await held.getByRole('button', { name: 'Lepas jadwal' }).click();
  // Native validation blocks an empty reason; the plan stays held.
  await expect(held).toBeVisible();
  await held.getByLabel(/Alasan melepas/).fill('Pasien minta tanggal lain');
  await held.getByRole('button', { name: 'Lepas jadwal' }).click();
  await expect(page.getByTestId('plan-HELD')).toHaveCount(0);
  await expect(page.getByText('Riwayat rencana sebelumnya')).toBeVisible();
});

test('admin unit tidak bisa membuka panel permintaan demo (RBAC)', async ({ page }) => {
  await login(page, 'admin.unit@rs-contoh.test');
  await page.goto('/app/admin/leads');
  await expect(page).toHaveURL(/akses=ditolak/);
});
