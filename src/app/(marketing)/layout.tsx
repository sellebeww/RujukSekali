import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader variant="marketing" />
      <main id="isi" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
