import { ActionForm } from '@/components/ActionForm';
import { Field, inputClass, Notice } from '@/components/ui';
import { REGENCIES } from '@seed/reference';
import { addDays } from '@/lib/time';
import { createEpisodeAction } from '@/server/actions/coordinator';
import type { Zone } from './paths';

export function NewEpisodeForm({ zone, today }: { zone: Zone; today: string }) {
  return (
    <div className="container-page max-w-3xl py-8">
      <p className="text-sm font-semibold tracking-wide text-clay uppercase">Episode baru</p>
      <h1 className="text-3xl sm:text-4xl">Satu kebutuhan layanan, satu perjalanan</h1>
      <p className="mt-2 text-ink-soft">Isi data minimum saja. Jangan tulis diagnosis atau detail klinis — sistem hanya butuh jenis layanan.</p>
      <div className="mt-4">
        <Notice tone="clay">
          Hanya data sintetis dalam MVP ini. Prioritas diisi tenaga kesehatan; tandai mendesak bila pasien perlu ditangani langsung.
        </Notice>
      </div>
      <div className="ticket mt-6 p-5">
        <ActionForm action={createEpisodeAction} hidden={{ zone }} label="Buat episode & susun rencana">
          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-2 font-display text-xl">Pasien</legend>
            <Field label="Nama samaran / inisial" htmlFor="pseudonym" hint="Contoh: Ibu R.S.">
              <input id="pseudonym" name="pseudonym" required minLength={2} maxLength={40} className={inputClass} />
            </Field>
            <Field label="NIK (opsional)" htmlFor="nationalId" hint="Tidak disimpan. Hanya sidik kunci (HMAC) untuk mencegah data ganda.">
              <input id="nationalId" name="nationalId" inputMode="numeric" pattern="\d{16}" autoComplete="off" className={inputClass} />
            </Field>
            <Field label="Kabupaten/kota asal" htmlFor="originRegency">
              <select id="originRegency" name="originRegency" className={inputClass} defaultValue="Kab. Sukamaju">
                {REGENCIES.map((r) => (
                  <option key={r.name} value={r.name}>
                    {r.name} (±{r.distanceKm} km)
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Jarak (km)" htmlFor="distanceKm">
                <input id="distanceKm" name="distanceKm" type="number" min={1} defaultValue={120} className={inputClass} />
              </Field>
              <Field label="Waktu tempuh (menit)" htmlFor="travelMinutes">
                <input id="travelMinutes" name="travelMinutes" type="number" min={10} defaultValue={150} className={inputClass} />
              </Field>
            </div>
            <label className="flex items-center gap-2 font-semibold sm:col-span-2">
              <input type="checkbox" name="wheelchair" className="h-5 w-5" /> Butuh kursi roda / bantuan mobilitas
            </label>
          </fieldset>

          <fieldset className="mt-6 grid gap-4 sm:grid-cols-2">
            <legend className="mb-2 font-display text-xl">Kebutuhan layanan</legend>
            <Field label="Judul episode" htmlFor="title" hint="Umum saja, mis. “Pemeriksaan lanjutan penyakit dalam”.">
              <input id="title" name="title" required defaultValue="Pemeriksaan lanjutan penyakit dalam" className={inputClass} />
            </Field>
            <div className="flex flex-col gap-2">
              <span className="font-semibold">Layanan</span>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="serviceCodes" value="LAB_DARAH" defaultChecked className="h-5 w-5" /> Pemeriksaan darah (puasa)
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="serviceCodes" value="POLI_PD" defaultChecked className="h-5 w-5" /> Konsultasi Poli Penyakit Dalam
              </label>
            </div>
            <Field label="Paling awal" htmlFor="earliestDate">
              <input id="earliestDate" name="earliestDate" type="date" required defaultValue={addDays(today, 1)} className={inputClass} />
            </Field>
            <Field label="Paling lambat" htmlFor="latestDate">
              <input id="latestDate" name="latestDate" type="date" required defaultValue={addDays(today, 14)} className={inputClass} />
            </Field>
            <Field label="Prioritas (diisi tenaga kesehatan)" htmlFor="priority">
              <select id="priority" name="priority" className={inputClass}>
                <option value="rutin">Rutin</option>
                <option value="segera">Segera</option>
              </select>
            </Field>
            <Field label="Lama penahanan jadwal" htmlFor="holdTier">
              <select id="holdTier" name="holdTier" defaultValue="standar" className={inputClass}>
                <option value="singkat">Singkat (2 jam)</option>
                <option value="standar">Standar (24 jam)</option>
                <option value="panjang">Panjang (48 jam)</option>
              </select>
            </Field>
            <Field label="Surat rujukan" htmlFor="referralStatus">
              <select id="referralStatus" name="referralStatus" defaultValue="missing" className={inputClass}>
                <option value="missing">Belum ada</option>
                <option value="uploaded">Sudah diterima, belum diverifikasi</option>
                <option value="verified">Sudah diverifikasi</option>
              </select>
            </Field>
            <label className="flex items-center gap-2 self-end font-semibold text-danger">
              <input type="checkbox" name="urgent" className="h-5 w-5" /> Mendesak (tangani manual)
            </label>
          </fieldset>

          <fieldset className="mt-6 grid gap-4 sm:grid-cols-2">
            <legend className="mb-2 font-display text-xl">Pendamping</legend>
            <label className="flex items-center gap-2 font-semibold sm:col-span-2">
              <input type="checkbox" name="requiresEscort" className="h-5 w-5" /> Pasien wajib didampingi
            </label>
            <Field label="Nama samaran pendamping" htmlFor="escortPseudonym">
              <input id="escortPseudonym" name="escortPseudonym" maxLength={40} className={inputClass} />
            </Field>
            <Field label="Hubungan" htmlFor="escortRelation">
              <input id="escortRelation" name="escortRelation" placeholder="anak, pasangan, …" maxLength={30} className={inputClass} />
            </Field>
            <div className="sm:col-span-2">
              <p className="font-semibold">Tanggal pendamping bisa ikut</p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <input key={i} aria-label={`Tanggal pendamping ${i + 1}`} name="escortDates" type="date" className={inputClass} />
                ))}
              </div>
            </div>
          </fieldset>
        </ActionForm>
      </div>
    </div>
  );
}
