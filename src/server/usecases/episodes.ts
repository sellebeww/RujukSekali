import { and, eq, gt, inArray, isNull } from 'drizzle-orm';
import { defaultPrecedence, policy } from '@/config/policy';
import { addDays, HOUR, toLocalDate } from '@/lib/time';
import { audit } from '../audit';
import { requireRole, type Ctx } from '../context';
import { hmacNationalId, randomToken, sha256 } from '../crypto';
import type { Db } from '../db/client';
import {
  dependency,
  document,
  episode,
  episodeService,
  escort,
  escortAvailability,
  patient,
  patientAccessToken,
  patientRequest,
  planVisit,
  serviceType,
  tripPlan,
} from '../db/schema';
import { DomainError, ForbiddenError, NotFoundError } from '../errors';
import { notify } from '../notifications';
import { dependencyChanged, recheckEpisode } from './holds';

/** Patients may only touch their own episode; staff (and the demo sandbox actor) pass. */
export function requireEpisodeAccess(ctx: Ctx, episodeId: string) {
  if (ctx.actor.type === 'patient') {
    if (ctx.actor.id !== episodeId) throw new ForbiddenError();
    return;
  }
  requireRole(ctx, 'coordinator');
}

export interface NewEpisode {
  patient: {
    pseudonym: string;
    originRegency: string;
    distanceKm: number;
    travelMinutes: number;
    mobilityNeeds: string[];
    nationalId?: string;
  };
  title: string;
  serviceCodes: string[];
  earliestDate: string;
  latestDate: string;
  desiredDate?: string;
  priority: 'rutin' | 'segera';
  urgent: boolean;
  requiresEscort: boolean;
  escort?: {
    pseudonym: string;
    relation: string;
    windows: { localDate: string; fromLocal: string; toLocal: string }[];
  };
  holdTier: 'singkat' | 'standar' | 'panjang';
  includeLostIncome: boolean;
  documents?: {
    kind: 'surat_rujukan' | 'hasil_lama' | 'kartu_identitas';
    label: string;
    status?: 'missing' | 'uploaded' | 'verified';
    validUntil?: string;
  }[];
  scenario?: string;
}

