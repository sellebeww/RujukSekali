import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('Skenario 2 E2E: pasien mengunggah dokumen, koordinator verifikasi, jadwal menjadi pasti', async ({
  page,
}) => {
  await page.goto('/demo/mulai?skenario=2&tahap=tahan&lihat=pasien');
  await expect(page).toHaveURL(/\/demo\/pasien\//);
  await expect(
    page.getByRole('heading', { name: 'Jadwal sedang ditahan sementara untuk Anda' }),
  ).toBeVisible();

  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
  expect(accessibility.violations.filter((v) => ['critical', 'serious'].includes(v.impact ?? ''))).toEqual(
    [],
  );

  for (const label of ['Foto atau berkas surat rujukan', 'Foto atau berkas hasil pemeriksaan sebelumnya']) {
    await page
      .getByLabel(label)
      .setInputFiles({ name: 'dokumen.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('x') });
    await page
      .getByLabel(label)
      .locator('xpath=ancestor::form')
      .getByRole('button', { name: 'Kirim foto dokumen' })
      .click();
    await expect(page.getByText('Sudah diunggah, menunggu verifikasi').first()).toBeVisible();
  }

  await page.getByRole('link', { name: 'Lihat episode ini dari sisi koordinator' }).click();
  for (let i = 0; i < 2; i++) {
    const before = await page.getByRole('button', { name: 'Verifikasi' }).count();
    await page.getByRole('button', { name: 'Verifikasi' }).first().click();
    await expect(page.getByRole('button', { name: 'Verifikasi' })).toHaveCount(before - 1);
  }
  await expect(page.getByRole('button', { name: 'Verifikasi' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Setujui rencana' }).click();
  await expect(page.getByTestId('plan-CONFIRMED')).toBeVisible();
});

test('pasien bisa minta ubah jadwal; nomor identitas ditolak', async ({ page }) => {
  await page.goto('/demo/mulai?skenario=1&tahap=tahan&lihat=pasien');
  await page.getByLabel('Ceritakan singkat (opsional)').fill('NIK saya 3201234567890123');
  await page.getByRole('button', { name: 'Minta ubah jadwal' }).click();
  await expect(page.getByText('Mohon jangan menulis nomor identitas').first()).toBeVisible();
  await page.getByLabel('Ceritakan singkat (opsional)').fill('Saya hanya bisa hari Kamis');
  await page.getByRole('button', { name: 'Minta ubah jadwal' }).click();
  await expect(page.getByText('Permintaan terkirim').first()).toBeVisible();
});
