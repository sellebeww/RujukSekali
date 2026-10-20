# Company profile — inventaris konten

Situs company profile (zona publik) ada di `src/app/(marketing)/`. Semua teks merek berasal dari
`src/config/brand.config.ts`; semua tautan lintas zona dari `src/config/links.ts`.

## Aturan konten yang diterapkan

- Tidak ada testimoni, logo klien, statistik karangan, penghargaan, sertifikasi, atau kemitraan.
- Angka hanya berasal dari simulator (`sim/out/summary.json`, dibuat oleh `npm run sim`) dan selalu
  diberi label **"Simulasi data sintetis, bukan hasil lapangan"**.
- Tidak ada klaim kepatuhan (UU PDP, Kemenkes, BPJS) atau integrasi (BPJS, SATUSEHAT, SIMRS). Tertulis:
  "dirancang dengan prinsip privasi sejak awal" dan "rencana integrasi".
- Tidak ada saran medis; setiap halaman relevan menegaskan bahwa sistem hanya mengoordinasikan logistik dan
  kondisi darurat → IGD/119.
- Ilustrasi dibuat sendiri (SVG). Tidak ada foto stok orang atau logo palsu.
- `tests/repo-policy.test.ts` memeriksa otomatis: nama produk tidak di-hard-code, href internal lewat `links.ts`,
  semua placeholder tercatat di dokumen ini, dan tidak ada frasa klaim terlarang.

## Placeholder yang harus dilengkapi

Setiap placeholder tampil di halaman sebagai label kuning `[ISI: …]` agar tidak dikira data nyata.

| Placeholder                                                          | Lokasi                                                      | Catatan                                    |
| -------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------ |
| `[ISI: nama badan hukum]`                                            | `brand.config.ts` → footer, kebijakan privasi               | Nama entitas pengelola                     |
| `[ISI: email kontak]`                                                | `brand.config.ts` → `/minta-demo#kontak`, kebijakan privasi |                                            |
| `[ISI: nomor WhatsApp]`                                              | `brand.config.ts` → `/minta-demo#kontak`                    |                                            |
| `[ISI: alamat kantor]`                                               | `brand.config.ts` → `/minta-demo#kontak`                    |                                            |
| `[ISI: nama dan peran anggota tim]`                                  | `/tentang`                                                  | Jangan isi dengan nama fiktif              |
| `[ISI: penasihat klinis/operasional bila ada]`                       | `/tentang`                                                  |                                            |
| `[ISI: ringkasan model harga bila sudah ada]`                        | `/untuk-rumah-sakit`                                        | Model kerja sama: kontrak jaringan layanan |
| `[ISI: peran pengendali/prosesor data setelah ditinjau hukum]`       | `/kebijakan-privasi`                                        | Perlu tinjauan hukum/DPO                   |
| `[ISI: masa simpan data permintaan demo dan log teknis]`             | `/kebijakan-privasi`                                        |                                            |
| `[ISI: yurisdiksi dan penyelesaian sengketa setelah ditinjau hukum]` | `/syarat`                                                   |                                            |

Konten lain yang belum final (bukan placeholder teks, tetapi perlu keputusan):

| Item                       | Status sekarang                                                                        | Cara mengganti                                                              |
| -------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Nama produk & tagline      | "RujukSekali" — "Satu perjalanan, semua layanan beres." (sementara)                    | Ubah `brand.config.ts` (atau `BRAND_NAME_OVERRIDE`)                         |
| Logo                       | Tanda plus bergradien biru→hijau dengan dua rute (SVG transparan) + wordmark dua warna | `public/icon.svg` (dipakai juga sebagai favicon), `src/components/Logo.tsx` |
| Domain                     | Lokal `http://localhost:3000`                                                          | `PUBLIC_SITE_URL`, `APP_URL`, `COOKIE_DOMAIN`                               |
| Gambar Open Graph          | Dibuat otomatis dari logo, nama, dan tagline                                           | `src/app/opengraph-image.tsx`                                               |
| Kebijakan privasi & syarat | Draf berlabel "perlu ditinjau hukum"                                                   | Tinjauan hukum                                                              |

## Struktur halaman

| Path                                    | Isi                                                                                                   | Tautan ke aplikasi                                                                          |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `/`                                     | Hero, masalah, 4 langkah, pembeda, ringkasan simulasi, untuk siapa, CTA                               | Coba Demo, Lihat Contoh Perjalanan Pasien, Coba sebagai Koordinator, deep link tiap langkah |
| `/cara-kerja`                           | Visual interaktif sebelum/sesudah (dihitung engine), 4 langkah, istilah "ditahan sementara" & "pasti" | Deep link per langkah ke demo (`/demo/mulai?skenario=…&tahap=…&from=/cara-kerja`)           |
| `/untuk-rumah-sakit`                    | Manfaat, metrik, model kerja sama, pilot, kebutuhan RS, manusia-dalam-lingkaran                       | Dashboard demo                                                                              |
| `/untuk-pasien`                         | Alur, persiapan, FAQ, perlindungan data (teks besar)                                                  | Contoh halaman pasien demo                                                                  |
| `/keamanan-privasi`                     | Prinsip privasi tanpa klaim kepatuhan                                                                 | —                                                                                           |
| `/tentang`                              | Visi, masalah, prinsip, tim (placeholder)                                                             | —                                                                                           |
| `/hasil-simulasi`                       | Metode, hasil, eksperimen TTL, batasan                                                                | —                                                                                           |
| `/minta-demo`                           | Formulir Lead + kontak                                                                                | Demo                                                                                        |
| `/faq`, `/kebijakan-privasi`, `/syarat` | FAQ, draf legal                                                                                       | —                                                                                           |
| 404                                     | Halaman bantuan dengan tujuan umum                                                                    | Demo                                                                                        |

## Analitik

Tidak ada analitik di MVP (keputusan di PLAN.md): tanpa cookie, tanpa pelacak pihak ketiga. Bila nanti perlu,
gunakan analitik self-hosted tanpa cookie dan perbarui halaman privasi.