export async function createEpisode(
  ctx: Ctx,
  data: NewEpisode,
): Promise<{ episodeId: string; patientId: string }> {
  requireRole(ctx, 'coordinator');
  if (data.latestDate < data.earliestDate)
    throw new DomainError('BAD_WINDOW', 'Tanggal paling lambat harus setelah tanggal paling awal.', 400);
  const now = new Date(ctx.clock.now());
  return ctx.db.transaction(async (tx) => {
    const services = await tx.select().from(serviceType).where(inArray(serviceType.code, data.serviceCodes));
    if (services.length !== new Set(data.serviceCodes).size)
      throw new DomainError('BAD_SERVICE', 'Layanan tidak dikenal.', 400);

    const nidHash = data.patient.nationalId ? hmacNationalId(data.patient.nationalId) : null;
    let patientId: string | undefined;
    if (nidHash) {
      const [existing] = await tx
        .select({ id: patient.id })
        .from(patient)
        .where(eq(patient.nationalIdHmac, nidHash));
      patientId = existing?.id;
    }
    if (!patientId) {
      const [p] = await tx
        .insert(patient)
        .values({
          pseudonym: data.patient.pseudonym,
          originRegency: data.patient.originRegency,
          distanceKm: data.patient.distanceKm,
          travelMinutes: data.patient.travelMinutes,
          mobilityNeeds: data.patient.mobilityNeeds,
          nationalIdHmac: nidHash,
        })
        .returning({ id: patient.id });
      patientId = p!.id;
    }

    const [ep] = await tx
      .insert(episode)
      .values({
        patientId,
        title: data.title,
        earliestDate: data.earliestDate,
        latestDate: data.latestDate,
        desiredDate: data.desiredDate ?? null,
        priority: data.priority,
        urgent: data.urgent,
        requiresEscort: data.requiresEscort,
        holdTier: data.holdTier,
        includeLostIncome: data.includeLostIncome,
        scenario: data.scenario ?? null,
        createdBy: ctx.actor.type === 'user' ? ctx.actor.id : null,
        createdAt: now,
      })
      .returning({ id: episode.id });
    const episodeId = ep!.id;
    await tx.insert(episodeService).values(services.map((s) => ({ episodeId, serviceTypeId: s.id })));

    const idByCode = new Map(services.map((s) => [s.code, s.id]));
    for (const r of defaultPrecedence) {
      if (!idByCode.has(r.before) || !idByCode.has(r.after)) continue;
      await tx.insert(dependency).values({
        episodeId,
        type: 'PRECEDENCE',
        fromServiceTypeId: idByCode.get(r.before)!,
        toServiceTypeId: idByCode.get(r.after)!,
        minGapMin: r.minGapMin,
      });
    }
    await tx
      .insert(dependency)
      .values([
        { episodeId, type: 'DOCUMENT_READY', params: { kinds: ['surat_rujukan'] } },
        { episodeId, type: 'TRANSPORT_FEASIBLE', params: { originRegency: data.patient.originRegency } },
        ...(data.requiresEscort ? [{ episodeId, type: 'ESCORT_AVAILABLE' as const }] : []),
      ]);

    const docs = data.documents ?? [{ kind: 'surat_rujukan' as const, label: 'Surat rujukan' }];
    for (const d of docs) {
      await tx.insert(document).values({
        episodeId,
        kind: d.kind,
        label: d.label,
        status: d.status ?? 'missing',
        validUntil: d.validUntil ?? null,
        ...(d.status === 'verified' ? { verifiedAt: now, verifiedBy: null } : {}),
        ...(d.status && d.status !== 'missing' ? { fileName: `${d.kind}.pdf`, uploadedAt: now } : {}),
      });
    }

    if (data.requiresEscort && data.escort) {
      const [e] = await tx
        .insert(escort)
        .values({ patientId, pseudonym: data.escort.pseudonym, relation: data.escort.relation })
        .returning({ id: escort.id });
      if (data.escort.windows.length) {
        await tx
          .insert(escortAvailability)
          .values(data.escort.windows.map((w) => ({ ...w, escortId: e!.id })));
      }
    }
    await audit(tx, ctx, {
      entity: 'episode',
      entityId: episodeId,
      action: 'created',
      data: { services: data.serviceCodes },
    });
    return { episodeId, patientId };
  });
}

// ---- Documents -----------------------------------------------------------------------------

async function loadDoc(db: Db, docId: string) {
  const [d] = await db.select().from(document).where(eq(document.id, docId));
  if (!d) throw new NotFoundError('Dokumen');
  return d;
}

export async function uploadDocument(ctx: Ctx, docId: string, fileName: string) {
  const d = await loadDoc(ctx.db, docId);
  requireEpisodeAccess(ctx, d.episodeId);
  if (d.status === 'verified') throw new DomainError('ALREADY_VERIFIED', 'Dokumen ini sudah diverifikasi.');
  const safeName = fileName.replace(/[^\w.\- ]/g, '').slice(0, 80) || 'dokumen.pdf';
  await ctx.db.transaction(async (tx) => {
    await tx
      .update(document)
      .set({ status: 'uploaded', fileName: safeName, uploadedAt: new Date(ctx.clock.now()) })
      .where(eq(document.id, docId));
    await audit(tx, ctx, {
      entity: 'document',
      entityId: docId,
      action: 'uploaded',
      from: d.status,
      to: 'uploaded',
    });
  });
  return { status: 'uploaded' as const };
}

export async function verifyDocument(ctx: Ctx, docId: string, validUntil?: string) {
  requireRole(ctx, 'coordinator');
  const d = await loadDoc(ctx.db, docId);
  if (d.status !== 'uploaded')
    throw new DomainError('BAD_STATE', 'Hanya dokumen yang sudah diunggah yang bisa diverifikasi.');
  const until =
    validUntil ??
    (d.kind === 'surat_rujukan' ? addDays(toLocalDate(ctx.clock.now()), policy.referralValidityDays) : null);
  await ctx.db.transaction(async (tx) => {
    await tx
      .update(document)
      .set({
        status: 'verified',
        validUntil: until,
        verifiedAt: new Date(ctx.clock.now()),
        verifiedBy: ctx.actor.id,
      })
      .where(eq(document.id, docId));
    await audit(tx, ctx, {
      entity: 'document',
      entityId: docId,
      action: 'verified',
      from: 'uploaded',
      to: 'verified',
    });
  });
  return recheckEpisode(ctx, d.episodeId);
}

