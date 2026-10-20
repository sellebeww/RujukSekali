// Repository policies: no hard-coded product name or cross-zone URL, and every content placeholder is inventoried.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { brand } from '@/config/brand.config';
import { siteRoutes } from '@/config/links';

function files(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) files(p, out);
    else if (/\.(tsx?|css)$/.test(f)) out.push(p);
  }
  return out;
}
const src = files('src');
const read = (f: string) => readFileSync(f, 'utf8');

describe('kebijakan repo', () => {
  it('nama produk hanya ada di brand.config.ts', () => {
    const offenders = src.filter((f) => !f.endsWith('brand.config.ts') && read(f).includes(brand.name));
    expect(offenders).toEqual([]);
  });

  it('tidak ada href ke path internal yang di-hard-code (semua lewat links.ts)', () => {
    const internal = [
      ...Object.values(siteRoutes).filter((p) => p !== '/'),
      '/app',
      '/demo',
      '/p/',
      '/masuk',
    ];
    const offenders: string[] = [];
    for (const f of src) {
      if (f.endsWith(path.join('config', 'links.ts'))) continue;
      const text = read(f);
      for (const m of text.matchAll(/href=["'{]`?["']?(\/[a-z-]*)/g)) {
        if (internal.some((p) => m[1] === p || m[1]!.startsWith(p))) offenders.push(`${f}: ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('semua placeholder [ISI: …] tercatat di docs/COMPANY-PROFILE.md', () => {
    const doc = read('docs/COMPANY-PROFILE.md');
    const found = new Set<string>();
    for (const f of src) for (const m of read(f).matchAll(/\[ISI: [^\]]+\]/g)) found.add(m[0]);
    expect(found.size).toBeGreaterThan(0);
    const missing = [...found].filter((p) => !doc.includes(p));
    expect(missing).toEqual([]);
  });

  it('tidak ada klaim kepatuhan, integrasi, atau testimoni karangan di konten publik', () => {
    const publicFiles = src.filter(
      (f) => f.includes('(marketing)') || f.includes(path.join('src', 'content')) || f.includes('marketing'),
    );
    const banned = [
      /patuh (UU|terhadap)/i,
      /terintegrasi dengan (BPJS|SATUSEHAT|SIMRS)/i,
      /bersertifikat/i,
      /testimoni/i,
      /dipercaya oleh/i,
    ];
    const hits = publicFiles.flatMap((f) => banned.filter((b) => b.test(read(f))).map((b) => `${f}: ${b}`));
    expect(hits).toEqual([]);
  });
});
