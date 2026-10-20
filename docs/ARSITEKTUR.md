# Arsitektur

Satu paket Next.js 16 (App Router, TypeScript strict) dengan inti yang bebas framework. Keputusan awal dan alasannya ada
di [PLAN.md](../PLAN.md); dokumen ini menjelaskan kondisi kode yang sebenarnya.

## Lapisan

```
src/app/            UI + route handler (tipis). Dua zona: (marketing) dan (app)
src/features/       Tampilan per peran (koordinator, pasien, shared) — dipakai zona app dan demo
src/components/     Komponen bersama: SiteHeader/SiteFooter, JourneyTimeline, ActionForm, Toaster, grafik
src/server/         Use-case, query, adapter, auth, rate limit, idempotensi, audit, notifikasi
src/domain/         State machine TripPlan, penjaga konfirmasi, aturan kapasitas (murni)
src/engine/         Mesin penyusun perjalanan + validator + baseline (murni, deterministik, tanpa I/O)
src/config/         brand.config.ts, links.ts, policy.ts, env.ts
src/content/        Konten profile (FAQ, label, hasil simulasi, contoh sebelum/sesudah)
seed/               Data referensi sintetis, skenario penerimaan, seeder deterministik
sim/                Simulator kejadian diskrit + runner eksperimen; keluaran di sim/out/
tests/              Vitest: unit, property-based, integrasi DB (konkurensi), kebijakan repo
e2e/                Playwright: alur koordinator/pasien, navigasi dua arah, privasi, Lead, link crawl, axe
```

Aturan impor (dijaga ESLint `no-restricted-imports`): `engine` dan `domain` tidak boleh mengimpor Next, React, Drizzle,
`@/server/*`, atau modul `node:*`, dan tidak boleh memanggil `Date.now()` — waktu selalu masuk sebagai input
(`Clock` di-inject pada server, `FakeClock` di test).

## Dua zona, tiga database

| Zona                     | Path                  | Database           | Akses                                             |
| ------------------------ | --------------------- | ------------------ | ------------------------------------------------- |
| Publik (company profile) | `/`, `/cara-kerja`, … | — (statis)         | Semua                                             |
| Kerja                    | `/app/**`, `/masuk`   | `rujuksekali`      | Sesi staf (cookie HttpOnly, RBAC di use-case)     |
| Pasien                   | `/p/[token]` → `/p`   | `rujuksekali`      | Token → cookie HttpOnly (path `/p`), no-referrer  |
| Demo                     | `/demo/**`            | `rujuksekali_demo` | Tanpa login, aktor "Koordinator Demo", rate limit |

`getDb(zone)` mengembalikan pool per zona; halaman/aksi demo hanya pernah membuat konteks `demo`. Sandbox demo dibangun
ulang otomatis bila datanya dari hari lain atau lebih tua dari 6 jam (`src/server/demo.ts`). `/demo/mulai` membuat
salinan baru sebuah skenario untuk setiap pengunjung, lalu mengarahkannya ke tampilan koordinator atau pasien.

Semua URL lintas zona berasal dari `src/config/links.ts`. Bila `PUBLIC_SITE_URL` dan `APP_URL` berbeda origin
(mis. `www` dan `app`), helper mengembalikan URL absolut dan `src/proxy.ts` mengalihkan path ke domain pemiliknya.
Parameter `?from=` hanya menerima path profile yang persis ada di `siteRoutes` (`safeReturnPath`).

## Mesin penyusun perjalanan (`src/engine/plan.ts`)

1. Urutkan layanan secara topologis menurut aturan `PRECEDENCE` (siklus → `INVALID_INPUT`).
2. Saring slot per layanan: jendela klinis, lead time, aturan puasa, kuota penahanan penuh, jendela pendamping —
   setiap saringan menghitung alasan.
3. Backtracking menetapkan **hari** per layanan (hari ≥ hari pendahulunya, rentang ≤ 14 hari, maks. 20.000 node).
4. Untuk tiap penetapan, coba varian celah hari (menginap vs pulang) dan tiap opsi transportasi termurah-dulu; jadwalkan
   slot paling awal yang memenuhi kedatangan + buffer, hasil lab siap + jeda, tidak tumpang-tindih, dan kepulangan.
