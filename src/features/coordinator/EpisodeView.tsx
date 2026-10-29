import Link from 'next/link';
import { ActionForm } from '@/components/ActionForm';
import { Countdown } from '@/components/Countdown';
import { JourneyTimeline } from '@/components/JourneyTimeline';
import { Badge, Card, Notice, selectClass } from '@/components/ui';
import { links } from '@/config/links';
import { AUDIT_LABEL, DOC_LABEL, DOC_TONE, PLAN_TONE, TIER_LABEL } from '@/content/labels';
import { PLAN_STATUS_LABEL } from '@/domain/tripPlan';
import { formatIdr, formatLocalDate, formatLocalDateTime } from '@/lib/time';
import {
  approveAction,
  cancelAction,
  completeAction,
  docAction,
  extendAction,
  holdAction,
  patientLinkAction,
  priorityAction,
  proposeAction,
  releaseAction,
  resolveRequestAction,
} from '@/server/actions/coordinator';
import type { EpisodeDetail } from '@/server/queries';
import { zonePaths, type Zone } from './paths';

type Plan = EpisodeDetail['plans'][number];

function PlanTicket({
  plan,
  zone,
  now,
  detail,
  recommended,
}: {
  plan: Plan;
  zone: Zone;
  now: number;
  detail: EpisodeDetail;
  recommended: boolean;
}) {
  const places = Object.fromEntries(plan.visits.map((v) => [v.v.slotId, v.location]));
  const z = { zone, planId: plan.id };
  const c = plan.detail.cost;
  const isHeld = plan.status === 'HELD';
  const maxExt = Math.min(...detail.services.map((s) => s.maxExtensions));
  return (
    <article
      className="ticket overflow-hidden"
      data-testid={`plan-${plan.status}`}
      aria-labelledby={`plan-${plan.id}`}
    >
      <div className="flex flex-wrap items-center gap-2 px-5 pt-5">
        <h3 id={`plan-${plan.id}`} className="font-sans text-base font-bold">
          Opsi {plan.rank}
        </h3>
        <Badge tone={PLAN_TONE[plan.status]}>{PLAN_STATUS_LABEL[plan.status]}</Badge>
        {recommended && plan.status === 'PROPOSED' && <Badge tone="leaf">Paling sedikit perjalanan</Badge>}
        {plan.approvedAt && <Badge tone="teal">Disetujui koordinator</Badge>}
      </div>
      <div className="grid gap-1 px-5 pt-2 pb-4">
        <p className="font-display text-2xl">
          {plan.detail.visitDays} hari kunjungan · {plan.detail.trips.length} kali perjalanan
        </p>
        <p className="text-ink-soft">
          Perkiraan biaya pasien {formatIdr(c.totalIdr)}{' '}
          <span className="text-sm text-muted">
            (transportasi {formatIdr(c.transportIdr)}
            {c.lodgingIdr ? `, menginap ${formatIdr(c.lodgingIdr)}` : ''}
            {c.lostIncomeIdr ? `, penghasilan hilang ${formatIdr(c.lostIncomeIdr)}` : ''})
          </span>
        </p>
        {isHeld && plan.hold && (
          <p className="mt-1 rounded-lg bg-ochre-soft px-3 py-2 text-[0.95rem]">
            Jadwal ditahan sementara · berakhir <Countdown until={plan.hold.expiresAt.getTime()} now={now} />{' '}
            ({formatLocalDateTime(plan.hold.expiresAt.getTime())} WIB) · diperpanjang{' '}
            {plan.hold.extensionsCount}/{maxExt} kali
          </p>
        )}
      </div>
      <div className="ticket-perf" aria-hidden="true" />
      <div className="grid gap-5 px-5 py-5 md:grid-cols-2">
        <JourneyTimeline plan={plan.detail} places={places} />
        <div>
          <h4 className="font-sans text-sm font-bold tracking-wide text-muted uppercase">
            Mengapa rencana ini
          </h4>
          <ul className="mt-2 space-y-1.5 text-[0.95rem]">
            {plan.detail.explanation.map((e, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden="true" className="text-teal">
                  →
                </span>
                {e}
              </li>
            ))}
          </ul>
        </div>
      </div>
      {['PROPOSED', 'HELD', 'CONFIRMED'].includes(plan.status) && (
        <div className="flex flex-wrap gap-4 border-t border-line bg-paper/60 px-5 py-4">
          {plan.status === 'PROPOSED' && (
            <>
              <ActionForm action={holdAction} hidden={z} label="Tahan jadwal ini" />
              <ActionForm
                action={releaseAction}
                hidden={z}
                label="Buang opsi"
                tone="secondary"
                reason={{ label: 'Alasan', placeholder: 'mis. tidak cocok untuk pasien' }}
              />
            </>
          )}
          {isHeld && (
            <>
              {!plan.approvedAt && (
                <ActionForm action={approveAction} hidden={z} label="Setujui rencana" tone="accent" />
              )}
              <ActionForm
                action={extendAction}
                hidden={z}
                label="Perpanjang penahanan"
                tone="secondary"
                reason={{ label: 'Alasan perpanjangan', placeholder: 'mis. rujukan sedang diurus' }}
              />
              <ActionForm
                action={releaseAction}
                hidden={z}
                label="Lepas jadwal"
                tone="danger"
                reason={{ label: 'Alasan melepas', placeholder: 'mis. pasien minta tanggal lain' }}
              />
            </>
          )}
          {plan.status === 'CONFIRMED' && (
            <>
              <ActionForm
                action={completeAction}
                hidden={z}
                label="Tandai kunjungan selesai"
                tone="secondary"
              />
              <ActionForm
                action={cancelAction}
                hidden={z}
                label="Batalkan jadwal"
                tone="danger"
                reason={{ label: 'Alasan pembatalan' }}
              />
            </>
          )}
        </div>
      )}
    </article>
  );
}

