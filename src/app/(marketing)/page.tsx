import { HeroArt } from '@/components/HeroArt';
import { Steps } from '@/components/marketing/Steps';
import { ResultTiles, SimulationLabel } from '@/components/SimulationResults';
import { LinkButton, SectionTitle } from '@/components/ui';
import { brand } from '@/config/brand.config';
import { links, siteRoutes, withFrom } from '@/config/links';

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: brand.name,
  description: brand.description,
  url: links.site.absolute('/'),
  logo: links.site.absolute('/icon.svg'),
};

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="paper-grain border-b border-line">
        <div className="container-page grid items-center gap-10 py-14 lg:grid-cols-[1.1fr_1fr] lg:py-20">
          <div>
            <p className="fade-up text-sm font-semibold tracking-wide text-clay uppercase">
              Koordinasi layanan untuk pasien luar kota
            </p>
            <h1 className="fade-up mt-3 text-5xl leading-[1.05] [animation-delay:80ms] sm:text-6xl">
              Satu perjalanan untuk semua pemeriksaan.
            </h1>
            <p className="fade-up mt-5 max-w-xl text-xl text-ink-soft [animation-delay:160ms]">
              Pasien dari luar kota sering bolak-balik karena jadwal lab, poli, dokumen, dan pendamping tidak
              selaras. {brand.name} menyusunnya menjadi satu rangkaian kunjungan yang benar-benar bisa
              dijalani.
            </p>
            <div className="fade-up mt-8 flex flex-wrap gap-3 [animation-delay:240ms]">
              <LinkButton href={withFrom(links.demo.home(), siteRoutes.home)} external>
                Coba Demo Aplikasi
              </LinkButton>
              <LinkButton href={links.site.mintaDemo()} tone="accent">
                Minta Pilot
              </LinkButton>
            </div>
            <p className="mt-4 text-sm text-muted">Demo memakai data sintetis. Tidak perlu akun.</p>
          </div>
          <div className="ticket p-4">
            <HeroArt />
            <p className="px-2 pb-1 text-sm text-muted">
              Contoh: lab pagi dalam keadaan puasa, konsultasi setelah hasil siap, pulang di hari yang sama.
            </p>
          </div>
        </div>
      </section>

      <section className="container-page py-16" aria-labelledby="masalah">
        <SectionTitle
          id="masalah"
          eyebrow="Masalahnya"
          title="Jadwal yang tidak selaras membuat pasien datang berkali-kali."
        />
        <ul className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            [
              'Bolak-balik',
              'Lab hari ini, konsultasi minggu depan, lalu kembali lagi karena hasil belum ada. Setiap kedatangan berarti perjalanan jauh dari kabupaten.',
            ],
            [
              'Biaya menumpuk',
              'Tiket, penginapan, makan, dan hari kerja yang hilang — untuk pasien dan pendampingnya — bertambah setiap kali harus datang lagi.',
            ],
            [
              'Slot terbuang',
              'Saat dokumen belum siap atau pendamping berhalangan, jadwal dibatalkan mendadak dan slot sering kosong tanpa sempat dipakai pasien lain.',
            ],
          ].map(([t, b]) => (
            <li key={t} className="ticket p-5">
              <h3 className="text-2xl">{t}</h3>
              <p className="mt-2 text-ink-soft">{b}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-y border-line bg-paper-deep/50" aria-labelledby="cara">
        <div className="container-page py-16">
          <SectionTitle
            id="cara"
            eyebrow="Cara kerja"
            title="Susun → tahan → konfirmasi → jalani"
            lead="Empat langkah, dengan koordinator rumah sakit sebagai pengambil keputusan."
          />
          <div className="mt-8">
            <Steps detailed />
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton
              href={links.demo.start('1', { stage: 'tahan', view: 'pasien', from: siteRoutes.home })}
              external
              tone="secondary"
            >
              Lihat Contoh Perjalanan Pasien
            </LinkButton>
            <LinkButton href={withFrom(links.demo.coordinator(), siteRoutes.home)} external tone="secondary">
              Coba sebagai Koordinator
            </LinkButton>
          </div>
        </div>
      </section>

      <section className="container-page py-16" aria-labelledby="beda">
        <SectionTitle
          id="beda"
          eyebrow="Pembeda"
          title="Yang dikelola adalah perjalanan, bukan janji temu."
        />
        <div className="ticket mt-8 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left">
            <thead className="border-b border-line bg-paper-deep/60">
              <tr>
                <th className="px-4 py-3" scope="col"></th>
                <th className="px-4 py-3" scope="col">
                  Janji temu satu per satu
                </th>
                <th className="px-4 py-3 text-teal" scope="col">
                  Satu perjalanan terkoordinasi
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Unit yang diatur', 'Satu slot di satu layanan', 'Seluruh episode layanan pasien'],
                [
                  'Urutan layanan',
                  'Pasien yang mengingat',
                  'Diperiksa sistem: hasil lab siap sebelum konsultasi',
                ],
                [
                  'Dokumen & pendamping',
                  'Ketahuan kurang saat datang',
                  'Syarat sebelum jadwal menjadi pasti',
                ],
                ['Transportasi', 'Tidak diperhitungkan', 'Jam tiba dan pulang ikut dihitung'],
                ['Pasien lain', 'Slot batal mendadak', 'Penahanan dibatasi waktu dan porsi kapasitas'],
              ].map(([k, a, b]) => (
                <tr key={k} className="border-b border-line/60">
                  <th scope="row" className="px-4 py-3 font-semibold">
                    {k}
                  </th>
                  <td className="px-4 py-3 text-ink-soft">{a}</td>
                  <td className="px-4 py-3">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border-y border-line bg-paper-deep/50" aria-labelledby="hasil">
        <div className="container-page py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionTitle
              id="hasil"
              eyebrow="Hasil simulasi"
              title="Lebih sedikit kedatangan, lebih sedikit slot terbuang."
            />
            <SimulationLabel />
          </div>
          <div className="mt-8">
            <ResultTiles />
          </div>
          <p className="mt-4 max-w-3xl text-sm text-muted">
            Angka dicoret = memesan tiap layanan sendiri-sendiri pada skenario sintetis yang sama. Ini
            menunjukkan cara kerja sistem, bukan bukti hasil di rumah sakit.{' '}
            <a href={links.site.hasilSimulasi()} className="text-teal underline">
              Lihat metode dan batasannya
            </a>
            .
          </p>
        </div>
      </section>

      <section className="container-page py-16" aria-labelledby="siapa">
        <SectionTitle id="siapa" eyebrow="Untuk siapa" title="Dibuat untuk tiga orang yang berbeda." />
        <ul className="mt-8 grid gap-4 md:grid-cols-3">
          <li className="ticket p-5">
            <h3 className="text-2xl">Manajemen rumah sakit</h3>
            <p className="mt-2 text-ink-soft">
              Metrik yang jelas: kunjungan per episode, pembatalan, dan slot terbuang — dengan pilot kecil
              yang terukur.
            </p>
            <a
              href={links.site.untukRumahSakit()}
              className="mt-3 inline-block font-semibold text-teal underline"
            >
              Untuk rumah sakit →
            </a>
          </li>
          <li className="ticket p-5">
            <h3 className="text-2xl">Koordinator & unit layanan</h3>
            <p className="mt-2 text-ink-soft">
              Antrean tindakan, opsi yang sudah dicek, dan kendali penuh: setujui, ubah, lepas, atau
              perpanjang dengan alasan.
            </p>
            <a
              href={withFrom(links.demo.coordinator(), siteRoutes.home)}
              className="mt-3 inline-block font-semibold text-teal underline"
            >
              Coba dashboard demo →
            </a>
          </li>
          <li className="ticket p-5">
            <h3 className="text-2xl">Pasien & keluarga</h3>
            <p className="mt-2 text-ink-soft">
              Tahu kapan datang, apa yang dibawa, dan berapa perkiraan biayanya — dari satu tautan, tanpa
              aplikasi.
            </p>
            <a
              href={links.site.untukPasien()}
              className="mt-3 inline-block font-semibold text-teal underline"
            >
              Untuk pasien →
            </a>
          </li>
        </ul>
      </section>

      <section className="bg-teal text-paper">
        <div className="container-page flex flex-wrap items-center justify-between gap-6 py-14">
          <div className="max-w-2xl">
            <h2 className="text-4xl">Mulai dari satu rumah sakit dan dua layanan.</h2>
            <p className="mt-2 text-lg text-paper/80">
              Kami mencari mitra pilot yang ingin mengukur dampaknya bersama, dengan koordinator tetap
              memegang keputusan.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href={links.site.mintaDemo()}
              className="inline-flex min-h-11 items-center rounded-full bg-clay px-6 font-semibold text-white hover:bg-[#7d2f18]"
            >
              Minta Pilot
            </a>
            <a
              href={withFrom(links.demo.home(), siteRoutes.home)}
              className="inline-flex min-h-11 items-center rounded-full border border-paper/40 px-6 font-semibold hover:bg-paper/10"
            >
              Coba Demo
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
