import 'server-only';
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import type { PlanStatus } from '@/domain/tripPlan';
import { addDays, toLocalDate } from '@/lib/time';
import type { Db } from './db/client';
import {
  auditLog,
  document,
  episode,
  episodeService,
  escort,
  escortAvailability,
  hold,
  holdExtension,
  outbox,
  patient,
  patientRequest,
  planVisit,
  serviceType,
  slot,
  tripPlan,
  unit,
} from './db/schema';
import { allowedHeld } from './usecases/planning';

export type QueueCategory = 'mendesak' | 'susun_ulang' | 'ditahan' | 'permintaan' | 'pilih_opsi' | 'baru' | 'terkonfirmasi' | 'selesai';

export const QUEUE_LABEL: Record<QueueCategory, string> = {
  mendesak: 'Mendesak — tangani manual',
  susun_ulang: 'Perlu disusun ulang',
  ditahan: 'Jadwal ditahan sementara',
  permintaan: 'Permintaan pasien',
  pilih_opsi: 'Opsi siap dipilih',
  baru: 'Belum disusun',
  terkonfirmasi: 'Terkonfirmasi',
  selesai: 'Selesai',
};

export interface QueueItem {
  episodeId: string;
  title: string;
  patient: string;
  origin: string;
  distanceKm: number;
  priority: 'rutin' | 'segera';
  category: QueueCategory;
  planSummary: string | null;
  holdExpiresAt: number | null;
  pendingDocs: number;
  requiresEscort: boolean;
  openRequests: number;
  firstVisit: string | null;
}

const ORDER: QueueCategory[] = ['mendesak', 'susun_ulang', 'ditahan', 'permintaan', 'pilih_opsi', 'baru', 'terkonfirmasi', 'selesai'];

export async function loadQueue(db: Db): Promise<QueueItem[]> {
  const eps = await db
    .select({ ep: episode, pt: patient })
    .from(episode)
    .innerJoin(patient, eq(patient.id, episode.patientId))
    .orderBy(asc(episode.createdAt));
  if (eps.length === 0) return [];
  const ids = eps.map((e) => e.ep.id);
  const plans = await db
    .select({ p: tripPlan, h: hold })
    .from(tripPlan)
    .leftJoin(hold, eq(hold.tripPlanId, tripPlan.id))
    .where(inArray(tripPlan.episodeId, ids))
    .orderBy(desc(tripPlan.createdAt), asc(tripPlan.rank));
  const docs = await db
    .select({ episodeId: document.episodeId, status: document.status })
    .from(document)
    .where(inArray(document.episodeId, ids));
  const reqs = await db
    .select({ episodeId: patientRequest.episodeId })
    .from(patientRequest)
    .where(and(inArray(patientRequest.episodeId, ids), isNull(patientRequest.resolvedAt)));
  const visits = await db
    .select({ planId: planVisit.tripPlanId, d: planVisit.localDate })
    .from(planVisit)
    .innerJoin(tripPlan, eq(tripPlan.id, planVisit.tripPlanId))
    .where(and(inArray(tripPlan.episodeId, ids), inArray(tripPlan.status, ['HELD', 'CONFIRMED', 'PROPOSED'])));

  const items = eps.map(({ ep, pt }) => {
    const mine = plans.filter((x) => x.p.episodeId === ep.id);
    const active = mine.find((x) => x.p.status === 'HELD' || x.p.status === 'CONFIRMED');
    const proposed = mine.filter((x) => x.p.status === 'PROPOSED').sort((a, b) => a.p.rank - b.p.rank)[0];
    const latest = mine[0];
    const openRequests = reqs.filter((r) => r.episodeId === ep.id).length;
    const shown = active ?? proposed;
    let category: QueueCategory;
    if (ep.closedAt) category = 'selesai';
    else if (ep.urgent) category = 'mendesak';
    else if (active?.p.status === 'HELD') category = 'ditahan';
    else if (openRequests > 0) category = 'permintaan';
    else if (active?.p.status === 'CONFIRMED') category = 'terkonfirmasi';
    else if (proposed) category = 'pilih_opsi';
    else if (latest && ['REPLAN_REQUIRED', 'EXPIRED', 'CANCELLED'].includes(latest.p.status)) category = 'susun_ulang';
    else category = 'baru';
    const d = shown ? visits.filter((v) => v.planId === shown.p.id).map((v) => v.d).sort()[0] ?? null : null;
    return {
      episodeId: ep.id,
      title: ep.title,
      patient: pt.pseudonym,
      origin: pt.originRegency,
      distanceKm: pt.distanceKm,
      priority: ep.priority,
      category,
      planSummary: shown?.p.summary ?? null,
      holdExpiresAt: active?.p.status === 'HELD' && active.h ? active.h.expiresAt.getTime() : null,
      pendingDocs: docs.filter((x) => x.episodeId === ep.id && x.status !== 'verified').length,
      requiresEscort: ep.requiresEscort,
      openRequests,
      firstVisit: d,
    } satisfies QueueItem;
  });
  return items.sort(
    (a, b) =>
      ORDER.indexOf(a.category) - ORDER.indexOf(b.category) ||
      (a.holdExpiresAt ?? Infinity) - (b.holdExpiresAt ?? Infinity) ||
      (a.priority === b.priority ? 0 : a.priority === 'segera' ? -1 : 1) ||
      b.pendingDocs - a.pendingDocs,
  );
}

