import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const PAGES = [
  '/',
  '/cara-kerja',
  '/untuk-rumah-sakit',
  '/untuk-pasien',
  '/keamanan-privasi',
  '/tentang',
  '/hasil-simulasi',
  '/minta-demo',
  '/faq',
  '/kebijakan-privasi',
  '/syarat',
];

test('tidak ada tautan mati (crawl profile + demo)', async ({ page, request }) => {
  const seen = new Set<string>();
  const queue = [...PAGES, '/demo', '/demo/koordinator', '/masuk'];
  const broken: string[] = [];
  while (queue.length) {
    const path = queue.shift()!;
    if (seen.has(path)) continue;
    seen.add(path);
    const res = await page.goto(path);
    if (!res || res.status() >= 400) {
      broken.push(`${path} → ${res?.status()}`);
      continue;
    }
    if (path.startsWith('/demo/koordinator/episode') || path.startsWith('/demo/pasien')) continue;
    const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href')!));
    for (const h of hrefs) {
      if (!h.startsWith('/') || h.startsWith('//')) continue;
      const clean = h.split('#')[0]!;
      if (clean.startsWith('/demo/mulai')) {
        if (!seen.has('mulai')) {
          seen.add('mulai');
          const r = await request.get(clean, { maxRedirects: 0 });
          if (r.status() !== 303) broken.push(`${clean} → ${r.status()}`);
        }
        continue;
      }
      if (!seen.has(clean) && !clean.startsWith('/api/') && !clean.startsWith('/keluar')) queue.push(clean);
    }
  }
  expect(broken).toEqual([]);
  expect(seen.size).toBeGreaterThan(15);
});

for (const path of PAGES) {
  test(`axe: tanpa pelanggaran kritis/serius di ${path}`, async ({ page }) => {
    await page.goto(path);
    const r = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const bad = r.violations.filter((v) => ['critical', 'serious'].includes(v.impact ?? ''));
    expect(
      bad.map(
        (v) =>
          `${v.id}: ${v.nodes
            .map((n) => n.target.join(' '))
            .slice(0, 3)
            .join(' | ')}`,
      ),
    ).toEqual([]);
  });
}

test('sitemap, robots, metadata, JSON-LD', async ({ page, request }) => {
  const sitemap = await (await request.get('/sitemap.xml')).text();
  for (const p of PAGES) expect(sitemap).toContain(`<loc>http://localhost:3100${p === '/' ? '' : p}`);
  expect(await (await request.get('/robots.txt')).text()).toContain('Disallow: /app');
  await page.goto('/');
  await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
  expect(await page.locator('script[type="application/ld+json"]').textContent()).toContain('"Organization"');
});
