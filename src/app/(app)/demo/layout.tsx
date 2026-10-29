import type { Metadata } from 'next';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { links } from '@/config/links';
import { ensureDemoFresh } from '@/server/demo';

export const metadata: Metadata = {
  title: { default: 'Mode demo', template: '%s · Mode demo' },
  robots: { index: false },
};
export const dynamic = 'force-dynamic';

export default async function DemoLayout({ children }: { children: React.ReactNode }) {
  await ensureDemoFresh();
  const nav = [
    { href: links.demo.home(), label: 'Mulai demo' },
    { href: links.demo.coordinator(), label: 'Antrean koordinator' },
    { href: links.demo.metrics(), label: 'Metrik' },
    { href: links.demo.inbox(), label: 'Kotak masuk' },
    { href: links.demo.audit(), label: 'Audit' },
    { href: links.demo.adminUnit(), label: 'Kapasitas' },
  ];
  return (
    <>
      <SiteHeader variant="demo" appNav={nav} />
      <main id="isi" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