export async function loadEpisodeDetail(db: Db, episodeId: string) {
  const [row] = await db
    .select({ ep: episode, pt: patient })
    .from(episode)
    .innerJoin(patient, eq(patient.id, episode.patientId))
    .where(eq(episode.id, episodeId));
  if (!row) return null;
  const services = await db
    .select({ st: serviceType })
    .from(episodeService)
    .innerJoin(serviceType, eq(serviceType.id, episodeService.serviceTypeId))
    .where(eq(episodeService.episodeId, episodeId))
    .orderBy(asc(serviceType.sortOrder));
  const docs = await db.select().from(document).where(eq(document.episodeId, episodeId)).orderBy(asc(document.label));
  const [esc] = await db.select().from(escort).where(eq(escort.patientId, row.pt.id));
  const escortDays = esc
    ? await db.select().from(escortAvailability).where(eq(escortAvailability.escortId, esc.id)).orderBy(asc(escortAvailability.localDate))
    : [];
  const plans = await db
    .select({ p: tripPlan, h: hold })
    .from(tripPlan)
    .leftJoin(hold, eq(hold.tripPlanId, tripPlan.id))
    .where(eq(tripPlan.episodeId, episodeId))
    .orderBy(desc(tripPlan.createdAt), asc(tripPlan.rank));
  const planIds = plans.map((p) => p.p.id);
  const visits = planIds.length
    ? await db
        .select({ v: planVisit, unitName: unit.name, location: unit.location })
        .from(planVisit)
        .innerJoin(slot, eq(slot.id, planVisit.slotId))
        .innerJoin(unit, eq(unit.id, slot.unitId))
        .where(inArray(planVisit.tripPlanId, planIds))
        .orderBy(asc(planVisit.startsAt))
    : [];
  const holdIds = plans.flatMap((p) => (p.h ? [p.h.id] : []));
  const extensions = holdIds.length
    ? await db.select().from(holdExtension).where(inArray(holdExtension.holdId, holdIds)).orderBy(asc(holdExtension.at))
    : [];
  const auditEntityIds = [episodeId, ...planIds, ...holdIds, ...docs.map((d) => d.id)];
  const history = await db
    .select()
    .from(auditLog)
    .where(inArray(auditLog.entityId, auditEntityIds))
    .orderBy(desc(auditLog.id))
    .limit(60);
  const requests = await db.select().from(patientRequest).where(eq(patientRequest.episodeId, episodeId)).orderBy(desc(patientRequest.createdAt));
  const messages = await db.select().from(outbox).where(eq(outbox.episodeId, episodeId)).orderBy(desc(outbox.createdAt)).limit(10);

  const active = plans.find((p) => p.p.status === 'HELD' || p.p.status === 'CONFIRMED');
  const impact = active?.p.status === 'HELD' ? await capacityImpact(db, active.p.id) : [];

  return {
    episode: row.ep,
    patient: row.pt,
    services: services.map((s) => s.st),
    documents: docs,
    escort: esc ?? null,
    escortDays,
    plans: plans.map(({ p, h }) => ({
      ...p,
      status: p.status as PlanStatus,
      hold: h,
      visits: visits.filter((v) => v.v.tripPlanId === p.id),
      extensions: h ? extensions.filter((e) => e.holdId === h.id) : [],
    })),
    history,
    requests,
    messages,
    impact,
  };
}
export type EpisodeDetail = NonNullable<Awaited<ReturnType<typeof loadEpisodeDetail>>>;

