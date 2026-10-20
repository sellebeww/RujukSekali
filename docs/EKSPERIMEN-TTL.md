# Eksperimen batas waktu penahanan (TTL)

> **Simulasi data sintetis, bukan hasil lapangan.** Angka di dokumen ini menunjukkan perilaku model, bukan bukti
> untuk kesimpulan operasional atau klinis di rumah sakit sungguhan.

Reproduksi: `npm run sim` (± 12 detik). Keluaran: `sim/out/runs.csv` (per seed), `sim/out/ttl-experiment.csv`
(rata-rata per TTL), `sim/out/baseline-comparison.csv`, `sim/out/summary.json` (dipakai halaman _Hasil Simulasi_
dan _Metrik_). Seed sama → angka identik (diuji di `tests/sim.test.ts`).

## Pertanyaan

1. Apakah menyusun **perjalanan** (bukan janji temu satu per satu) mengurangi kedatangan, pembatalan, dan slot terbuang?
2. Berapa lama jadwal sebaiknya **ditahan** sebelum dilepas, mengingat dampaknya pada pasien lain?

## Model

Simulasi kejadian diskrit (`sim/model.ts`), satu RS fiktif, kapasitas sama dengan seed aplikasi:
lab darah 2 bilik × slot 15 menit (07:00–14:00, Sen–Sab), poli penyakit dalam 2 ruang × slot 20 menit (08:00–15:00, Sen–Jum).

| Parameter                               | Nilai                                                                    | Status      |
| --------------------------------------- | ------------------------------------------------------------------------ | ----------- |
| Hari kedatangan                         | 28 (horizon kapasitas +21 hari)                                          | asumsi      |
| Episode luar kota                       | ± 10/hari (×0,6–1,4), 5 kabupaten fiktif dengan jadwal bus/kereta statis | asumsi      |
| Permintaan pasien lokal (beban latar)   | lab ± 38/hari, poli ± 28/hari, untuk 1–7 hari ke depan; beban awal 45%   | asumsi      |
| Dokumen siap saat datang                | 50%; sisanya terlambat rata-rata 30 jam (eksponensial)                   | asumsi      |
| Perlu pendamping                        | 30%; pendamping tersedia 60% hari; balasan rata-rata 8 jam               | asumsi      |
| Tidak hadir                             | 5% per kunjungan                                                         | asumsi      |
| Batal di luar sistem setelah konfirmasi | 4% (sama untuk kedua strategi)                                           | asumsi      |
| Rasio hold maksimum                     | 30% slot per layanan per hari                                            | default MVP |
| TTL diuji                               | 15 mnt, 1 jam, 4 jam, 24 jam, 48 jam                                     | —           |
| Seed                                    | 11, 23, 37, 41, 59                                                       | —           |

**Pembanding (pesan satu per satu):** tiap layanan dipesan sendiri pada slot paling awal yang memungkinkan (mesin yang
sama, satu layanan per pemesanan). Bila konsultasi jatuh sebelum hasil lab siap, kunjungan itu sia-sia dan pasien
memesan ulang. Kekurangan dokumen/pendamping baru ketahuan 12 jam sebelum kunjungan → pembatalan terlambat, pesan ulang.

**Terkoordinasi:** mesin penyusun aplikasi (`planTrips`), penahanan semua slot sekaligus, TTL dibatasi agar tidak
melewati kunjungan pertama, konfirmasi hanya saat dokumen & pendamping siap; bila TTL habis, slot dilepas dan episode
disusun ulang saat syarat siap.

## Hasil (rata-rata 5 seed)

