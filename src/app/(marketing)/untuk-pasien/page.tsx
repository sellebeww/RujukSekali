import type { Metadata } from 'next';
import { PageHero } from '@/components/marketing/PageHero';
import { LinkButton, Notice } from '@/components/ui';
import { links, siteRoutes } from '@/config/links';
import { patientFaq } from '@/content/faq';

export const metadata: Metadata = {
  title: 'Untuk pasien',
  description: 'Apa yang akan terjadi, apa yang perlu disiapkan, dan bagaimana data Anda dilindungi.',
};

export default function UntukPasien() {
  return (
    <div className="text-lg">
      <PageHero
        eyebrow="Untuk pasien & keluarga"
        title="Datang sekali, semua beres."
        lead="Rumah sakit mengatur jadwal Anda supaya bisa selesai dalam sesedikit mungkin kedatangan."
      >
        <LinkButton
          href={links.demo.start('1', { stage: 'tahan', view: 'pasien', from: siteRoutes.untukPasien })}
          external
        >
          Lihat contoh halaman pasien
        </LinkButton>
      </PageHero>

      <section className="container-page max-w-3xl py-12" aria-labelledby="terjadi">
        <h2 id="terjadi" className="text-3xl">
          Apa yang akan terjadi
        </h2>
        <ol className="mt-5 space-y-4">
          {[
            [
              'Petugas mencatat kebutuhan Anda',
              'Misalnya pemeriksaan darah lalu konsultasi. Juga dari mana Anda datang dan apakah perlu pendamping.',
            ],
            [
              'Jadwal ditahan sementara untuk Anda',
              'Anda menerima tautan. Di sana terlihat tanggal, jam, tempat, dan apa yang perlu disiapkan.',
            ],
            [
              'Anda melengkapi syarat',
              'Kirim foto surat rujukan, dan pendamping menekan tombol "bisa ikut".',
            ],
            [
              'Jadwal menjadi pasti',
              'Setelah semua syarat lengkap dan petugas setuju. Anda menerima pesan berisi jadwal.',
            ],
          ].map(([t, b], i) => (
            <li key={t} className="ticket flex gap-4 p-5">
              <span className="font-display text-4xl text-teal" aria-hidden="true">
                {i + 1}
              </span>
              <div>
                <h3 className="font-sans text-xl font-bold">{t}</h3>
                <p className="text-ink-soft">{b}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-line bg-paper-deep/50" aria-labelledby="siapkan">
        <div className="container-page max-w-3xl py-12">
          <h2 id="siapkan" className="text-3xl">
            Yang perlu disiapkan
          </h2>
          <ul className="prose-rs mt-4">
            <li>Kartu identitas dan kartu jaminan kesehatan bila ada.</li>
            <li>Surat rujukan dan hasil pemeriksaan sebelumnya (bawa aslinya).</li>
            <li>Bila diminta: datang dalam keadaan puasa. Petunjuknya ada di halaman tautan Anda.</li>
            <li>Bila perlu pendamping: pastikan pendamping bisa ikut di semua hari kunjungan.</li>
          </ul>
        </div>
      </section>

      <section className="container-page max-w-3xl py-12" aria-labelledby="tanya">
        <h2 id="tanya" className="text-3xl">
          Pertanyaan yang sering muncul
        </h2>
        <div className="mt-5 space-y-3">
          {patientFaq.map((f) => (
            <details key={f.id} id={f.id} className="ticket p-5">
              <summary className="cursor-pointer text-xl font-semibold">{f.q}</summary>
              <p className="mt-2 text-ink-soft">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="container-page max-w-3xl pb-12" aria-labelledby="data">
        <h2 id="data" className="text-3xl">
          Bagaimana data Anda dilindungi
        </h2>
        <ul className="prose-rs mt-4">
          <li>Hanya data yang diperlukan untuk jadwal yang dicatat. Tidak ada diagnosis di sistem ini.</li>
          <li>Nomor NIK tidak disimpan apa adanya.</li>
          <li>Pesan yang dikirim hanya berisi waktu, tempat, dan petunjuk umum — tanpa detail kesehatan.</li>
          <li>Tautan Anda berumur pendek dan bisa dicabut petugas.</li>
        </ul>
        <p className="mt-4">
          <a href={links.site.keamananPrivasi()} className="font-semibold text-teal underline">
            Baca prinsip keamanan & privasi
          </a>
        </p>
        <div className="mt-6">
          <Notice tone="danger" title="Darurat?">
            Jangan menunggu jadwal. Segera ke IGD terdekat atau hubungi 119.
          </Notice>
        </div>
      </section>
    </div>
  );
}
