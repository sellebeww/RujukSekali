import type { Metadata } from 'next';
import { PageHero } from '@/components/marketing/PageHero';
import { Notice } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Keamanan & privasi',
  description:
    'Prinsip privasi: data minimum, tanpa detail klinis di notifikasi, audit log yang tidak bisa diubah, dan akses berdasarkan peran.',
};

const principles = [
  [
    'Data minimum',
    'Sistem hanya mencatat yang diperlukan untuk menyusun jadwal: nama samaran/inisial, daerah asal, jarak tempuh, kebutuhan mobilitas, dan jenis layanan. Tidak ada diagnosis atau catatan medis.',
  ],
  [
    'NIK tidak disimpan apa adanya',
    'Bila dimasukkan, NIK diubah menjadi sidik kunci satu arah (HMAC) untuk mencegah data ganda. NIK aslinya tidak tersimpan.',
  ],
  [
    'Notifikasi tanpa detail klinis',
    'Pesan ke pasien hanya memuat waktu, tempat, dan petunjuk umum seperti "datang dalam keadaan puasa". Nama layanan atau spesialisasi tidak disebut.',
  ],
  [
    'Tautan pasien berumur pendek',
    'Tanpa password, tetapi berlaku terbatas dan bisa dicabut. Saat dibuka, tautan ditukar menjadi sesi aman sehingga tidak tertinggal di alamat halaman, dan tidak dikirim ke situs lain saat Anda berpindah halaman.',
  ],
  [
    'Akses berdasarkan peran',
    'Koordinator, admin unit, dan admin sistem punya hak berbeda. Hak akses diperiksa di server, bukan hanya di tampilan.',
  ],
  [
    'Audit log yang tidak bisa diubah',
    'Setiap perubahan status penting tercatat — siapa, kapan, apa, alasannya. Basis data menolak perubahan atau penghapusan catatan ini.',
  ],
  [
    'Log tanpa data pribadi',
    'Catatan teknis hanya menyimpan kolom yang aman (misalnya ID dan status). Kolom lain disensor otomatis.',
  ],
  [
    'Tanpa pelacak pihak ketiga',
    'Situs ini tidak memakai iklan, piksel pelacak, atau analitik pihak ketiga, dan tidak memasang cookie pelacakan.',
  ],
];

export default function KeamananPrivasi() {
  return (
    <>
      <PageHero
        eyebrow="Keamanan & privasi"
        title="Dirancang dengan prinsip privasi sejak awal."
        lead="Prinsip berikut sudah diterapkan dalam versi MVP ini. Versi ini hanya memakai data sintetis."
      />
      <section className="container-page py-12">
        <ul className="grid gap-4 md:grid-cols-2">
          {principles.map(([t, b]) => (
            <li key={t} className="ticket p-5">
              <h2 className="font-sans text-lg font-bold">{t}</h2>
              <p className="mt-1 text-ink-soft">{b}</p>
            </li>
          ))}
        </ul>
        <div className="mt-8 max-w-3xl">
          <Notice tone="ochre" title="Yang belum kami klaim">
            Kami belum mengklaim kepatuhan atau sertifikasi terhadap regulasi tertentu. Sebelum dipakai dengan
            data pasien sungguhan, rancangan ini perlu ditinjau oleh tim hukum dan petugas pelindungan data
            rumah sakit mitra — termasuk terhadap UU Pelindungan Data Pribadi dan ketentuan rekam medis.
          </Notice>
        </div>
      </section>
    </>
  );
}
