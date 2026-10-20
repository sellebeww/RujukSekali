# Risiko dan rencana validasi

## Risiko utama dan bagaimana desain menanganinya

### 1. Slot tertahan terlalu lama

- **Desain:** TTL bertingkat per layanan (`service_type.hold_ttl_minutes`), TTL rencana = TTL terpendek, TTL tidak pernah
  melewati kunjungan pertama dikurangi lead time; perpanjangan hanya koordinator, beralasan, maks. 2 kali; rasio hold
  maksimum per layanan per hari dikunci di DB (`capacity_day … FOR UPDATE`). Kedaluwarsa via cron (`POST /api/cron/expire`)
  **dan** lazy saat baca/konfirmasi.
- **Pengukuran:** slot-jam tertahan, displacement, hold-to-confirm (halaman Metrik, CSV).
- **Bukti:** skenario 8 & 10 (`tests/integration/holds.test.ts`), eksperimen TTL (`docs/EKSPERIMEN-TTL.md`).

### 2. Prioritas klinis berubah

- **Desain:** `markPriorityChanged` dalam **satu transaksi** melepas semua hold/booking episode, rencana aktif →
  `REPLAN_REQUIRED`, audit, notifikasi koordinator; lalu menyusun ulang. Flag mendesak → engine `manual`, tidak ada hold.
- **Bukti:** skenario 5 + invariant "tidak ada slot yatim" setelah setiap test integrasi (`tests/support/db.ts`).

### 3. Koordinasi antarfasilitas / sistem lain lambat atau gagal

- **Desain:** port `ScheduleAdapter` dengan kontrak: setiap panggilan berbatas waktu; hasil selain "ok" pasti = gagal.
  Saga: (1) klaim lokal atomik semua-atau-tidak, (2) reserve eksternal, kegagalan/timeout → release kompensasi +
  lepas lokal, (3) aktivasi hanya bila hold masih `pending`. Hold `pending` > 5 menit (crash di tengah saga)
  dikompensasi otomatis oleh penyapu kedaluwarsa. Commit eksternal yang tidak pasti → **tidak** dikonfirmasi (tetap HELD).
- **Bukti:** skenario 7 (gagal di slot kedua, timeout, konflik lokal) dan "konfirmasi eksternal tidak pasti → tetap HELD".

### 4. Ketergantungan berubah di tengah jalan

- **Desain:** dokumen bisa ditandai tidak berlaku → rencana terkonfirmasi disusun ulang (`markDocumentExpired`);
  pendamping batal di hari kunjungan → `dependencyChanged` → replan; konfirmasi memeriksa ulang dokumen (termasuk
  masa berlaku sampai hari kunjungan terakhir), pendamping per hari, dan opsi transportasi.
- **Bukti:** penjaga konfirmasi (`tests/domain.test.ts`), skenario 2.

### 5. Rencana optimal secara matematis tetapi tidak realistis bagi pasien

- **Desain:** hingga 3 opsi berbeda (hari/strategi menginap), penjelasan bahasa Indonesia per opsi (mengapa dipilih,
  perbandingan menginap vs pulang-pergi, mengapa hari terbaik dilewati), **persetujuan koordinator wajib**, pasien bisa
  "minta ubah jadwal", kebutuhan mobilitas & pendamping ditampilkan. Biaya yang dioptimasi bisa dimatikan sebagian
  (kehilangan penghasilan) per episode.
- **Bukti:** skenario 1, 3, 4 (engine) dan E2E alur koordinator/pasien.

### Risiko teknis tambahan

| Risiko                                  | Mitigasi                                                                                               |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Double-booking pada perebutan slot      | Update bersyarat per baris di Postgres; uji 20 permintaan paralel (skenario 6)                         |
| Deadlock antar-hold                     | Kunci `capacity_day` dalam urutan tetap                                                                |
| Permintaan ganda (klik dua kali, retry) | Idempotency key per aksi (skenario 9), termasuk permintaan paralel dengan kunci sama                   |
| Demo menyentuh data nyata               | DB terpisah per zona, konteks bertipe, uji isolasi (skenario 12)                                       |
| Kebocoran token pasien                  | Tukar token → cookie HttpOnly, `Referrer-Policy: no-referrer`, `rel=noreferrer`, rate limit; diuji E2E |
| Klaim berlebihan di situs               | Uji kebijakan konten; angka hanya dari `sim/out`                                                       |

