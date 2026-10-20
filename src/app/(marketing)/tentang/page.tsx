import type { Metadata } from 'next';
import { PageHero } from '@/components/marketing/PageHero';
import { Placeholder } from '@/components/ui';
import { brand } from '@/config/brand.config';

export const metadata: Metadata = {
  title: 'Tentang',
  description: `Visi, masalah yang diselesaikan, dan prinsip ${brand.name}.`,
};

export default function Tentang() {
  return (
    <>
      <PageHero
        eyebrow="Tentang"
        title="Perjalanan ke rumah sakit seharusnya tidak lebih melelahkan daripada pemeriksaannya."
      />
      <section className="container-page grid gap-10 py-12 lg:grid-cols-2">
        <div className="prose-rs">
          <h2>Visi</h2>
          <p>
            Pasien dari luar kota bisa menyelesaikan rangkaian pemeriksaan non-darurat dalam sesedikit mungkin
            kedatangan, dengan biaya dan waktu yang bisa diperkirakan sejak awal.
          </p>
          <h2>Masalah yang kami selesaikan</h2>
          <p>
            Jadwal layanan, dokumen, pendamping, dan transportasi diurus terpisah-pisah. Akibatnya pasien
            bolak-balik, biaya menumpuk, dan slot rumah sakit terbuang karena pembatalan mendadak. Belum ada
            yang mengoptimalkan seluruh rangkaian sekaligus.
          </p>
        </div>
        <div className="prose-rs">
          <h2>Prinsip</h2>
          <ul>
            <li>
              <strong>Tidak menggantikan keputusan klinis.</strong> Prioritas medis milik tenaga kesehatan.
            </li>
            <li>
              <strong>Gagal-aman.</strong> Jika tidak yakin, sistem tidak mengonfirmasi dan menyerahkan ke
              koordinator.
            </li>
            <li>
              <strong>Adil untuk pasien lain.</strong> Penahanan jadwal dibatasi dan dampaknya diukur.
            </li>
            <li>
              <strong>Jujur soal bukti.</strong> Angka simulasi selalu diberi label, dan tidak dianggap bukti
              lapangan.
            </li>
          </ul>
          <h2>Tim</h2>
          <p>
            <Placeholder>[ISI: nama dan peran anggota tim]</Placeholder>
          </p>
          <p>
            <Placeholder>[ISI: penasihat klinis/operasional bila ada]</Placeholder>
          </p>
        </div>
      </section>
    </>
  );
}
