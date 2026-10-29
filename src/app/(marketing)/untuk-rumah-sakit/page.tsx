import type { Metadata } from 'next';
import { PageHero } from '@/components/marketing/PageHero';
import { LinkButton, Notice, SectionTitle } from '@/components/ui';
import { links } from '@/config/links';

export const metadata: Metadata = {
  title: 'Untuk rumah sakit',
  description:
    'Manfaat operasional, metrik yang dilacak, model kerja sama, dan tahap pilot satu rumah sakit dengan dua layanan.',
};

export default function UntukRS() {
  return (
    <>
      <PageHero
        eyebrow="Untuk rumah sakit & jaringan layanan"
        title="Kurangi kedatangan berulang tanpa menambah beban koordinator."
        lead="Koordinator tetap memutuskan. Sistem menyiapkan opsi yang sudah dicek, menahan jadwal secara bertanggung jawab, dan mengonfirmasi hanya saat syarat lengkap."
      >
        <LinkButton href={links.site.mintaDemo()} tone="accent">
          Minta Pilot
        </LinkButton>
        <LinkButton href={links.app.login()} external tone="secondary">
          Coba dashboard demo
        </LinkButton>
      </PageHero>

      <section className="container-page py-14" aria-labelledby="manfaat">
        <SectionTitle id="manfaat" eyebrow="Manfaat operasional" title="Yang berubah untuk unit layanan." />
        <ul className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[
            [
              'Antrean tindakan, bukan daftar pasien',
              'Kasus mendesak, perlu disusun ulang, dan penahanan yang hampir habis tampil paling atas.',
            ],
            [
              'Opsi yang sudah dicek',
              'Urutan layanan, puasa, waktu hasil lab, pendamping, dan transportasi diperiksa sebelum opsi ditampilkan.',
            ],
            [
              'Penahanan yang bertanggung jawab',
              'Batas waktu bertingkat, batas perpanjangan, dan batas porsi slot yang boleh ditahan per hari.',
            ],
            [
              'Tidak ada slot yatim',
              'Penahanan dibuat untuk semua kunjungan atau tidak sama sekali; kegagalan sebagian dibatalkan otomatis.',
            ],
            [
              'Jejak yang lengkap',
              'Setiap perubahan status tercatat: siapa, kapan, apa, dan alasannya. Catatan tidak bisa diubah.',
            ],
            [
              'Pasien tanpa aplikasi',
              'Pasien menerima tautan berumur pendek yang bisa dicabut. Notifikasi tanpa detail klinis.',
            ],
          ].map(([t, b]) => (
            <li key={t} className="ticket p-5">
              <h3 className="font-sans text-lg font-bold">{t}</h3>
              <p className="mt-1 text-ink-soft">{b}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-y border-line bg-paper-deep/50" aria-labelledby="metrik">
        <div className="container-page grid gap-10 py-14 lg:grid-cols-2">
          <div>
            <SectionTitle id="metrik" eyebrow="Yang diukur" title="Metrik yang disepakati sejak awal." />
            <ul className="prose-rs mt-4">
              <li>Hari kunjungan per episode selesai</li>
              <li>Tingkat pembatalan setelah konfirmasi</li>
              <li>
                Slot terbuang (kosong saat jam layanan karena batal mendadak, tidak hadir, atau penahanan
                habis)
              </li>
              <li>Hold-to-confirm, rata-rata durasi penahanan, slot-jam tertahan</li>
              <li>Displacement: pasien lain yang gagal mendapat jadwal saat slot ditahan</li>
              <li>Perkiraan biaya pasien per episode</li>
            </ul>
            <p className="mt-4">
              <a href={links.site.hasilSimulasi()} className="font-semibold text-teal underline">
                Lihat hasil simulasi dan batasannya →
              </a>
            </p>
          </div>
          <div>
            <SectionTitle eyebrow="Model kerja sama" title="Kontrak dengan jaringan layanan." />
            <p className="mt-4 text-ink-soft">
              Garis besarnya: kerja sama dengan rumah sakit atau jaringan layanan, dengan target yang diukur
              pada metrik di samping. Rincian komersial dibahas bersama mitra pilot.{' '}
              <span className="text-muted">[ISI: ringkasan model harga bila sudah ada]</span>
            </p>
          </div>
        </div>
      </section>

      <section className="container-page grid gap-10 py-14 lg:grid-cols-2" aria-label="Pilot">
        <div>
          <SectionTitle eyebrow="Tahap pilot" title="Sempit dulu, terukur, lalu diperluas." />
          <ol className="prose-rs mt-4">
            <li>
              <strong>1 rumah sakit, 2 layanan non-darurat</strong> — misalnya laboratorium darah dan poli
              penyakit dalam.
            </li>
            <li>
              <strong>Koordinator manual</strong> menyetujui, mengubah, atau melepas setiap rencana.
            </li>
            <li>
              <strong>Pengukuran dasar</strong> beberapa minggu sebelum dan selama pilot, dengan metrik yang
              sama.
            </li>
            <li>
              <strong>Tinjauan bersama</strong> sebelum menambah layanan atau fasilitas.
            </li>
          </ol>
        </div>
        <div>
          <SectionTitle eyebrow="Yang dibutuhkan dari rumah sakit" title="Persiapan pilot." />
          <ul className="prose-rs mt-4">
            <li>Satu koordinator dan satu admin unit sebagai penanggung jawab harian.</li>
            <li>Data kapasitas jadwal dua layanan (bisa diekspor manual pada awal pilot).</li>
            <li>Aturan persiapan layanan dan masa berlaku dokumen yang berlaku di rumah sakit.</li>
            <li>Peninjauan oleh tim hukum/DPO rumah sakit sebelum memakai data pasien sungguhan.</li>
          </ul>
        </div>
      </section>

      <section className="container-page pb-14">
        <Notice tone="teal" title="Manusia tetap memegang keputusan">
          Sistem tidak menentukan prioritas klinis dan tidak memberi saran medis. Integrasi dengan SIMRS,
          BPJS, atau SATUSEHAT belum tersedia; itu rencana tahap berikutnya.
        </Notice>
      </section>
    </>
  );
}
