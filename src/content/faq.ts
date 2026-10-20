import { brand } from '@/config/brand.config';

export interface Faq {
  id: string;
  q: string;
  a: string;
}

export const patientFaq: Faq[] = [
  {
    id: 'biaya',
    q: 'Apakah saya harus membayar untuk layanan ini?',
    a: `${brand.name} dipakai oleh rumah sakit untuk mengatur jadwal. Perkiraan biaya yang Anda lihat adalah biaya perjalanan Anda sendiri (transportasi, penginapan, hari kerja yang hilang) agar Anda bisa bersiap. Itu perkiraan, bukan tagihan.`,
  },
  {
    id: 'ditahan',
    q: 'Apa artinya "jadwal ditahan sementara"?',
    a: 'Rumah sakit menyisihkan jadwal untuk Anda selama waktu tertentu, misalnya 24 jam. Selama itu, Anda melengkapi syarat (seperti surat rujukan). Kalau semua sudah siap, jadwal menjadi pasti. Kalau waktunya habis, jadwal dilepas supaya bisa dipakai pasien lain, dan petugas akan menyusun jadwal baru bersama Anda.',
  },
  {
    id: 'pendamping',
    q: 'Bagaimana jika saya perlu didampingi?',
    a: 'Petugas akan mencatat hari-hari pendamping Anda bisa ikut. Jadwal hanya disusun pada hari tersebut. Pendamping cukup menekan tombol konfirmasi di halaman tautan Anda.',
  },
  {
    id: 'ubah',
    q: 'Bagaimana kalau jadwalnya tidak cocok?',
    a: 'Tekan "Minta ubah jadwal" di halaman tautan Anda. Petugas akan menghubungi Anda. Tidak perlu datang ke rumah sakit hanya untuk mengubah jadwal.',
  },
  {
    id: 'darurat',
    q: 'Bagaimana jika kondisi saya memburuk sebelum jadwal?',
    a: 'Jangan menunggu jadwal. Segera ke IGD terdekat atau hubungi layanan gawat darurat 119. Sistem ini hanya mengatur jadwal, bukan menilai kondisi kesehatan.',
  },
  {
    id: 'aplikasi',
    q: 'Apakah saya perlu memasang aplikasi atau membuat akun?',
    a: 'Tidak. Anda menerima tautan dari petugas yang bisa dibuka di peramban ponsel. Tautan berlaku beberapa hari dan bisa dicabut petugas kapan saja.',
  },
];

export const generalFaq: Faq[] = [
  {
    id: 'apa',
    q: `Apa itu ${brand.name}?`,
    a: `Sistem koordinasi yang menyusun beberapa layanan rumah sakit (misalnya pemeriksaan lab lalu konsultasi) menjadi satu rangkaian kunjungan yang bisa dijalani pasien dari luar kota — dengan memperhatikan urutan layanan, dokumen, pendamping, dan jadwal transportasi.`,
  },
  {
    id: 'klinis',
    q: 'Apakah sistem menentukan prioritas atau keputusan medis?',
    a: 'Tidak. Prioritas klinis hanya diisi dan diubah oleh tenaga kesehatan atau koordinator. Kasus mendesak dikeluarkan dari alur otomatis dan ditangani langsung oleh petugas.',
  },
  {
    id: 'integrasi',
    q: 'Apakah sudah tersambung ke BPJS, SATUSEHAT, atau SIMRS?',
    a: 'Belum. Versi ini memakai adapter tiruan (mock) dan data sintetis. Integrasi adalah rencana untuk tahap berikutnya dan akan dilakukan bersama mitra rumah sakit.',
  },
  {
    id: 'hold',
    q: 'Bukankah menahan jadwal merugikan pasien lain?',
    a: 'Bisa, jika tidak dibatasi. Karena itu penahanan punya batas waktu, jumlah perpanjangan dibatasi, dan ada batas maksimum porsi slot yang boleh ditahan per layanan per hari. Dampaknya kami ukur (lihat Hasil Simulasi).',
  },
  {
    id: 'angka',
    q: 'Dari mana angka hasil yang ditampilkan?',
    a: 'Dari simulasi dengan data sintetis yang bisa diulang (seed tetap). Angka itu menunjukkan cara kerja sistem, bukan bukti hasil di rumah sakit sungguhan. Pilot lapangan diperlukan untuk itu.',
  },
  {
    id: 'pilot',
    q: 'Seperti apa pilot pertamanya?',
    a: 'Satu rumah sakit, dua layanan non-darurat (misalnya laboratorium darah dan poli penyakit dalam), dengan koordinator yang menyetujui setiap rencana. Kami mengukur jumlah kunjungan per episode, pembatalan, dan slot terbuang.',
  },
];