export async function rejectDocument(ctx: Ctx, docId: string, reason: string) {
  requireRole(ctx, 'coordinator');
  const d = await loadDoc(ctx.db, docId);
  await ctx.db.transaction(async (tx) => {
    await tx
      .update(document)
      .set({ status: 'missing', fileName: null, uploadedAt: null })
      .where(eq(document.id, docId));
    await audit(tx, ctx, {
      entity: 'document',
      entityId: docId,
      action: 'rejected',
      from: d.status,
      to: 'missing',
      reason,
    });
  });
}

/** A document became invalid. A confirmed plan can no longer stand: it is replanned, never left dangling. */
export async function markDocumentExpired(ctx: Ctx, docId: string) {
  requireRole(ctx, 'coordinator');
  const d = await loadDoc(ctx.db, docId);
  await ctx.db.transaction(async (tx) => {
    await tx.update(document).set({ status: 'expired' }).where(eq(document.id, docId));
    await audit(tx, ctx, {
      entity: 'document',
      entityId: docId,
      action: 'expired',
      from: d.status,
      to: 'expired',
    });
  });
  const [confirmed] = await ctx.db
    .select({ id: tripPlan.id })
    .from(tripPlan)
    .where(and(eq(tripPlan.episodeId, d.episodeId), eq(tripPlan.status, 'CONFIRMED')));
  if (confirmed) await dependencyChanged(ctx, d.episodeId, `${d.label} tidak berlaku lagi`);
}

// ---- Escort --------------------------------------------------------------------------------

async function activePlanDays(db: Db, episodeId: string) {
  const rows = await db
    .select({ d: planVisit.localDate, status: tripPlan.status })
    .from(planVisit)
    .innerJoin(tripPlan, eq(tripPlan.id, planVisit.tripPlanId))
    .where(and(eq(tripPlan.episodeId, episodeId), inArray(tripPlan.status, ['HELD', 'CONFIRMED'])));
  return { days: [...new Set(rows.map((r) => r.d))].sort(), status: rows[0]?.status ?? null };
}

async function escortOf(db: Db, episodeId: string) {
  const [ep] = await db.select().from(episode).where(eq(episode.id, episodeId));
  if (!ep) throw new NotFoundError('Episode');
  const [e] = await db.select().from(escort).where(eq(escort.patientId, ep.patientId));
  return { ep, escort: e ?? null };
}

/** The escort confirms they can come on every visit day of the held plan. */
export async function confirmEscortDays(ctx: Ctx, episodeId: string) {
  requireEpisodeAccess(ctx, episodeId);
  const { escort: e } = await escortOf(ctx.db, episodeId);
  if (!e) throw new DomainError('NO_ESCORT', 'Episode ini tidak memiliki pendamping terdaftar.');
  const { days } = await activePlanDays(ctx.db, episodeId);
  if (days.length === 0)
    throw new DomainError('NO_PLAN', 'Belum ada jadwal yang ditahan untuk dikonfirmasi.');
  await ctx.db.transaction(async (tx) => {
    for (const d of days) {
      const updated = await tx
        .update(escortAvailability)
        .set({ status: 'confirmed' })
        .where(and(eq(escortAvailability.escortId, e.id), eq(escortAvailability.localDate, d)))
        .returning({ id: escortAvailability.id });
      if (updated.length === 0) {
        await tx
          .insert(escortAvailability)
          .values({
            escortId: e.id,
            localDate: d,
            fromLocal: '05:00',
            toLocal: '20:00',
            status: 'confirmed',
          });
      }
    }
    await audit(tx, ctx, {
      entity: 'episode',
      entityId: episodeId,
      action: 'escort_confirmed',
      data: { days: days.length },
    });
  });
  return recheckEpisode(ctx, episodeId);
}

