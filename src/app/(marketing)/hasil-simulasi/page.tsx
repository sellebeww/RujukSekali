import type { Metadata } from 'next';
import { PageHero } from '@/components/marketing/PageHero';
import { ResultTiles, SimulationLabel, TtlTradeoff } from '@/components/SimulationResults';
import { Notice, SectionTitle } from '@/components/ui';
import { simulation, ttlLabel } from '@/content/simulation';

export const metadata: Metadata = {
  title: 'Hasil simulasi',
  description:
    'Metodologi dan hasil simulasi data sintetis: pesan satu per satu vs perjalanan terkoordinasi, serta eksperimen batas waktu penahanan.',
};

export default function HasilSimulasi() {
  const p = simulation.params as Record<string, number | Record<string, number>>;
  return (
    <>
      <PageHero
        eyebrow="Hasil simulasi"
        title="Apa yang terjadi jika satu rumah sakit menyusun perjalanan, bukan janji temu?"
        lead="Kami mensimulasikan empat minggu kedatangan pasien luar kota dan pasien lokal pada kapasitas yang sama, dengan dua cara memesan."
      >
        <SimulationLabel />
      </PageHero>

      <section className="container-page py-12" aria-labelledby="ringkas">
        <SectionTitle
          id="ringkas"
          eyebrow="Ringkasan"
          title={`Pesan satu per satu vs terkoordinasi (TTL ${ttlLabel(simulation.defaultTtlMin)})`}
        />
        <div className="mt-6">
          <ResultTiles />
        </div>
      </section>

      <section className="border-y border-line bg-paper-deep/50" aria-labelledby="ttl">
        <div className="container-page py-12">
          <SectionTitle
            id="ttl"
            eyebrow="Eksperimen TTL"
            title="Berapa lama jadwal sebaiknya ditahan?"
            lead="Penahanan lebih lama memberi pasien waktu melengkapi dokumen — lebih banyak penahanan berakhir terkonfirmasi. Tetapi kapasitas tertahan lebih lama dan pasien lain lebih sering gagal mendapat jadwal. Garis tipis vertikal menunjukkan variasi antar-seed."
          />
          <div className="mt-6">
            <TtlTradeoff />
          </div>
        </div>
      </section>

      <section className="container-page grid gap-10 py-12 lg:grid-cols-2">
        <div className="prose-rs">
          <h2>Metode</h2>
          <ul>
            <li>
              Simulasi kejadian diskrit dengan pembangkit acak ber-seed ({simulation.seeds.length} seed:{' '}
              {simulation.seeds.join(', ')}); hasil bisa diulang persis.
            </li>
            <li>
              Satu rumah sakit fiktif, laboratorium darah (2 bilik) dan poli penyakit dalam (2 ruang),{' '}
              {String(p.days)} hari kedatangan.
            </li>
            <li>
              ±{String(p.arrivalsPerDay)} episode luar kota per hari dari 5 kabupaten fiktif, ditambah
              permintaan pasien lokal sebagai beban latar.
            </li>
            <li>
              Peluang dokumen siap saat datang {Math.round(Number(p.pDocsReady) * 100)}%, rata-rata
              keterlambatan dokumen {String(p.docDelayMeanH)} jam, tidak hadir{' '}
              {Math.round(Number(p.noShowRate) * 100)}%, pembatalan di luar sistem{' '}
              {Math.round(Number(p.pCancelAfterConfirm) * 100)}%.
            </li>
            <li>
              <strong>Pembanding:</strong> setiap layanan dipesan sendiri-sendiri pada slot paling awal yang
              memungkinkan. Bila konsultasi jatuh sebelum hasil lab siap, kunjungan itu sia-sia dan harus
              diulang. Kekurangan dokumen baru ketahuan menjelang kunjungan.
            </li>
            <li>
              <strong>Terkoordinasi:</strong> mesin penyusun yang sama dengan aplikasi, penahanan dengan batas
              waktu dan batas rasio {Math.round(Number(p.maxHoldRatio) * 100)}%, konfirmasi hanya setelah
              syarat lengkap.
            </li>
          </ul>
        </div>
        <div className="prose-rs">
          <h2>Batasan — baca ini sebelum mengutip angka</h2>
          <ul>
            <li>Semua data sintetis. Tidak ada pasien, rumah sakit, atau jadwal sungguhan.</li>
            <li>
              Parameter (peluang dokumen, pendamping, pembatalan) adalah asumsi, bukan hasil pengukuran.
            </li>
            <li>
              Model belum memasukkan keterlambatan layanan, antrean di loket, atau perilaku koordinator.
            </li>
            <li>
              Kapasitas pada skenario ini cukup longgar sehingga rencana terkoordinasi hampir selalu muat
              dalam 1 hari; pada kapasitas lebih padat hasilnya bisa berbeda.
            </li>
            <li>
              Hasil ini tidak boleh dipakai sebagai dasar kesimpulan operasional atau klinis. Pilot lapangan
              diperlukan.
            </li>
          </ul>
          <p>
            Rincian lengkap ada di dokumen <code>docs/EKSPERIMEN-TTL.md</code> dan data mentahnya di{' '}
            <code>sim/out/</code>.
          </p>
        </div>
      </section>
      <section className="container-page pb-12">
        <Notice tone="ochre" title={simulation.label} />
      </section>
    </>
  );
}
