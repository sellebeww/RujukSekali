import { brand } from '@/config/brand.config';
import { links } from '@/config/links';
import { Logo } from './Logo';

export function SiteFooter({ noReferrer = false }: { noReferrer?: boolean }) {
  const rel = noReferrer ? 'noopener noreferrer' : undefined;
  const cols = [
    {
      title: 'Produk',
      items: [
        { href: links.site.caraKerja(), label: 'Cara kerja' },
        { href: links.site.untukRumahSakit(), label: 'Untuk rumah sakit' },
        { href: links.site.untukPasien(), label: 'Untuk pasien' },
        { href: links.site.hasilSimulasi(), label: 'Hasil simulasi' },
      ],
    },
    {
      title: 'Perusahaan',
      items: [
        { href: links.site.tentang(), label: 'Tentang' },
        { href: links.site.keamananPrivasi(), label: 'Keamanan & Privasi' },
        { href: links.site.faq(), label: 'FAQ' },
        { href: links.site.mintaDemo('kontak'), label: 'Kontak' },
      ],
    },
    {
      title: 'Legal',
      items: [
        { href: links.site.kebijakanPrivasi(), label: 'Kebijakan privasi' },
        { href: links.site.syarat(), label: 'Syarat penggunaan' },
      ],
    },
  ];
  return (
    <footer className="mt-auto border-t border-line bg-paper-deep/60">
      <div className="container-page grid gap-8 py-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-3 text-[0.95rem] text-ink-soft">{brand.tagline}</p>
          <p className="mt-4 text-sm text-muted">
            {brand.name} mengoordinasikan jadwal dan logistik kunjungan. Sistem ini{' '}
            <strong>tidak menggantikan penilaian klinis</strong>. Dalam keadaan darurat, segera ke IGD
            terdekat atau hubungi layanan gawat darurat 119.
          </p>
        </div>
        {cols.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <h2 className="font-sans text-sm font-bold tracking-wide text-muted uppercase">{c.title}</h2>
            <ul className="mt-3 space-y-2">
              {c.items.map((i) => (
                <li key={i.label}>
                  <a href={i.href} rel={rel} className="text-ink hover:text-teal hover:underline">
                    {i.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-line">
        <p className="container-page py-4 text-sm text-muted">
          © {new Date().getUTCFullYear()} {brand.legalEntity}. Semua data pasien dalam demo adalah data
          sintetis.
        </p>
      </div>
    </footer>
  );
}
