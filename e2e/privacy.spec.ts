import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('Skenario 12b: token pasien tidak bocor lewat URL atau Referer', async ({ page, browser }) => {
  await login(page);
  await page.getByTestId('queue-item').filter({ hasText: 'Pasien S2' }).click();
  await page.getByRole('button', { name: 'Buat tautan pasien' }).click();
  const link = (await page.getByTestId('secret').textContent())!.trim();
  const token = link.split('/p/')[1]!;

  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  const resp = await p.goto(link);
  await expect(p).toHaveURL(/\/p$/);
  expect(p.url()).not.toContain(token);
  expect(resp!.headers()['referrer-policy']).toBe('no-referrer');

  const outbound = p.getByRole('link', { name: 'Tentang layanan ini' }).first();
  expect(await outbound.getAttribute('href')).not.toContain(token);
  expect(await outbound.getAttribute('rel')).toContain('noreferrer');
  const req = p.waitForRequest((r) => r.url().endsWith('/untuk-pasien'));
  await outbound.click();
  const headers = (await req).headers();
  expect(headers['referer'] ?? '').not.toContain(token);
  expect(headers['referer']).toBeUndefined();
});

test('token tidak valid memberi pesan yang membantu, bukan error', async ({ page }) => {
  await page.goto('/p/token-palsu-yang-cukup-panjang-12345');
  await expect(page).toHaveURL(/tautan=tidak-berlaku/);
  await expect(page.getByRole('heading', { name: 'Tautan tidak bisa dibuka' })).toBeVisible();
});

test('mode demo hanya menyentuh sandbox: aksi demo tidak muncul di zona kerja', async ({ page }) => {
  await page.goto('/demo/mulai?skenario=1&tahap=susun');
  const name = (await page.getByRole('heading', { level: 1 }).textContent())!;
  expect(name).toMatch(/Pasien Demo/);
  await login(page);
  await expect(page.getByText(name)).toHaveCount(0);
});
