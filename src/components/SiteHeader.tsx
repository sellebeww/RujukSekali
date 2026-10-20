import Link from 'next/link';
import { links, withFrom, siteRoutes } from '@/config/links';
import { Logo } from './Logo';
import { SessionAwareCta } from './SessionAwareCta';

type Variant = 'marketing' | 'app' | 'demo' | 'patient';

interface NavItem {
  href: string;
  label: string;
}

const pill =
  'inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-3 py-2 text-[0.95rem] font-semibold transition-colors';

export function SiteHeader({
  variant,
  user,
  appNav = [],
}: {
  variant: Variant;
  user?: { name: string; role: string } | null;
  appNav?: NavItem[];
}) {
  const homeHref =
    variant === 'marketing'
      ? links.site.home()
      : variant === 'demo'
        ? links.demo.home()
        : variant === 'app'
          ? links.app.dashboard()
          : links.patient.home();

  const marketingNav: NavItem[] = [
    { href: links.site.caraKerja(), label: 'Cara Kerja' },
    { href: links.site.untukRumahSakit(), label: 'Untuk Rumah Sakit' },
    { href: links.site.untukPasien(), label: 'Untuk Pasien' },
    { href: links.site.keamananPrivasi(), label: 'Keamanan & Privasi' },
    { href: links.site.hasilSimulasi(), label: 'Hasil Simulasi' },
  ];
  // Patient pages: leaving links never carry the token and never send a Referer.
  const outRel = variant === 'patient' ? 'noopener noreferrer' : undefined;
  const profileNav: NavItem[] =
    variant === 'patient'
      ? [
          { href: links.site.untukPasien(), label: 'Tentang layanan ini' },
          { href: links.site.keamananPrivasi(), label: 'Privasi' },
        ]
      : [
          { href: links.site.tentang(), label: 'Tentang' },
          { href: links.site.caraKerja(), label: 'Panduan' },
        ];
  const nav = variant === 'marketing' ? marketingNav : appNav;

  return (
    <header className="border-b border-line bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/80">
      <div className="container-page flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 py-2">
        <Link href={homeHref} className="rounded-md no-underline" aria-label="Beranda">
          <Logo />
        </Link>

        <nav aria-label="Navigasi utama" className="order-3 w-full xl:order-none xl:w-auto xl:flex-1">
          <details className="group xl:hidden">
            <summary className={`${pill} cursor-pointer list-none border border-line bg-card`}>
              Menu{' '}
              <span aria-hidden="true" className="ml-1 transition-transform group-open:rotate-180">
                ▾
              </span>
            </summary>
            <ul className="mt-2 flex flex-col gap-1 pb-2">
              {[...nav, ...(variant === 'marketing' ? [] : profileNav)].map((n) => (
                <li key={n.href + n.label}>
                  <a href={n.href} rel={outRel} className={`${pill} w-full hover:bg-paper-deep`}>
                    {n.label}
                  </a>
                </li>
              ))}
            </ul>
          </details>
          <ul className="hidden items-center gap-0.5 xl:flex">
            {nav.map((n) => (
              <li key={n.href + n.label}>
                <a href={n.href} className={`${pill} hover:bg-paper-deep`}>
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-1">
          {variant !== 'marketing' && (
            <ul className="hidden items-center gap-1 xl:flex">
              {profileNav.map((n) => (
                <li key={n.label}>
                  <a href={n.href} rel={outRel} className={`${pill} text-ink-soft hover:bg-paper-deep`}>
                    {n.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
          {variant === 'marketing' && (
            <>
              <SessionAwareCta className={`${pill} hover:bg-paper-deep`} />
              <a
                href={withFrom(links.demo.home(), siteRoutes.home)}
                className={`${pill} bg-teal text-paper hover:bg-ink`}
              >
                Coba Demo
              </a>
            </>
          )}
          {variant === 'app' && user && (
            <form action={links.app.logout()} method="post" className="flex items-center gap-2">
              <span className="hidden text-sm text-muted sm:inline">{user.name}</span>
              <button className={`${pill} border border-line bg-card hover:bg-paper-deep`}>Keluar</button>
            </form>
          )}
        </div>
      </div>
    </header>
  );
}
