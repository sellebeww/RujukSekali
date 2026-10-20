import { describe, expect, it } from 'vitest';
import { links, returnHref, safeReturnPath, siteRoutes, withFrom } from '@/config/links';

describe('?from= open-redirect guard', () => {
  it.each(Object.values(siteRoutes))('menerima path profile internal %s', (p) => {
    expect(safeReturnPath(p)).toBe(p);
  });
  it('menerima anchor sederhana', () => {
    expect(safeReturnPath('/cara-kerja#langkah-tahan')).toBe('/cara-kerja#langkah-tahan');
  });
  it.each([
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    '/%2F%2Fevil.example',
    'javascript:alert(1)',
    '/app',
    '/p',
    '/cara-kerja/../app',
    '/cara-kerja?x=1',
    '/cara-kerja#<script>',
    ' /faq',
    '',
    null,
    undefined,
  ])('menolak %s → beranda', (bad) => {
    expect(safeReturnPath(bad as string)).toBe('/');
    expect(returnHref(bad as string)).toBe(links.site.home());
  });
  it('withFrom menambah parameter dengan benar', () => {
    expect(withFrom('/demo', siteRoutes.faq)).toBe('/demo?from=%2Ffaq');
    expect(withFrom('/demo/mulai?skenario=1', siteRoutes.faq)).toBe('/demo/mulai?skenario=1&from=%2Ffaq');
  });
  it('tautan demo pasien tidak pernah mengarah ke halaman pasien sungguhan', () => {
    expect(links.demo.start('1', { view: 'pasien' })).toMatch(/^\/demo\//);
    expect(links.demo.patient('x')).toMatch(/^\/demo\/pasien\//);
  });
});