| Strategi      | TTL                  | Hari kunjungan / episode | Pembatalan | Slot terbuang (terlambat / hold habis / tidak hadir) | Hold-to-confirm | Rata-rata hold (jam) | Slot-jam tertahan | Displacement | Biaya pasien  | Pasien lokal ditolak |
| ------------- | -------------------- | ------------------------ | ---------- | ---------------------------------------------------- | --------------- | -------------------- | ----------------- | ------------ | ------------- | -------------------- |
| Satu per satu | —                    | **1,36**                 | 7,2%       | 45,0 (11,2 / 0 / 33,8)                               | —               | —                    | 0                 | 0            | Rp583.510     | 385                  |
| Terkoordinasi | 15 mnt               | 1,00                     | 3,4%       | 26,0 (0 / 0,2 / 25,8)                                | 62%             | 0,1                  | 87                | 0,0 ± 0,0    | Rp430.296     | 249                  |
| Terkoordinasi | 1 jam                | 1,00                     | 3,6%       | 27,2 (0 / 0,8 / 26,4)                                | 63%             | 0,4                  | 341               | 0,0 ± 0,0    | Rp431.073     | 250                  |
| Terkoordinasi | 4 jam                | 1,00                     | 3,4%       | 26,0 (0 / 0,8 / 25,2)                                | 66%             | 1,5                  | 1.273             | 0,2 ± 0,4    | Rp433.842     | 249                  |
| Terkoordinasi | **24 jam** (default) | **1,00**                 | **3,1%**   | **28,6** (0 / 0,8 / 27,8)                            | 81%             | 7,5                  | 5.251             | 3,4 ± 2,3    | **Rp430.707** | 248                  |
| Terkoordinasi | 48 jam               | 1,00                     | 3,6%       | 29,6 (0,4 / 3,2 / 26,0)                              | 91%             | 11,6                 | 7.329             | 17,0 ± 8,6   | Rp429.460     | 249                  |

## Temuan

1. **Kedatangan:** pada skenario ini rencana terkoordinasi hampir selalu muat dalam 1 hari (1,00 vs 1,36 hari per
   episode, −26%). Pembanding kehilangan hari terutama karena konsultasi yang jatuh sebelum hasil lab siap.
2. **Pembatalan & slot terbuang:** karena jadwal baru _pasti_ setelah syarat lengkap, pembatalan terlambat akibat dokumen
   hilang dari model (7,2% → ~3%, sisanya adalah pembatalan di luar sistem yang sengaja disamakan). Slot terbuang turun
   ±36% — sebagian karena pembanding punya lebih banyak kunjungan, sehingga lebih banyak peluang tidak hadir.
3. **Efek samping positif:** pasien lokal yang ditolak turun (385 → ±249) karena pembanding memakai slot untuk
   kunjungan yang sia-sia.
4. **Trade-off TTL:** TTL lebih panjang menaikkan hold-to-confirm (62% → 91%), tetapi slot-jam tertahan naik ±84×
   (87 → 7.329) dan displacement mulai muncul pada 24 jam (3,4) lalu melonjak pada 48 jam (17,0). Pada model ini
   **4–24 jam** adalah kisaran yang masuk akal; 48 jam mulai merugikan pasien lain. Pilihan akhir harus diuji di lapangan.
5. Hold yang kedaluwarsa jarang membuang slot (≤ 3,2) karena TTL dibatasi sebelum kunjungan dan slot sempat terisi ulang.

## Batasan (jujur)

- **Data sintetis.** Tidak ada pasien, jadwal, atau RS sungguhan. Semua parameter perilaku adalah asumsi.
- **Kapasitas cukup longgar.** Hampir semua episode muat 1 hari; pada RS yang lebih padat, hasil terkoordinasi bisa
  2 hari dan selisihnya bisa lebih kecil atau lebih besar.
- **Pembanding disederhanakan.** Pasien pembanding memilih slot paling awal; pasien nyata dan petugas loket sering
  sudah menyelaraskan sebagian jadwal secara manual. Selisih nyata kemungkinan **lebih kecil**.
- **Tidak dimodelkan:** keterlambatan layanan, antrean loket, perilaku koordinator (persetujuan diasumsikan langsung),
  musim/libur, perubahan prioritas klinis, dan kegagalan sistem eksternal.
- **Variasi antar-seed** ditampilkan (±) untuk displacement; 5 seed belum cukup untuk interval kepercayaan yang ketat.
- Hasil ini **tidak boleh** dipakai untuk kesimpulan operasional/klinis. Lihat rencana validasi di
  [RISIKO-DAN-VALIDASI.md](RISIKO-DAN-VALIDASI.md).
