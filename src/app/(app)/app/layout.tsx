import type { Metadata } from 'next';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { links } from '@/config/links';
import { requireUser } from '@/server/auth';

export const metadata: Metadata = { robots: { index: false } };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const nav = [
    { href: links.app.dashboard(), label: 'Antrean' },
    { href: links.app.newEpisode(), label: 'Episode baru' },
    { href: links.app.metrics(), label: 'Metrik' },
    { href: links.app.inbox(), label: 'Kotak masuk' },
    { href: links.app.audit(), label: 'Audit' },
    ...(user.role !== 'coordinator' ? [{ href: links.app.adminUnit(), label: 'Kapasitas & aturan' }] : []),
    ...(user.role === 'system_admin' ? [{ href: links.app.adminLeads(), label: 'Permintaan demo' }] : []),
  ];
  return (
    <>
      <SiteHeader variant="app" user={user} appNav={nav} />
      <main id="isi" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
