import { ActionForm } from '@/components/ActionForm';
import { Countdown } from '@/components/Countdown';
import { JourneyTimeline } from '@/components/JourneyTimeline';
import { Badge } from '@/components/ui';
import { brand } from '@/config/brand.config';
import { links } from '@/config/links';
import { DOC_LABEL, DOC_TONE } from '@/content/labels';
import { formatIdr, formatLocalDate, formatLocalDateTime } from '@/lib/time';
import { patientEscortAction, patientRescheduleAction, patientUploadAction } from '@/server/actions/patient';
import type { EpisodeDetail } from '@/server/queries';

/** What a patient or escort sees: plain language, large text, only their own trip. No clinical detail. */
export function PatientView({ d, zone, token, now }: { d: EpisodeDetail; zone: 'app' | 'demo'; token?: string; now: number }) {
  const hidden = { zone, ...(zone === 'demo' && token ? { token } : {}) };
  const plan = d.plans.find((p) => p.status === 'HELD' || p.status === 'CONFIRMED');
  const pendingDocs = d.documents.filter((x) => x.status !== 'verified');
  const days = plan ? [...new Set(plan.visits.map((v) => v.v.localDate))] : [];
  const escortConfirmed = days.length > 0 && days.every((day) => d.escortDays.some((e) => e.localDate === day && e.status === 'confirmed'));
  const fasting = d.services.some((s) => s.fasting);
  const places = plan ? Object.fromEntries(plan.visits.map((v) => [v.v.slotId, v.location])) : {};

  let status: { title: string; body: string; tone: string };
  if (d.episode.urgent) {
    status = {
      title: 'Petugas akan menghubungi Anda langsung',
      body: 'Jadwal Anda ditangani langsung oleh petugas rumah sakit. Bila kondisi memburuk, segera ke IGD terdekat.',
      tone: 'bg-danger-soft',
    };
  } else if (plan?.status === 'CONFIRMED') {
    status = { title: 'Jadwal Anda sudah pasti', body: 'Semua persyaratan lengkap. Silakan datang sesuai jadwal di bawah.', tone: 'bg-leaf-soft' };
  } else if (plan?.status === 'HELD') {
    status = {
      title: 'Jadwal sedang ditahan sementara untuk Anda',
      body: 'Jadwal ini belum pasti. Lengkapi hal-hal di bawah agar jadwal dikonfirmasi sebelum waktu penahanan habis.',
      tone: 'bg-ochre-soft',
    };
  } else {
    status = {
      title: 'Petugas sedang menyusun jadwal Anda',
      body: 'Anda akan menerima kabar setelah jadwal ditahan. Tidak perlu datang dulu.',
      tone: 'bg-teal-soft',
    };
  }

  return (
    <div className="container-page max-w-3xl py-8 text-lg">
      <p className="text-base font-semibold tracking-wide text-clay uppercase">Perjalanan Anda ke {brand.demoHospital}</p>
      <h1 className="text-4xl">Halo, {d.patient.pseudonym}</h1>

      <section aria-labelledby="status" className={`mt-6 rounded-2xl ${status.tone} p-5`}>
        <h2 id="status" className="text-2xl">
          {status.title}
        </h2>
        <p className="mt-2">{status.body}</p>
        {plan?.status === 'HELD' && plan.hold && (
          <p className="mt-3 font-semibold">
            Ditahan sampai {formatLocalDateTime(plan.hold.expiresAt.getTime())} WIB (<Countdown until={plan.hold.expiresAt.getTime()} now={now} />)
          </p>
        )}
      </section>

      {plan && (
        <section aria-labelledby="jadwal" className="ticket mt-6 p-5">
          <h2 id="jadwal" className="text-2xl">
            {plan.detail.visitDays === 1 ? 'Cukup datang 1 hari' : `${plan.detail.visitDays} hari kunjungan`}
          </h2>
          <p className="mt-1 text-ink-soft">Urutan di bawah sudah diatur supaya hasil pemeriksaan siap sebelum konsultasi.</p>
          <div className="mt-5">
            <JourneyTimeline plan={plan.detail} places={places} />
          </div>
          <div className="ticket-perf my-5" aria-hidden="true" />
          <p>
            <strong>Perkiraan biaya: {formatIdr(plan.detail.cost.totalIdr)}</strong>
          </p>
          <p className="text-base text-ink-soft">
            Transportasi {formatIdr(plan.detail.cost.transportIdr)}
            {plan.detail.cost.lodgingIdr > 0 && `, penginapan ${formatIdr(plan.detail.cost.lodgingIdr)}`}
            {plan.detail.cost.lostIncomeIdr > 0 && `, perkiraan penghasilan yang hilang ${formatIdr(plan.detail.cost.lostIncomeIdr)}`}. Ini perkiraan,
            bukan tagihan.
          </p>
        </section>
      )}

      <section aria-labelledby="siapkan" className="mt-6">
        <h2 id="siapkan" className="text-2xl">
          Yang perlu disiapkan
        </h2>
        <ul className="mt-3 space-y-4">
          {fasting && (
            <li className="ticket p-4">
              <p className="font-semibold">Datang dalam keadaan puasa</p>
              <p className="text-base text-ink-soft">
                {d.services.find((s) => s.fasting)?.prepNote ?? 'Ikuti petunjuk petugas.'} Ikuti petunjuk petugas bila berbeda.
              </p>
            </li>
          )}
          {d.documents.map((doc) => (
            <li key={doc.id} className="ticket p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{doc.label}</p>
                <Badge tone={DOC_TONE[doc.status]}>{DOC_LABEL[doc.status]}</Badge>
              </div>
              <p className="text-base text-ink-soft">Bawa aslinya saat datang.</p>
              {(doc.status === 'missing' || doc.status === 'expired') && (
                <ActionForm action={patientUploadAction} hidden={{ ...hidden, documentId: doc.id }} label="Kirim foto dokumen" className="mt-3">
                  <label htmlFor={`file-${doc.id}`} className="text-base font-semibold">
                    Foto atau berkas {doc.label.toLowerCase()}
                  </label>
                  <input id={`file-${doc.id}`} name="file" type="file" accept="image/*,application/pdf" className="text-base" />
                  <p className="text-sm text-muted">Simulasi: isi berkas tidak disimpan, hanya namanya.</p>
                </ActionForm>
              )}
            </li>
          ))}
          {d.episode.requiresEscort && (
            <li className="ticket p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">Pendamping{d.escort ? `: ${d.escort.pseudonym}` : ''}</p>
                <Badge tone={escortConfirmed ? 'leaf' : 'ochre'}>{escortConfirmed ? 'Sudah konfirmasi' : 'Belum konfirmasi'}</Badge>
              </div>
              {plan && !escortConfirmed && (
                <ActionForm action={patientEscortAction} hidden={hidden} label="Pendamping bisa ikut di semua hari ini" className="mt-3">
                  <p className="text-base">{days.map(formatLocalDate).join(', ')}</p>
                </ActionForm>
              )}
            </li>
          )}
        </ul>
        {pendingDocs.length === 0 && !d.episode.requiresEscort && !fasting && <p className="mt-3">Tidak ada yang perlu disiapkan selain kartu identitas.</p>}
      </section>

      {!d.episode.urgent && (
        <section aria-labelledby="ubah" className="ticket mt-6 p-5">
          <h2 id="ubah" className="text-2xl">
            Jadwal tidak cocok?
          </h2>
          <ActionForm action={patientRescheduleAction} hidden={hidden} label="Minta ubah jadwal" tone="secondary" className="mt-3">
            <label htmlFor="message" className="text-base font-semibold">
              Ceritakan singkat (opsional)
            </label>
            <textarea
              id="message"
              name="message"
              maxLength={300}
              rows={3}
              placeholder="mis. Saya hanya bisa hari Kamis"
              className="rounded-lg border border-line bg-card p-3 text-base"
            />
            <p className="text-sm text-muted">Jangan tulis nomor identitas atau keluhan kesehatan di sini.</p>
          </ActionForm>
        </section>
      )}

      <section className="mt-8 rounded-2xl bg-paper-deep p-5 text-base">
        <p>
          <strong>Darurat?</strong> Jangan menunggu jadwal. Segera ke IGD terdekat atau hubungi 119.
        </p>
        <p className="mt-2 text-ink-soft">
          {brand.name} hanya mengatur jadwal dan perjalanan, bukan keputusan medis.{' '}
          <a href={links.site.untukPasien()} rel="noopener noreferrer" className="text-teal underline">
            Tentang layanan ini
          </a>{' '}
          ·{' '}
          <a href={links.site.keamananPrivasi()} rel="noopener noreferrer" className="text-teal underline">
            Privasi
          </a>
        </p>
      </section>
    </div>
  );
}