export function EpisodeView({ d, zone, now }: { d: EpisodeDetail; zone: Zone; now: number }) {
  const paths = zonePaths(zone);
  const { episode: ep, patient: pt } = d;
  const active = d.plans.find((p) => p.status === 'HELD' || p.status === 'CONFIRMED');
  const proposed = d.plans.filter((p) => p.status === 'PROPOSED').sort((a, b) => a.rank - b.rank);
  const past = d.plans.filter((p) => !['PROPOSED', 'HELD', 'CONFIRMED'].includes(p.status));
  const activeDays = active ? [...new Set(active.visits.map((v) => v.v.localDate))] : [];
  const z = { zone, episodeId: ep.id };
  const planning = ep.planning;

  return (
    <div className="container-page py-8">
      <Link href={paths.queue} className="text-teal underline">
        ← Kembali ke antrean
      </Link>
      <header className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold tracking-wide text-clay uppercase">Episode layanan</p>
          <h1 className="text-3xl sm:text-4xl">{pt.pseudonym}</h1>
          <p className="text-lg text-ink-soft">{ep.title}</p>
          <p className="mt-1 text-muted">
            {pt.originRegency} · ±{pt.distanceKm} km ({Math.round(pt.travelMinutes / 60)} jam perjalanan)
            {pt.mobilityNeeds.length > 0 && ` · kebutuhan khusus: ${pt.mobilityNeeds.join(', ')}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={ep.priority === 'segera' ? 'clay' : 'neutral'}>Prioritas: {ep.priority}</Badge>
          <Badge>
            Jendela {formatLocalDate(ep.earliestDate)} – {formatLocalDate(ep.latestDate)}
          </Badge>
          <Badge>Penahanan: {TIER_LABEL[ep.holdTier]}</Badge>
          {d.services.map((s) => (
            <Badge key={s.id} tone="teal">
              {s.shortName}
            </Badge>
          ))}
        </div>
      </header>

      {ep.urgent && (
        <div className="mt-5">
          <Notice tone="danger" role="alert" title="MENDESAK — tangani di luar sistem">
            Episode ini ditandai mendesak. Sistem tidak menyusun atau menahan jadwal otomatis. Hubungi tenaga
            kesehatan dan arahkan pasien sesuai prosedur rumah sakit; kondisi darurat → IGD.
          </Notice>
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <section aria-labelledby="rencana" className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="rencana" className="text-2xl">
              Rencana perjalanan
            </h2>
            {!active && !ep.urgent && !ep.closedAt && (
              <ActionForm
                action={proposeAction}
                hidden={z}
                label={proposed.length ? 'Susun ulang opsi' : 'Susun rencana'}
                tone="secondary"
              />
            )}
          </div>

          {planning && (planning.notes.length > 0 || planning.rejections.length > 0) && !active && (
            <Notice
              tone={planning.rejections.length ? 'clay' : 'teal'}
              title={
                planning.rejections.length
                  ? 'Belum ada rencana yang memenuhi semua syarat'
                  : 'Catatan mesin penyusun'
              }
            >
              <ul className="mt-1 list-disc pl-5">
                {[...planning.rejections.map((r) => r.message), ...planning.notes].map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </Notice>
          )}

          {active && (
            <>
              <PlanTicket plan={active} zone={zone} now={now} detail={d} recommended={false} />
              {active.status === 'HELD' && d.impact.length > 0 && (
                <Card>
                  <h3 className="font-sans text-base font-bold">Dampak penahanan pada kapasitas bersama</h3>
                  <p className="text-sm text-muted">
                    Batas penahanan menjaga agar pasien lain tetap mendapat jadwal.
                  </p>
                  <ul className="mt-3 space-y-3">
                    {d.impact.map((i) => (
                      <li key={i.serviceTypeId + i.localDate}>
                        <p className="text-[0.95rem]">
                          <strong>{i.name}</strong>, {formatLocalDate(i.localDate)}: {i.held} dari batas{' '}
                          {i.allowed} slot ditahan · {i.available} slot masih kosong
                        </p>
                        <div
                          className="mt-1 h-2.5 overflow-hidden rounded-full bg-paper-deep"
                          role="img"
                          aria-label={`${i.held} dari ${i.allowed} batas penahanan terpakai`}
                        >
                          <div
                            className="h-full bg-ochre"
                            style={{ width: `${Math.min(100, (i.held / Math.max(1, i.allowed)) * 100)}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </>
          )}

          {!active &&
            proposed.map((p, i) => (
              <PlanTicket key={p.id} plan={p} zone={zone} now={now} detail={d} recommended={i === 0} />
            ))}

          {!active && proposed.length === 0 && !ep.urgent && !planning && (
            <p className="text-ink-soft">
              Belum ada opsi. Tekan &ldquo;Susun rencana&rdquo; untuk meminta mesin menyusun hingga 3 opsi.
            </p>
          )}

          {past.length > 0 && (
            <details className="ticket p-4">
              <summary className="cursor-pointer font-semibold">
                Riwayat rencana sebelumnya ({past.length})
              </summary>
              <ul className="mt-3 space-y-2 text-[0.95rem]">
                {past.map((p) => (
                  <li key={p.id} className="flex flex-wrap gap-2">
                    <Badge tone={PLAN_TONE[p.status]}>{PLAN_STATUS_LABEL[p.status]}</Badge>
                    <span>{p.summary}</span>
                    {p.statusReason && <span className="text-muted">— {p.statusReason}</span>}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>

        <aside className="flex flex-col gap-5" aria-label="Ketergantungan dan tindakan">
          <Card>
            <h2 className="font-sans text-lg font-bold">Ketergantungan penting</h2>
            <p className="text-sm text-muted">Jadwal baru pasti bila semuanya siap.</p>
            <h3 className="mt-4 font-sans text-sm font-bold tracking-wide text-muted uppercase">Dokumen</h3>
            <ul className="mt-2 space-y-3">
              {d.documents.map((doc) => (
                <li key={doc.id} data-testid="document">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{doc.label}</span>
                    <Badge tone={DOC_TONE[doc.status]}>{DOC_LABEL[doc.status]}</Badge>
                  </div>
                  {doc.validUntil && (
                    <p className="text-sm text-muted">Berlaku sampai {formatLocalDate(doc.validUntil)}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {doc.status === 'uploaded' && (
                      <>
                        <ActionForm
                          action={docAction}
                          hidden={{ zone, documentId: doc.id, op: 'verify' }}
                          label="Verifikasi"
                        />
                        <ActionForm
                          action={docAction}
                          hidden={{ zone, documentId: doc.id, op: 'reject' }}
                          label="Kembalikan"
                          tone="secondary"
                        />
                      </>
                    )}
                    {(doc.status === 'missing' || doc.status === 'expired') && (
                      <ActionForm
                        action={docAction}
                        hidden={{ zone, documentId: doc.id, op: 'upload' }}
                        label="Catat diterima di loket"
                        tone="secondary"
                      />
                    )}
                    {doc.status === 'verified' && (
                      <ActionForm
                        action={docAction}
                        hidden={{ zone, documentId: doc.id, op: 'expire' }}
                        label="Tandai tidak berlaku"
                        tone="danger"
                        confirm="Rencana terkonfirmasi akan disusun ulang. Lanjutkan?"
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>

            <h3 className="mt-5 font-sans text-sm font-bold tracking-wide text-muted uppercase">
              Pendamping
            </h3>
            {ep.requiresEscort ? (
              d.escort ? (
                <div className="mt-2 text-[0.95rem]">
                  <p>
                    {d.escort.pseudonym} ({d.escort.relation})
                  </p>
                  {activeDays.length > 0 ? (
                    <ul className="mt-1">
                      {activeDays.map((day) => {
                        const a = d.escortDays.find((x) => x.localDate === day);
                        return (
                          <li key={day} className="flex justify-between gap-2">
                            <span>{formatLocalDate(day)}</span>
                            <Badge
                              tone={
                                a?.status === 'confirmed'
                                  ? 'leaf'
                                  : a?.status === 'cancelled'
                                    ? 'danger'
                                    : 'ochre'
                              }
                            >
                              {a?.status === 'confirmed'
                                ? 'Terkonfirmasi'
                                : a?.status === 'cancelled'
                                  ? 'Batal'
                                  : 'Belum konfirmasi'}
                            </Badge>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-muted">
                      Tersedia:{' '}
                      {d.escortDays
                        .filter((x) => x.status !== 'cancelled')
                        .map((x) => formatLocalDate(x.localDate))
                        .join(', ') || '—'}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-danger">Pendamping wajib tetapi belum terdaftar.</p>
              )
            ) : (
              <p className="mt-1 text-[0.95rem] text-muted">Tidak diperlukan.</p>
            )}

            <h3 className="mt-5 font-sans text-sm font-bold tracking-wide text-muted uppercase">
              Transportasi
            </h3>
            {active ? (
              <ul className="mt-1 text-[0.95rem]">
                {active.detail.trips.map((t) => (
                  <li key={t.startDate}>
                    {t.transportLabel}: {t.departLocal} → tiba {t.arriveLocal}; pulang {t.returnDepartLocal}{' '}
                    <Badge tone="leaf">Feasible</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-[0.95rem] text-muted">
                Diperiksa saat rencana disusun (jadwal statis + estimasi tarif).
              </p>
            )}

            <h3 className="mt-5 font-sans text-sm font-bold tracking-wide text-muted uppercase">
              Persetujuan koordinator
            </h3>
            <p className="mt-1 text-[0.95rem]">{active?.approvedAt ? 'Sudah disetujui' : 'Belum'}</p>
          </Card>

          <Card>
            <h2 className="font-sans text-lg font-bold">Tautan untuk pasien</h2>
            <p className="text-sm text-muted">
              Tanpa password. Berlaku 72 jam, bisa dicabut. Tautan hanya tampil sekali.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <ActionForm
                action={patientLinkAction}
                hidden={{ ...z, op: 'issue' }}
                label="Buat tautan pasien"
                tone="secondary"
              />
              <ActionForm
                action={patientLinkAction}
                hidden={{ ...z, op: 'revoke' }}
                label="Cabut semua tautan"
                tone="danger"
              />
            </div>
          </Card>

          {d.requests.filter((r) => !r.resolvedAt).length > 0 && (
            <Card>
              <h2 className="font-sans text-lg font-bold">Permintaan pasien</h2>
              <ul className="mt-2 space-y-3">
                {d.requests
                  .filter((r) => !r.resolvedAt)
                  .map((r) => (
                    <li key={r.id}>
                      <p className="text-[0.95rem]">Minta ubah jadwal{r.message ? `: “${r.message}”` : ''}</p>
                      <ActionForm
                        action={resolveRequestAction}
                        hidden={{ zone, requestId: r.id }}
                        label="Tandai ditangani"
                        tone="secondary"
                      />
                    </li>
                  ))}
              </ul>
            </Card>
          )}

          {!ep.closedAt && (
            <Card>
              <h2 className="font-sans text-lg font-bold">Perubahan prioritas klinis</h2>
              <p className="text-sm text-muted">
                Diisi oleh tenaga kesehatan/koordinator. Semua jadwal yang ditahan akan dilepas, lalu disusun
                ulang.
              </p>
              <ActionForm
                action={priorityAction}
                hidden={z}
                label="Simpan perubahan"
                tone="secondary"
                reason={{ label: 'Alasan (dari tenaga kesehatan)' }}
              >
                <label className="mt-2 flex flex-col gap-1 text-sm font-semibold">
                  Prioritas
                  <select name="priority" defaultValue={ep.priority} className={selectClass}>
                    <option value="rutin">Rutin</option>
                    <option value="segera">Segera</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input type="checkbox" name="urgent" defaultChecked={ep.urgent} className="h-5 w-5" />{' '}
                  Tandai mendesak (keluar dari alur otomatis)
                </label>
              </ActionForm>
            </Card>
          )}

          <Card>
            <h2 className="font-sans text-lg font-bold">Riwayat (audit)</h2>
            <ol className="mt-2 max-h-80 space-y-2 overflow-auto text-sm">
              {d.history.map((h) => (
                <li key={h.id} className="border-l-2 border-line pl-3">
                  <p className="font-semibold">{AUDIT_LABEL[h.action] ?? h.action}</p>
                  <p className="text-muted">
                    {formatLocalDateTime(h.at.getTime())} · {h.actorLabel}
                    {h.reason ? ` · “${h.reason}”` : ''}
                  </p>
                </li>
              ))}
            </ol>
            <a
              href={zone === 'demo' ? links.demo.inbox() : links.app.inbox()}
              className="mt-3 inline-block text-sm text-teal underline"
            >
              Lihat notifikasi (kotak masuk simulasi)
            </a>
          </Card>
        </aside>
      </div>
    </div>
  );
}