export async function cancelEscortDay(ctx: Ctx, episodeId: string, localDate: string) {
  requireEpisodeAccess(ctx, episodeId);
  const { escort: e } = await escortOf(ctx.db, episodeId);
  if (!e) throw new DomainError('NO_ESCORT', 'Episode ini tidak memiliki pendamping terdaftar.');
  await ctx.db.transaction(async (tx) => {
    await tx
      .update(escortAvailability)
      .set({ status: 'cancelled' })
      .where(and(eq(escortAvailability.escortId, e.id), eq(escortAvailability.localDate, localDate)));
    await audit(tx, ctx, {
      entity: 'episode',
      entityId: episodeId,
      action: 'escort_cancelled',
      data: { localDate },
    });
  });
  const { days } = await activePlanDays(ctx.db, episodeId);
  if (days.includes(localDate))
    await dependencyChanged(ctx, episodeId, 'Pendamping batal pada salah satu hari kunjungan');
}

// ---- Patient access ------------------------------------------------------------------------

export async function issuePatientToken(
  ctx: Ctx,
  episodeId: string,
): Promise<{ token: string; expiresAt: string }> {
  requireRole(ctx, 'coordinator');
  const token = randomToken();
  const expiresAt = new Date(ctx.clock.now() + policy.patientTokenTtlHours * HOUR);
  await ctx.db
    .insert(patientAccessToken)
    .values({ tokenHash: sha256(token), episodeId, expiresAt, createdAt: new Date(ctx.clock.now()) });
  await audit(ctx.db, ctx, { entity: 'episode', entityId: episodeId, action: 'patient_link_issued' });
  return { token, expiresAt: expiresAt.toISOString() };
}

export async function resolvePatientToken(db: Db, token: string, nowMs: number): Promise<string | null> {
  if (!/^[\w-]{20,100}$/.test(token)) return null;
  const [row] = await db
    .select({ episodeId: patientAccessToken.episodeId })
    .from(patientAccessToken)
    .where(
      and(
        eq(patientAccessToken.tokenHash, sha256(token)),
        isNull(patientAccessToken.revokedAt),
        gt(patientAccessToken.expiresAt, new Date(nowMs)),
      ),
    );
  return row?.episodeId ?? null;
}

export async function revokePatientTokens(ctx: Ctx, episodeId: string) {
  requireRole(ctx, 'coordinator');
  await ctx.db
    .update(patientAccessToken)
    .set({ revokedAt: new Date(ctx.clock.now()) })
    .where(and(eq(patientAccessToken.episodeId, episodeId), isNull(patientAccessToken.revokedAt)));
  await audit(ctx.db, ctx, { entity: 'episode', entityId: episodeId, action: 'patient_links_revoked' });
}

/** Rejects free text that looks like a national ID or phone number: patient requests must not carry personal data. */
export function looksLikePersonalData(text: string) {
  return /\d{10,}/.test(text.replace(/[\s.-]/g, ''));
}

export async function requestReschedule(ctx: Ctx, episodeId: string, message: string) {
  requireEpisodeAccess(ctx, episodeId);
  const text = message.trim().slice(0, 300);
  if (looksLikePersonalData(text)) {
    throw new DomainError(
      'PERSONAL_DATA',
      'Mohon jangan menulis nomor identitas atau nomor telepon di sini.',
      400,
    );
  }
  await ctx.db.transaction(async (tx) => {
    await tx
      .insert(patientRequest)
      .values({
        episodeId,
        kind: 'ubah_jadwal',
        message: text || null,
        createdAt: new Date(ctx.clock.now()),
      });
    const [row] = await tx
      .select({ p: patient.pseudonym })
      .from(episode)
      .innerJoin(patient, eq(patient.id, episode.patientId))
      .where(eq(episode.id, episodeId));
    await notify(tx, ctx, {
      template: 'patient_request_coordinator',
      episodeId,
      patientLabel: row?.p ?? 'Pasien',
    });
    await audit(tx, ctx, { entity: 'episode', entityId: episodeId, action: 'reschedule_requested' });
  });
}

export async function resolvePatientRequest(ctx: Ctx, requestId: string) {
  requireRole(ctx, 'coordinator');
  await ctx.db
    .update(patientRequest)
    .set({ resolvedAt: new Date(ctx.clock.now()) })
    .where(eq(patientRequest.id, requestId));
}
