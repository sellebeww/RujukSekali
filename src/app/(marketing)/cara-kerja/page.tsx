import type { Metadata } from 'next';
import { BeforeAfter } from '@/components/BeforeAfter';
import { HoldArt } from '@/components/HoldArt';
import { PageHero } from '@/components/marketing/PageHero';
import { Steps } from '@/components/marketing/Steps';
import { LinkButton, Notice, SectionTitle } from '@/components/ui';
import { links, siteRoutes, withFrom } from '@/config/links';
import { sampleJourney } from '@/content/sampleJourney';

export const metadata: Metadata = {
  title: 'Cara kerja',
  description:
    'Bagaimana beberapa layanan disusun menjadi satu perjalanan: susun, tahan sementara, konfirmasi bila syarat siap, lalu jalani.',
};

export default function CaraKerja() {
  return (
    <>
      <PageHero
        eyebrow="Cara kerja"
        title="Dari beberapa janji temu terpisah menjadi satu perjalanan."
        lead="Sistem tidak hanya mencari slot kosong. Ia memeriksa apakah rangkaian kunjungan itu benar-benar bisa dijalani pasien: urutan layanan, waktu hasil lab, puasa, pendamping, dan jam bus atau kereta."
      >
        <LinkButton href={withFrom(links.demo.coordinator(), siteRoutes.caraKerja)} external>
          Coba sebagai Koordinator
        </LinkButton>
        <LinkButton
          href={links.demo.start('1', { stage: 'tahan', view: 'pasien', from: siteRoutes.caraKerja })}
          external
          tone="secondary"
        >
          Lihat Contoh Perjalanan Pasien
        </LinkButton>
      </PageHero>

      <section className="container-page py-14" aria-labelledby="banding">
        <SectionTitle
          id="banding"
          eyebrow="Sebelum dan sesudah"
          title="Jadwal yang sama, dua cara memesan."
          lead="Tekan tombol untuk membandingkan. Kalau dipesan sendiri-sendiri, konsultasi bisa jatuh sebelum hasil lab ada — pasien harus kembali."
        />
        <div className="mt-6">
          <BeforeAfter sample={sampleJourney} />
        </div>
      </section>

      <section className="border-y border-line bg-paper-deep/50" aria-labelledby="langkah">
        <div className="container-page py-14">
          <SectionTitle id="langkah" eyebrow="Empat langkah" title="Setiap langkah bisa Anda coba di demo." />
          <div className="mt-8">
            <Steps detailed from={siteRoutes.caraKerja} />
          </div>
        </div>
      </section>

      <section className="container-page grid gap-10 py-14 lg:grid-cols-2" aria-label="Penjelasan istilah">
        <div className="prose-rs">
          <h2 id="ditahan">Apa itu &ldquo;jadwal ditahan sementara&rdquo;?</h2>
          <p>
            Bayangkan memesan kursi bioskop yang disisihkan untuk Anda selama beberapa saat. Di sini, semua
            jadwal dalam satu rencana — misalnya ambil darah pukul 07.30 dan konsultasi pukul 11.00 —
            disisihkan bersama-sama untuk satu pasien.
          </p>
          <HoldArt />
          <ul>
            <li>Semuanya ditahan sekaligus, atau tidak sama sekali. Tidak ada setengah rencana.</li>
            <li>
              Ada batas waktunya (misalnya 2, 24, atau 48 jam). Bila habis, jadwal dilepas untuk pasien lain.
            </li>
            <li>Perpanjangan hanya oleh koordinator, dengan alasan, dan jumlahnya dibatasi.</li>
            <li>
              Porsi jadwal yang boleh ditahan per layanan per hari juga dibatasi, supaya pasien lain tetap
              kebagian.
            </li>
          </ul>
        </div>
        <div className="prose-rs">
          <h2 id="konfirmasi">Kapan jadwal menjadi pasti?</h2>
          <p>Hanya ketika semua syarat penting sudah siap:</p>
          <ul>
            <li>dokumen (misalnya surat rujukan) sudah diperiksa petugas,</li>
            <li>pendamping sudah menyatakan bisa ikut di semua hari kunjungan,</li>
            <li>jadwal transportasi masih memungkinkan untuk tiba dan pulang,</li>
            <li>koordinator rumah sakit sudah menyetujui rencananya.</li>
          </ul>
          <p>Kalau ada yang belum pasti, sistem memilih aman: jadwal tetap ditahan, bukan dikonfirmasi.</p>
        </div>
      </section>

      <section className="container-page pb-14">
        <Notice tone="clay" title="Bukan pengganti keputusan klinis">
          Sistem mengoordinasikan logistik. Prioritas klinis diisi tenaga kesehatan; kasus mendesak keluar
          dari alur otomatis dan ditangani langsung. Kondisi darurat: segera ke IGD.
        </Notice>
      </section>

      <section className="container-page pb-16" aria-labelledby="coba">
        <div className="ticket flex flex-col gap-5 p-6 sm:p-8 md:flex-row md:items-center">
          <div className="flex-1">
            <h2 id="coba" className="text-2xl sm:text-3xl">
              Lihat sendiri jadwal yang ditahan.
            </h2>
            <p className="mt-2 max-w-xl text-ink-soft">
              Demo langsung terbuka tanpa akun. Anda mendapat salinan skenario sendiri berisi data sintetis,
              jadi aman untuk mencoba tombol apa pun.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <LinkButton href={links.demo.start('1', { stage: 'tahan', from: siteRoutes.caraKerja })} external>
              Buka contoh rencana ditahan
            </LinkButton>
            <LinkButton href={withFrom(links.demo.home(), siteRoutes.caraKerja)} external tone="secondary">
              Pilih skenario lain
            </LinkButton>
          </div>
        </div>
      </section>
    </>
  );
}
