# Catatan kepatuhan — asumsi dan hal yang perlu ditinjau

> Dokumen ini **bukan** klaim kepatuhan. Isinya daftar asumsi desain dan pertanyaan yang harus dijawab oleh tim hukum,
> DPO (petugas pelindungan data), dan manajemen rumah sakit mitra **sebelum** sistem menyentuh data pasien sungguhan.
> MVP ini hanya memakai data sintetis. Setiap aturan yang berpengaruh pada perilaku sistem dibuat **konfigurabel**,
> bukan di-hard-code.

## 1. Pelindungan data pribadi — UU No. 27 Tahun 2022 (UU PDP)

| Topik                          | Yang sudah dilakukan desain                                                                                                                                      | Perlu diverifikasi                                                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Kategori data                  | Data kesehatan termasuk data pribadi yang bersifat spesifik. Sistem hanya menyimpan **jenis layanan** (mis. "Lab darah"), tidak ada diagnosis/hasil.             | Apakah "jenis layanan + jadwal" tetap dianggap data kesehatan spesifik → konsekuensi dasar pemrosesan & DPIA.               |
| Minimisasi                     | Nama samaran/inisial, kabupaten, jarak, kebutuhan mobilitas. NIK opsional, hanya HMAC-SHA256 ber-_pepper_ (`src/server/crypto.ts`).                              | Apakah identifikasi pasien perlu tetap tersambung ke nomor rekam medis/SIMRS (kemungkinan ya, lewat integrasi).             |
| Dasar pemrosesan & persetujuan | Untuk Lead (formulir publik): persetujuan eksplisit, versi teks persetujuan dicatat (`marketing.lead.consent_text_version`).                                     | Dasar pemrosesan data pasien (kemungkinan kewajiban/kepentingan pelayanan kesehatan oleh RS); siapa pengendali vs prosesor. |
| Hak subjek data                | Belum ada alur permintaan akses/hapus otomatis. Lead terpisah dari data pasien sehingga mudah dihapus.                                                           | Prosedur & SLA hak akses, koreksi, penghapusan; masa simpan.                                                                |
| Keamanan                       | RBAC di server, sesi HttpOnly, token pasien di-hash + kedaluwarsa + bisa dicabut, audit append-only (trigger DB), log dengan redaksi allowlist, rate limit, CSP. | Penilaian keamanan independen, enkripsi at-rest di hosting, manajemen kunci (`NATIONAL_ID_PEPPER`), backup.                 |
| Notifikasi                     | Isi hanya waktu, tempat netral (gedung/lantai/ruang), instruksi umum; diuji `tests/notifications.test.ts`.                                                       | Apakah lokasi ruang tertentu masih bisa menyiratkan spesialisasi; kebijakan kanal (WA/SMS) dan pihak ketiga pengirim.       |
| Kebocoran                      | —                                                                                                                                                                | Prosedur pemberitahuan insiden (batas waktu UU PDP), penanggung jawab.                                                      |

## 2. Rekam medis — Permenkes No. 24 Tahun 2022

- **Asumsi:** sistem ini **bukan** rekam medis elektronik; ia hanya menyimpan data logistik penjadwalan.
  _Perlu diverifikasi:_ apakah catatan jadwal/kehadiran wajib menjadi bagian rekam medis dan disimpan di SIMRS.
- Audit log disimpan append-only. _Perlu diverifikasi:_ masa simpan audit dan kewajiban akses oleh pihak berwenang.
- Integrasi dengan SATUSEHAT/FHIR (mis. resource `Appointment`, `Encounter`, `ServiceRequest`) adalah **rencana**,
  belum dibangun. _Perlu diverifikasi:_ kewajiban pelaporan untuk fasilitas mitra dan profil FHIR yang berlaku.

## 3. JKN/BPJS — rujukan berjenjang

| Aturan yang diasumsikan                    | Nilai di sistem                                             | Lokasi konfigurasi                | Status                                                                |
| ------------------------------------------ | ----------------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------- |
| Masa berlaku surat rujukan                 | 90 hari sejak verifikasi                                    | `policy.referralValidityDays`     | **Perlu diverifikasi** (termasuk apakah dihitung dari tanggal terbit) |
| Rujukan wajib untuk layanan poli spesialis | Dokumen "Surat rujukan" wajib `verified` sebelum konfirmasi | `createEpisode` (dokumen default) | **Perlu diverifikasi** per jenis layanan & penjamin                   |
| Kunjungan ulang / kontrol                  | Tidak dimodelkan                                            | —                                 | Perlu diverifikasi (rujuk balik, surat kontrol)                       |
| Integrasi VClaim / Mobile JKN              | Tidak ada (adapter mock)                                    | `src/server/adapters/`            | Rencana                                                               |

Sistem **tidak** melakukan verifikasi kepesertaan, eligibilitas, atau penagihan.

## 4. Aturan layanan klinis (bukan keputusan klinis)

| Aturan                                | Default                                                | Konfigurasi                                    | Status                                                            |
| ------------------------------------- | ------------------------------------------------------ | ---------------------------------------------- | ----------------------------------------------------------------- |
| Lab puasa harus mulai paling lambat   | 10:00 WIB                                              | Admin unit → `service_type.latest_start_local` | Perlu diverifikasi oleh laboratorium                              |
| Waktu hasil lab siap                  | 180 menit                                              | `service_type.result_ready_min`                | Perlu diverifikasi                                                |
| Jeda minimum lab → poli setelah hasil | 0 menit                                                | `dependency.min_gap_min` / `defaultPrecedence` | Perlu diverifikasi                                                |
| Prioritas klinis                      | Diisi tenaga kesehatan; tidak pernah ditentukan sistem | —                                              | Prinsip desain                                                    |
| Kasus mendesak                        | Keluar dari alur otomatis (`urgent` → engine `manual`) | —                                              | Prinsip desain; prosedur RS untuk penanganan manual perlu ditulis |

## 5. Penahanan jadwal (dampak ke pasien lain)

TTL bertingkat (2/24/48 jam), batas perpanjangan (2), rasio hold maksimum (30%) adalah **asumsi MVP**, konfigurabel di
admin unit. _Perlu diverifikasi:_ kebijakan keadilan akses RS dan apakah penahanan untuk pasien luar kota dapat
dibenarkan terhadap pasien lokal (lihat displacement di `docs/EKSPERIMEN-TTL.md`).

## 6. Situs publik

- Tidak ada pelacak/analitik pihak ketiga; cookie hanya yang diperlukan. _Perlu diverifikasi:_ teks kebijakan privasi dan
  syarat (keduanya **draf**, ditandai "perlu ditinjau hukum").
- Tidak ada klaim kepatuhan, sertifikasi, atau integrasi (diuji `tests/repo-policy.test.ts`).

## 7. Ketergantungan teknis dengan catatan keamanan

- `npm audit` melaporkan kerentanan pada dependensi **dev** (esbuild lama di dalam `drizzle-kit`). Tidak masuk bundel
  produksi; pantau pembaruan `drizzle-kit`.
- CSP memakai `'unsafe-inline'` untuk skrip bootstrap Next.js. Sebelum produksi: CSP berbasis nonce.
- Rate limit dan _demo sandbox refresh_ memakai penjaga proses tunggal; deployment multi-instance perlu advisory lock /
  store bersama.
