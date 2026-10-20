# RujukSekali (nama sementara)

**Satu perjalanan, semua layanan beres.** Sistem koordinasi yang menyusun beberapa layanan rumah sakit (contoh MVP:
pemeriksaan darah + konsultasi poli penyakit dalam) menjadi **satu rangkaian kunjungan yang benar-benar bisa dijalani
pasien dari luar kota** — memperhatikan urutan layanan, waktu hasil lab, puasa, dokumen, pendamping, dan jadwal
bus/kereta — lalu **menahan jadwal sementara** dan **mengonfirmasinya hanya ketika semua syarat penting siap**.

> MVP ini hanya memakai **data sintetis**. Sistem mengoordinasikan logistik dan **tidak menggantikan penilaian klinis**.
> Integrasi BPJS/SATUSEHAT/SIMRS belum ada (adapter tiruan).

## Menjalankan (± 5 menit)

Prasyarat: Node.js ≥ 22.12, Docker Desktop.

```bash
npm install
npx playwright install chromium   # hanya untuk E2E / Lighthouse
docker compose up -d              # Postgres lokal (port 5433)
npm run setup                     # .env + migrasi + data sintetis (app & demo); mencetak kata sandi staf
npm run dev                       # http://localhost:3000
```

- `http://localhost:3000` — company profile
- `http://localhost:3000/demo` — mode demo tanpa akun
- `http://localhost:3000/masuk` — zona kerja. Akun staf sintetis: `koordinator@rs-contoh.test`, `admin.unit@rs-contoh.test`,
  `admin@rs-contoh.test`; kata sandi dicetak oleh `npm run setup` (tersimpan di `.env` sebagai `SEED_STAFF_PASSWORD`).

## Demo 5 menit

1. **Profile → demo.** Buka `/`, tekan **Coba sebagai Koordinator**. Banner "Mode demo — data sintetis" muncul;
   **Kembali ke situs** membawa Anda ke halaman asal.
2. **Skenario 1 (jalur ideal).** Di `/demo`, pilih _Jalur ideal → Coba sebagai koordinator_. Lihat hingga 3 opsi beserta
   alasannya (1 kali datang, hasil lab siap sebelum konsultasi, transportasi, biaya). Tekan **Tahan jadwal ini** →
   _Jadwal ditahan sementara_ dengan hitung mundur dan dampak ke kapasitas. Tekan **Setujui rencana** → _Terkonfirmasi_.
3. **Sisi pasien.** Tekan **Buat tautan pasien** dan buka tautannya (atau _Lihat sebagai pasien_ di `/demo`). Pasien
   melihat jadwal, persiapan puasa, dokumen, dan perkiraan biaya — tanpa aplikasi atau akun.
4. **Skenario 2 (dokumen belum siap).** _Lihat sebagai pasien_ → kirim foto dokumen → buka sisi koordinator →
   **Verifikasi** lalu **Setujui** → jadwal otomatis pasti saat syarat terakhir terpenuhi.
5. **Skenario 4 & 5.** Skenario 4: 2 hari berurutan dengan menginap vs 2 perjalanan terpisah, dengan perbandingan
   biaya. Skenario 5: ubah prioritas klinis → semua jadwal dilepas dan rencana disusun ulang.
6. **Metrik & simulasi.** `/demo/metrik` dan `/hasil-simulasi`: pesan satu per satu vs terkoordinasi, dan trade-off TTL.
7. **Kotak masuk & audit.** `/demo/inbox` (notifikasi simulasi tanpa detail klinis) dan `/demo/audit`.

## Pemeriksaan

```bash
npm run check        # lint + typecheck + Vitest (unit, property, integrasi DB) + Playwright (E2E)
npm run check:fast   # tanpa E2E
npm run sim          # simulator & eksperimen TTL → sim/out/
npm run lighthouse   # Lighthouse CI halaman utama (mobile, median 3 run, ambang 0,9)
npm run brand:check  # build dengan nama lain, pastikan tidak ada sisa nama lama
```

Ganti nama produk: ubah `name` di [`src/config/brand.config.ts`](src/config/brand.config.ts) (atau set
`BRAND_NAME_OVERRIDE`). Semua tautan lintas zona ada di [`src/config/links.ts`](src/config/links.ts); untuk dua domain
set `PUBLIC_SITE_URL`, `APP_URL`, dan `COOKIE_DOMAIN`.

Kedaluwarsa terjadwal: panggil `POST /api/cron/expire` dengan header `Authorization: Bearer $CRON_SECRET` (mis. tiap
menit). Tanpa cron pun, penahanan yang habis tetap dilepas saat halaman/aksi terkait dibuka (lazy expiry).

## Dokumentasi

| Dokumen                                                    | Isi                                                              |
| ---------------------------------------------------------- | ---------------------------------------------------------------- |
| [PLAN.md](PLAN.md)                                         | Rencana, keputusan teknologi, skema, state machine, penyimpangan |
| [docs/ARSITEKTUR.md](docs/ARSITEKTUR.md)                   | Lapisan, zona, mesin penyusun, saga hold                         |
| [docs/METRIK.md](docs/METRIK.md)                           | Definisi persis setiap metrik                                    |
| [docs/EKSPERIMEN-TTL.md](docs/EKSPERIMEN-TTL.md)           | Metode, hasil, dan batasan simulasi                              |
| [docs/COMPLIANCE-NOTES.md](docs/COMPLIANCE-NOTES.md)       | Asumsi regulasi yang perlu diverifikasi                          |
| [docs/RISIKO-DAN-VALIDASI.md](docs/RISIKO-DAN-VALIDASI.md) | Risiko, mitigasi, rencana pilot & wawancara                      |
| [docs/COMPANY-PROFILE.md](docs/COMPANY-PROFILE.md)         | Inventaris konten & placeholder `[ISI: …]`                       |

## Skenario penerimaan → bukti otomatis

| #   | Skenario                                     | Test                                                                                           |
| --- | -------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 1   | Jalur ideal 1 hari                           | `tests/engine/scenarios.test.ts`, `tests/integration/holds.test.ts`, `e2e/coordinator.spec.ts` |
| 2   | Dokumen belum siap / TTL habis               | `tests/integration/holds.test.ts`, `e2e/patient.spec.ts`                                       |
| 3   | Pendamping tidak tersedia                    | `tests/engine/scenarios.test.ts`                                                               |
| 4   | Poli penuh → 2 hari menginap vs 2 perjalanan | `tests/engine/scenarios.test.ts`                                                               |
| 5   | Prioritas klinis berubah                     | `tests/integration/holds.test.ts`                                                              |
| 6   | Konkurensi slot terakhir (20 paralel)        | `tests/integration/holds.test.ts`                                                              |
| 7   | Kegagalan parsial / timeout                  | `tests/integration/holds.test.ts`                                                              |
| 8   | Pagar pengaman rasio hold                    | `tests/integration/holds.test.ts`, `tests/engine/scenarios.test.ts`                            |
| 9   | Idempotensi                                  | `tests/integration/holds.test.ts`                                                              |
| 10  | Kedaluwarsa dengan clock di-inject           | `tests/integration/holds.test.ts`                                                              |
| 11  | Navigasi dua arah                            | `e2e/navigation.spec.ts`                                                                       |
| 12  | Demo & privasi lintas zona                   | `e2e/privacy.spec.ts`, `tests/integration/demo-isolation.test.ts`, `tests/links.test.ts`       |
| 13  | Formulir minta demo                          | `tests/integration/leads.test.ts`, `e2e/lead.spec.ts`, `tests/lead-validation.test.ts`         |
