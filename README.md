<div align="center">

<img src="public/icon.svg" alt="Logo RujukSekali" width="96" />

# RujukSekali

**Satu perjalanan, semua layanan beres.**

Koordinasi kunjungan rumah sakit untuk pasien dari luar kota: beberapa layanan, satu rencana, satu kali datang.

![Next.js](https://img.shields.io/badge/Next.js-App_Router-000?logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=white)
![Tests](https://img.shields.io/badge/tests-Vitest_%2B_Playwright-2fb77a)
![Data](https://img.shields.io/badge/data-sintetis-0a9bb0)

</div>

---

## Masalahnya

Pasien rujukan dari kabupaten sering harus datang berkali-kali: sekali untuk ambil darah, lain hari untuk konsultasi
karena hasil lab belum siap atau jadwal poli penuh. Tiap kunjungan berarti ongkos transportasi, penginapan, dan
kehilangan penghasilan.

## Solusinya

RujukSekali menyusun layanan-layanan itu menjadi **satu rangkaian kunjungan yang benar-benar bisa dijalani**,
memperhatikan urutan layanan, waktu hasil lab, puasa, dokumen, pendamping, dan jadwal bus/kereta. Jadwal
**ditahan sementara**, lalu **dikonfirmasi hanya ketika semua syarat penting siap**. Seperti kursi bioskop yang
disisihkan untuk Anda sampai Anda bayar, tetapi untuk seluruh rangkaian jadwal sekaligus.

## Fitur utama

| | Fitur | Isi |
| --- | --- | --- |
| 🧭 | **Penyusun rencana perjalanan** | Mesin murni dan deterministik; menghasilkan hingga 3 opsi beserta alasannya (jumlah kedatangan, hasil lab siap sebelum konsultasi, transportasi, biaya). |
| 🔒 | **Tahan jadwal (hold saga)** | Semua slot ditahan bersama atau tidak sama sekali; kegagalan parsial dibatalkan bersih. Tahan, perpanjang, lepas, atau kedaluwarsa otomatis dengan TTL berjenjang. |
| ✅ | **Konfirmasi bersyarat** | Jadwal otomatis pasti begitu dokumen terakhir diverifikasi dan rencana disetujui. |
| 🏥 | **Zona koordinator** | Menyusun rencana, menahan jadwal, memverifikasi dokumen, mengelola prioritas klinis. |
| 📱 | **Zona pasien tanpa akun** | Tautan bertoken (hash SHA-256, berlaku 72 jam, bisa dicabut) yang ditukar jadi cookie HttpOnly; jadwal, persiapan puasa, dokumen, dan perkiraan biaya. |
| 🛠️ | **Zona admin unit** | Atur kapasitas, tier TTL, rasio hold maksimum, dan aturan layanan. |
| 🧪 | **Mode demo** | `/demo` tanpa akun pada database terpisah yang di-reset berkala; 5 skenario siap coba. |
| 📊 | **Simulator & metrik** | Simulator discrete-event memakai engine yang sama; bandingkan pesan satu per satu vs terkoordinasi dan trade-off TTL. |
| 🛡️ | **Pagar pengaman** | Rasio hold maksimum, idempotensi, rate limit, audit append-only, kedaluwarsa dengan clock yang bisa di-inject. |
| 🌐 | **Company profile** | Halaman pemasaran, cara kerja, hasil simulasi, dan formulir minta demo. Nama produk bisa diganti dari satu berkas konfigurasi. |

> MVP ini hanya memakai **data sintetis**. Sistem mengoordinasikan logistik dan **tidak menggantikan penilaian klinis**.
> Integrasi BPJS/SATUSEHAT/SIMRS belum ada (adapter tiruan).

## Arsitektur singkat

```
app (UI/route handlers) ──► server (use-cases, repo, adapters) ──► domain (state machine) ──► engine (murni)
sim/ (simulator) ──► engine + domain   (tanpa DB, tanpa Next)
```

Next.js App Router, TypeScript strict, PostgreSQL + Drizzle, zod di batas sistem. Engine tanpa I/O dan tanpa
`Date.now()`, dijaga aturan ESLint. Detail: [docs/ARSITEKTUR.md](docs/ARSITEKTUR.md).

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