5. Skor leksikografis: `[hari kunjungan, biaya pasien, keterlambatan, menit slot ditahan, mulai pertama, id slot]`.
6. Top-3 berbeda (hari/strategi), penjelasan Bahasa Indonesia, catatan global (mengapa tidak 1 hari, hari yang dilewati
   karena pendamping/kuota). Tanpa rencana → alasan spesifik + opsi terdekat di luar jendela (dengan catatan perlu
   persetujuan tenaga kesehatan).

`validate.ts` memeriksa constraint keras secara independen; property test (`fast-check`, 400+ input acak) memastikan
tidak ada rencana yang melanggarnya, hasil deterministik, dan urutan input tidak berpengaruh. `baseline.ts` memakai mesin
yang sama untuk strategi pembanding "pesan satu per satu".

## Siklus hold (`src/server/usecases/holds.ts`)

```mermaid
sequenceDiagram
  participant K as Koordinator
  participant S as holdPlan (saga)
  participant DB as Postgres
  participant X as ScheduleAdapter (SIMRS)
  K->>S: Tahan (Idempotency-Key)
  S->>DB: TX1: lock plan, episode; lock capacity_day (urutan tetap); cek rasio
  S->>DB: UPDATE slot SET held WHERE id IN (...) AND status='available'
  alt baris < jumlah slot
    DB-->>S: rollback (tidak ada yang ditahan)
    S-->>K: SLOT_TAKEN + opsi baru
  end
  S->>X: reserve(slots)
  alt gagal / timeout
    S->>X: release(slots)
    S->>DB: TX2: lepas slot, hold=released, audit kompensasi
    S-->>K: EXTERNAL_FAILED (tidak ada slot yatim)
  end
  S->>DB: TX3: hold pending→active (bila belum dikompensasi), plan PROPOSED→HELD, notifikasi
  S->>S: tryConfirm (bila syarat sudah lengkap)
```

Status mengikuti tabel transisi di `src/domain/tripPlan.ts`; semua perubahan status lewat satu fungsi (`movePlan`) yang
memvalidasi transisi, menyimpan, dan menulis audit. Diagram status ada di PLAN.md §5.

- **Konfirmasi** (`tryConfirm`): lock plan, lazy-expire, `confirmationBlockers` (dokumen verified & berlaku sampai hari
  terakhir, pendamping terkonfirmasi tiap hari, transportasi masih ada, disetujui koordinator), commit eksternal; tidak
  pasti → tetap HELD. Dipanggil ulang otomatis saat dokumen diverifikasi atau pendamping konfirmasi.
- **Kedaluwarsa** (`expireDueHolds`): `FOR UPDATE SKIP LOCKED`, aman dipanggil paralel; juga mengompensasi hold `pending`
  yang tertinggal. Dipanggil oleh cron dan sebelum setiap halaman/aksi yang bergantung pada slot.
- **Idempotensi** (`withIdempotency`): baris `(scope, key)` dengan hash permintaan; replay mengembalikan hasil yang sama
  (atau error domain yang sama), payload berbeda → 422, permintaan bersamaan → 409 "sedang diproses".
- **Audit**: tabel `audit_log` append-only, dijaga trigger database yang menolak perubahan dan penghapusan.

## Antarmuka

- Aksi UI memakai server action melalui `ActionForm`: kunci idempotensi per percobaan dibuat di klien, tombol
  nonaktif sampai hidrasi, input tidak hilang saat validasi gagal, hasil ditampilkan lewat `Toaster` (satu live region).
- Komponen bersama dipakai zona kerja dan demo (`features/coordinator/*` menerima `zone`).
- Desain: token warna/tipografi di `src/app/globals.css` (Tailwind v4 `@theme`), motif "garis perjalanan"
  (`JourneyTimeline`, `HeroArt`, logo), kontras WCAG AA diuji axe di E2E, Lighthouse CI di halaman utama.

## Perintah

| Perintah               | Fungsi                                      |
| ---------------------- | ------------------------------------------- |
| `docker compose up -d` | Postgres 16 (app, demo, test, e2e)          |
| `npm run setup`        | `.env` + migrasi + seed sintetis app & demo |
| `npm run dev`          | Server pengembangan                         |
| `npm run check`        | lint + typecheck + Vitest + Playwright      |
| `npm run check:fast`   | tanpa E2E                                   |
| `npm run sim`          | Simulator + eksperimen TTL → `sim/out/`     |
| `npm run lighthouse`   | Lighthouse CI (median 3 run, ambang 0,9)    |
| `npm run brand:check`  | Bukti ganti nama produk                     |
| `npm run demo:reset`   | Bangun ulang sandbox demo                   |
