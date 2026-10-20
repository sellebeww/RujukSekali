import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { links } from '@/config/links';

export default function NotFound() {
  return (
    <>
      <SiteHeader variant="marketing" />
      <main id="isi" className="container-page flex-1 py-16">
        <p className="text-sm font-semibold tracking-wide text-clay uppercase">Halaman tidak ditemukan</p>
        <h1 className="mt-2 text-5xl">Jalan ini buntu.</h1>
        <p className="mt-4 max-w-xl text-lg text-ink-soft">
          Mungkin tautannya salah ketik atau halamannya sudah dipindah. Coba salah satu tujuan ini:
        </p>
        <ul className="mt-6 flex flex-wrap gap-3">
          {[
            [links.site.home(), 'Beranda'],
            [links.site.caraKerja(), 'Cara kerja'],
            [links.site.untukPasien(), 'Untuk pasien'],
            [links.site.faq(), 'FAQ'],
            [links.demo.home(), 'Coba demo'],
          ].map(([href, label]) => (
            <li key={href}>
              <a
                href={href}
                className="inline-flex min-h-11 items-center rounded-full border border-line bg-card px-5 font-semibold hover:bg-paper-deep"
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-muted">
          Pasien yang tautannya tidak bisa dibuka: minta tautan baru kepada petugas rumah sakit.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
