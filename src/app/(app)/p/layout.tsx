import type { Metadata } from 'next';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';

export const metadata: Metadata = { title: 'Perjalanan Anda', robots: { index: false, follow: false }, referrer: 'no-referrer' };

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader variant="patient" />
      <main id="isi" className="flex-1">
        {children}
      </main>
      <SiteFooter noReferrer />
    </>
  );
}