/** How much shared capacity this plan's hold occupies on each of its days. */
export async function capacityImpact(db: Db, planId: string) {
  const days = await db
    .select({ serviceTypeId: planVisit.serviceTypeId, localDate: planVisit.localDate, name: serviceType.shortName, ratio: serviceType.maxHoldRatio })
    .from(planVisit)
    .innerJoin(serviceType, eq(serviceType.id, planVisit.serviceTypeId))
    .where(eq(planVisit.tripPlanId, planId));
  const out = [];
  for (const d of days) {
    const [c] = await db
      .select({
        held: sql<number>`count(*) filter (where ${slot.status} = 'held')`.mapWith(Number),
        available: sql<number>`count(*) filter (where ${slot.status} = 'available')`.mapWith(Number),
        total: sql<number>`count(*) filter (where ${slot.status} <> 'blocked')`.mapWith(Number),
      })
      .from(slot)
      .where(and(eq(slot.serviceTypeId, d.serviceTypeId), eq(slot.localDate, d.localDate)));
    out.push({ ...d, ...c!, allowed: allowedHeld(c!.total, d.ratio) });
  }
  return out;
}

export async function capacityOverview(db: Db, fromDate: string, days = 14) {
  const to = addDays(fromDate, days - 1);
  return db
    .select({
      serviceTypeId: slot.serviceTypeId,
      name: serviceType.shortName,
      ratio: serviceType.maxHoldRatio,
      localDate: slot.localDate,
      total: sql<number>`count(*)`.mapWith(Number),
      available: sql<number>`count(*) filter (where ${slot.status} = 'available')`.mapWith(Number),
      held: sql<number>`count(*) filter (where ${slot.status} = 'held')`.mapWith(Number),
      booked: sql<number>`count(*) filter (where ${slot.status} = 'booked')`.mapWith(Number),
      blocked: sql<number>`count(*) filter (where ${slot.status} = 'blocked')`.mapWith(Number),
    })
    .from(slot)
    .innerJoin(serviceType, eq(serviceType.id, slot.serviceTypeId))
    .where(and(gte(slot.localDate, fromDate), lte(slot.localDate, to)))
    .groupBy(slot.serviceTypeId, serviceType.shortName, serviceType.maxHoldRatio, slot.localDate, serviceType.sortOrder)
    .orderBy(asc(serviceType.sortOrder), asc(slot.localDate));
}

export async function loadOutbox(db: Db, limit = 100) {
  return db.select().from(outbox).orderBy(desc(outbox.createdAt)).limit(limit);
}

export async function loadAudit(db: Db, limit = 200) {
  return db.select().from(auditLog).orderBy(desc(auditLog.id)).limit(limit);
}

export function todayLocal() {
  return toLocalDate(Date.now());
}