## Rencana validasi lapangan (pilot 1 RS, 2 layanan)

Tujuannya agar hasil simulasi **tidak** disalahartikan sebagai bukti. Pilot dirancang sebagai perbandingan
sebelum/sesudah dengan definisi metrik yang sama (`docs/METRIK.md`).

### Desain pilot

1. **Baseline 4–6 minggu** sebelum sistem dipakai: catat manual (atau ekspor SIMRS) kedatangan pasien luar kota untuk lab
   darah + poli penyakit dalam: tanggal tiap kunjungan, pembatalan, slot kosong.
2. **Pilot 8–12 minggu** dengan koordinator manual menyetujui setiap rencana; mulai dengan TTL 24 jam dan rasio 30%,
   tinjau mingguan.
3. Bila memungkinkan, alokasikan sebagian pasien ke alur lama (kelompok pembanding) untuk mengurangi bias musim.

### Metrik yang dikumpulkan

- Hari kunjungan per episode; jumlah pulang-pergi; malam menginap.
- Pembatalan setelah konfirmasi (dan berapa yang terlambat); tidak hadir.
- Slot terbuang menurut sebab; slot-jam tertahan; displacement (perlu data penolakan dari loket/SIMRS).
- Hold-to-confirm, durasi hold, jumlah perpanjangan dan alasannya.
- Waktu kerja koordinator per episode; jumlah opsi yang ditolak koordinator dan alasannya.
- Biaya pasien yang dilaporkan sendiri (survei singkat) vs perkiraan sistem.
- Insiden keselamatan: kasus yang seharusnya mendesak tetapi sempat masuk alur otomatis (target: nol).

### Pertanyaan wawancara — koordinator

1. Bagaimana Anda saat ini menyusun jadwal untuk pasien luar kota? Apa yang paling sering membuat mereka harus kembali?
2. Informasi apa yang Anda perlukan sebelum berani mengonfirmasi jadwal? Apa yang sering belum ada?
3. Kapan Anda menahan slot untuk pasien tertentu hari ini (secara informal)? Berapa lama? Siapa yang dirugikan?
4. Opsi rencana mana yang Anda tolak dan mengapa? Apa yang tidak dipahami sistem?
5. Berapa lama penahanan yang adil menurut Anda untuk layanan ini? Apa yang terjadi bila dokumen terlambat?
6. Apakah penjelasan rencana membantu Anda menjelaskan ke pasien? Kalimat mana yang membingungkan?

### Pertanyaan wawancara — pasien & pendamping

1. Berapa kali Anda datang untuk satu rangkaian pemeriksaan terakhir? Berapa biaya dan hari kerja yang hilang?
2. Bagaimana Anda tahu harus puasa, membawa apa, dan datang jam berapa? Apa yang pernah salah?
3. Apakah tautan yang dikirim petugas mudah dibuka di ponsel Anda? Ada kata yang tidak dimengerti?
4. Apakah "jadwal ditahan sementara" dan "jadwal sudah pasti" dipahami bedanya?
5. Apakah perkiraan biaya mendekati kenyataan? Apa yang terlewat (makan, ojek, menginap)?
6. Apakah Anda merasa data Anda aman? Informasi apa yang tidak ingin Anda terima lewat pesan?

### Kriteria keberhasilan pilot (usulan, perlu disepakati dengan RS)

- Hari kunjungan per episode turun secara bermakna dibanding baseline tanpa kenaikan displacement yang dirasakan loket.
- Pembatalan terlambat karena dokumen/pendamping turun.
- Tidak ada insiden keselamatan terkait alur otomatis.
- Koordinator menilai beban kerja tidak bertambah (atau berkurang) setelah 4 minggu.
