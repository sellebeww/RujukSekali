import { and, asc, eq, inArray, lte, sql } from 'drizzle-orm';
import { policy } from '@/config/policy';
import {
  confirmationBlockers,
  transition,
  type Blocker,
  type PlanEvent,
  type PlanStatus,
} from '@/domain/tripPlan';
import { MINUTE } from '@/lib/time';
import { audit } from '../audit';
import { requireRole, type Ctx } from '../context';
import type { Executor, Tx } from '../db/client';
import {
  capacityDay,
  capacityDenial,
  document,
  episode,
  escort,
  escortAvailability,
  facility,
  hold,
  holdExtension,
  patient,
  planVisit,
  serviceType,
  slot,
  transportOption,
  tripPlan,
  unit,
} from '../db/schema';
import { DomainError, NotFoundError } from '../errors';
import { withIdempotency } from '../idempotency';
import { notify, type NoticeVisit } from '../notifications';
import { allowedHeld, proposePlans, type ProposalOutcome } from './planning';

type PlanRow = typeof tripPlan.$inferSelect;
type HoldRow = typeof hold.$inferSelect;

async function lockPlan(tx: Tx, planId: string): Promise<PlanRow> {
  const [p] = await tx.select().from(tripPlan).where(eq(tripPlan.id, planId)).for('update');
  if (!p) throw new NotFoundError('Rencana');
  return p;
}

/** The single path for plan status changes: validates against the state machine, persists, audits. */
async function movePlan(
  tx: Tx,
  ctx: Ctx,
  plan: PlanRow,
  event: PlanEvent,
  reason?: string,
  data?: Record<string, unknown>,
) {
  const to = transition(plan.status as PlanStatus, event);
  const now = new Date(ctx.clock.now());
  const terminal = ['COMPLETED', 'EXPIRED', 'RELEASED', 'CANCELLED', 'REPLAN_REQUIRED'].includes(to);
  await tx
    .update(tripPlan)
    .set({ status: to, statusReason: reason ?? null, updatedAt: now, ...(terminal ? { endedAt: now } : {}) })
    .where(eq(tripPlan.id, plan.id));
  await audit(tx, ctx, {
    entity: 'trip_plan',
    entityId: plan.id,
    action: event,
    from: plan.status,
    to,
    reason: reason ?? null,
    data,
  });
  plan.status = to;
  return to;
}

async function planSlotIds(ex: Executor, planId: string): Promise<string[]> {
  const rows = await ex
    .select({ slotId: planVisit.slotId })
    .from(planVisit)
    .where(eq(planVisit.tripPlanId, planId));
  return rows.map((r) => r.slotId).sort();
}

export async function noticeVisits(ex: Executor, planId: string): Promise<NoticeVisit[]> {
  const rows = await ex
    .select({
      startsAt: planVisit.startsAt,
      localDate: planVisit.localDate,
      location: unit.location,
      fasting: serviceType.fasting,
    })
    .from(planVisit)
    .innerJoin(slot, eq(slot.id, planVisit.slotId))
    .innerJoin(unit, eq(unit.id, slot.unitId))
    .innerJoin(serviceType, eq(serviceType.id, planVisit.serviceTypeId))
    .where(eq(planVisit.tripPlanId, planId))
    .orderBy(asc(planVisit.startsAt));
  return rows.map((r) => ({ ...r, startsAt: r.startsAt.getTime() }));
}

async function patientLabel(ex: Executor, episodeId: string) {
  const [r] = await ex
    .select({ p: patient.pseudonym })
    .from(episode)
    .innerJoin(patient, eq(patient.id, episode.patientId))
    .where(eq(episode.id, episodeId));
  return r?.p ?? 'Pasien';
}

/** Frees every slot a hold owns. Returns the slot ids so the external system can be told too. */
async function freeHeldSlots(tx: Tx, holdId: string): Promise<string[]> {
  const rows = await tx
    .update(slot)
    .set({ status: 'available', holdId: null })
    .where(and(eq(slot.holdId, holdId), eq(slot.status, 'held')))
    .returning({ id: slot.id });
  return rows.map((r) => r.id);
}

async function freeBookedSlots(tx: Tx, planId: string): Promise<string[]> {
  const rows = await tx
    .update(slot)
    .set({ status: 'available', bookedPlanId: null })
    .where(and(eq(slot.bookedPlanId, planId), eq(slot.status, 'booked')))
    .returning({ id: slot.id });
  return rows.map((r) => r.id);
}

async function endHold(
  tx: Tx,
  ctx: Ctx,
  h: HoldRow,
  status: 'released' | 'expired' | 'converted',
  reason?: string,
) {
  await tx
    .update(hold)
    .set({ status, endedAt: new Date(ctx.clock.now()) })
    .where(eq(hold.id, h.id));
  await audit(tx, ctx, {
    entity: 'hold',
    entityId: h.id,
    action: status,
    from: h.status,
    to: status,
    reason: reason ?? null,
  });
}

// ---- Hold (saga) ---------------------------------------------------------------------------

export type HoldOutcome =
  | { ok: true; planId: string; holdId: string; expiresAt: string }
  | {
      ok: false;
      code: 'SLOT_TAKEN' | 'HOLD_CAP' | 'EXTERNAL_FAILED';
      message: string;
      alternatives: ProposalOutcome | null;
    };

class SlotTaken extends Error {
  constructor(readonly taken: string[]) {
    super('slot taken');
  }
}
class HoldCap extends Error {
  constructor(
    readonly serviceName: string,
    readonly localDate: string,
  ) {
    super('hold cap');
  }
}

export async function holdPlan(
  ctx: Ctx,
  planId: string,
  idempotencyKey: string | null | undefined,
): Promise<HoldOutcome> {
  requireRole(ctx, 'coordinator');
  return withIdempotency(ctx, 'hold', idempotencyKey, { planId }, () => holdPlanOnce(ctx, planId));
}

async function holdPlanOnce(ctx: Ctx, planId: string): Promise<HoldOutcome> {
  await expireDueHolds(ctx);
  const now = ctx.clock.now();
  let holdRow: HoldRow;
  let slotIds: string[];
  let episodeId: string;

  // Step 1 — local, atomic: lock capacity rows in a fixed order, check the ratio guard, claim every slot or none.
  try {
    ({ holdRow, slotIds, episodeId } = await ctx.db.transaction(async (tx) => {
      const plan = await lockPlan(tx, planId);
      const [ep] = await tx.select().from(episode).where(eq(episode.id, plan.episodeId)).for('update');
      if (!ep) throw new NotFoundError('Episode');
      if (ep.urgent)
        throw new DomainError('URGENT', 'Episode mendesak ditangani manual, tidak lewat penahanan otomatis.');
      if (plan.status !== 'PROPOSED') {
        throw new DomainError(
          'BAD_STATE',
          `Rencana berstatus ${plan.status}; hanya opsi yang disusun yang bisa ditahan.`,
        );
      }
      const active = await tx
        .select({ id: tripPlan.id })
        .from(tripPlan)
        .where(and(eq(tripPlan.episodeId, ep.id), inArray(tripPlan.status, ['HELD', 'CONFIRMED'])));
      const pending = await tx
        .select({ id: hold.id })
        .from(hold)
        .innerJoin(tripPlan, eq(tripPlan.id, hold.tripPlanId))
        .where(and(eq(tripPlan.episodeId, ep.id), eq(hold.status, 'pending')));
      if (active.length || pending.length) {
        throw new DomainError(
          'ACTIVE_PLAN',
          'Episode ini sudah punya jadwal yang sedang ditahan atau terkonfirmasi.',
        );
      }

      const visits = await tx.select().from(planVisit).where(eq(planVisit.tripPlanId, plan.id));
      const ids = visits.map((v) => v.slotId).sort();
      const dayKeys = [...new Map(visits.map((v) => [`${v.serviceTypeId}|${v.localDate}`, v])).values()].sort(
        (a, b) => (`${a.serviceTypeId}|${a.localDate}` < `${b.serviceTypeId}|${b.localDate}` ? -1 : 1),
      );
      for (const k of dayKeys) {
        await tx
          .insert(capacityDay)
          .values({ serviceTypeId: k.serviceTypeId, localDate: k.localDate })
          .onConflictDoNothing();
      }
      // Lock in a deterministic order so concurrent holds on overlapping days cannot deadlock.
      for (const k of dayKeys) {
        await tx
          .select()
          .from(capacityDay)
          .where(and(eq(capacityDay.serviceTypeId, k.serviceTypeId), eq(capacityDay.localDate, k.localDate)))
          .for('update');
        const [c] = await tx
          .select({
            held: sql<number>`count(*) filter (where ${slot.status} = 'held')`.mapWith(Number),
            total: sql<number>`count(*) filter (where ${slot.status} <> 'blocked')`.mapWith(Number),
          })
          .from(slot)
          .where(and(eq(slot.serviceTypeId, k.serviceTypeId), eq(slot.localDate, k.localDate)));
        const [st] = await tx.select().from(serviceType).where(eq(serviceType.id, k.serviceTypeId));
        const adding = visits.filter(
          (v) => v.serviceTypeId === k.serviceTypeId && v.localDate === k.localDate,
        ).length;
        if (c!.held + adding > allowedHeld(c!.total, st!.maxHoldRatio))
          throw new HoldCap(st!.name, k.localDate);
      }

      const services = await tx
        .select()
        .from(serviceType)
        .where(inArray(serviceType.id, [...new Set(visits.map((v) => v.serviceTypeId))]));
      const ttlMin = Math.min(...services.map((s) => s.holdTtlMinutes[ep.holdTier]));
      // A hold never outlives the moment the first visit must be certain (start minus the planning lead time).
      const firstStart = Math.min(...visits.map((v) => v.startsAt.getTime()));
      const expiresAt = Math.min(now + ttlMin * MINUTE, firstStart - policy.planner.minLeadMin * MINUTE);
      if (expiresAt <= now) throw new DomainError('TOO_LATE', 'Kunjungan pertama terlalu dekat untuk ditahan; susun ulang opsi.');
      const [h] = await tx
        .insert(hold)
        .values({
          tripPlanId: plan.id,
          status: 'pending',
          tier: ep.holdTier,
          expiresAt: new Date(expiresAt),
          createdAt: new Date(now),
        })
        .returning();

      // Conditional update: Postgres row locks guarantee exactly one winner per slot.
      const claimed = await tx
        .update(slot)
        .set({ status: 'held', holdId: h!.id })
        .where(and(inArray(slot.id, ids), eq(slot.status, 'available')))
        .returning({ id: slot.id });
      if (claimed.length !== ids.length) {
        const got = new Set(claimed.map((c) => c.id));
        throw new SlotTaken(ids.filter((id) => !got.has(id)));
      }
      return { holdRow: h!, slotIds: ids, episodeId: ep.id };
    }));
  } catch (e) {
    if (e instanceof SlotTaken || e instanceof HoldCap) return holdRejected(ctx, planId, e);
    throw e;
  }

  // Step 2 — external system, with compensation on any failure or uncertainty.
  const ext = await ctx.schedule.reserve(slotIds, holdRow.id);
  if (!ext.ok) {
    await ctx.schedule.release(slotIds, holdRow.id);
    await ctx.db.transaction(async (tx) => {
      await freeHeldSlots(tx, holdRow.id);
      await endHold(tx, ctx, { ...holdRow }, 'released', `Kompensasi: ${ext.message}`);
      await audit(tx, ctx, {
        entity: 'trip_plan',
        entityId: planId,
        action: 'hold_compensated',
        reason: ext.message,
        data: { uncertain: ext.uncertain, failedSlot: ext.slotId ?? null },
      });
    });
    ctx.log.warn('hold_compensated', {
      planId,
      holdId: holdRow.id,
      code: ext.uncertain ? 'uncertain' : 'failed',
    });
    return {
      ok: false,
      code: 'EXTERNAL_FAILED',
      message: `Penahanan dibatalkan seluruhnya: ${ext.message} Tidak ada jadwal yang tertahan.`,
      alternatives: null,
    };
  }

  // Step 3 — activate, unless the pending-hold sweeper already compensated it while the external call was slow.
  const activated = await ctx.db.transaction(async (tx) => {
    const plan = await lockPlan(tx, planId);
    const [current] = await tx.select().from(hold).where(eq(hold.id, holdRow.id)).for('update');
    if (current?.status !== 'pending') return false;
    await tx.update(hold).set({ status: 'active' }).where(eq(hold.id, holdRow.id));
    await audit(tx, ctx, {
      entity: 'hold',
      entityId: holdRow.id,
      action: 'activated',
      from: 'pending',
      to: 'active',
    });
    await movePlan(tx, ctx, plan, 'hold', undefined, { holdId: holdRow.id, slots: slotIds.length });
    const docs = await tx.select().from(document).where(eq(document.episodeId, episodeId));
    const pendingItems = docs.filter((d) => d.status !== 'verified').map((d) => d.label);
    await notify(tx, ctx, {
      template: 'plan_held',
      episodeId,
      visits: await noticeVisits(tx, planId),
      expiresAt: holdRow.expiresAt.getTime(),
      pendingItems,
    });
    return true;
  });
  if (!activated) {
    await ctx.schedule.release(slotIds, holdRow.id);
    return {
      ok: false,
      code: 'EXTERNAL_FAILED',
      message: 'Penahanan kedaluwarsa sebelum selesai diproses. Silakan coba lagi.',
      alternatives: null,
    };
  }
  ctx.log.info('hold_created', { planId, holdId: holdRow.id, count: slotIds.length });
  // A plan whose dependencies are already satisfied and approved confirms right away.
  await tryConfirm(ctx, planId);
  return { ok: true, planId, holdId: holdRow.id, expiresAt: holdRow.expiresAt.toISOString() };
}

async function holdRejected(ctx: Ctx, planId: string, e: SlotTaken | HoldCap): Promise<HoldOutcome> {
  const now = new Date(ctx.clock.now());
  const [plan] = await ctx.db.select().from(tripPlan).where(eq(tripPlan.id, planId));
  const visits = await ctx.db.select().from(planVisit).where(eq(planVisit.tripPlanId, planId));
  for (const v of visits) {
    if (e instanceof SlotTaken && !e.taken.includes(v.slotId)) continue;
    const [c] = await ctx.db
      .select({ held: sql<number>`count(*) filter (where ${slot.status} = 'held')`.mapWith(Number) })
      .from(slot)
      .where(and(eq(slot.serviceTypeId, v.serviceTypeId), eq(slot.localDate, v.localDate)));
    await ctx.db.insert(capacityDenial).values({
      serviceTypeId: v.serviceTypeId,
      localDate: v.localDate,
      at: now,
      reason: e instanceof SlotTaken ? 'slot_taken' : 'hold_cap',
      episodeId: plan?.episodeId ?? null,
      heldSlotsThatDay: c?.held ?? 0,
    });
  }
  await audit(ctx.db, ctx, {
    entity: 'trip_plan',
    entityId: planId,
    action: 'hold_rejected',
    reason: e.message,
  });
  // Offer fresh alternatives computed on the current snapshot.
  const alternatives = plan ? await proposePlans(ctx, plan.episodeId).catch(() => null) : null;
  if (e instanceof SlotTaken) {
    return {
      ok: false,
      code: 'SLOT_TAKEN',
      message:
        'Jadwal ini baru saja diambil pasien lain, jadi tidak ada yang ditahan. Opsi baru sudah disusun dari jadwal yang masih kosong.',
      alternatives,
    };
  }
  return {
    ok: false,
    code: 'HOLD_CAP',
    message: `Batas penahanan untuk ${e.serviceName} pada tanggal itu sudah tercapai, supaya pasien lain tetap kebagian jadwal. Opsi lain sudah disusun.`,
    alternatives,
  };
}

// ---- Confirmation --------------------------------------------------------------------------

export interface ConfirmOutcome {
  confirmed: boolean;
  blockers: Blocker[];
}

/** Confirms when every critical dependency is met; otherwise leaves the plan HELD and reports why. */
export async function tryConfirm(ctx: Ctx, planId: string): Promise<ConfirmOutcome> {
  const now = ctx.clock.now();
  const out = await ctx.db.transaction(async (tx) => {
    const plan = await lockPlan(tx, planId);
    const [h] = await tx.select().from(hold).where(eq(hold.tripPlanId, planId));
    if (plan.status === 'HELD' && h && h.status === 'active' && h.expiresAt.getTime() <= now) {
      await expireHoldTx(tx, ctx, h, plan);
      return {
        confirmed: false,
        blockers: [{ code: 'HOLD_EXPIRED' as const, message: 'Waktu penahanan jadwal sudah habis.' }],
        slotIds: [],
      };
    }
    const [ep] = await tx.select().from(episode).where(eq(episode.id, plan.episodeId));
    const docs = await tx.select().from(document).where(eq(document.episodeId, plan.episodeId));
    const visits = await tx.select().from(planVisit).where(eq(planVisit.tripPlanId, planId));
    const days = [...new Set(visits.map((v) => v.localDate))];
    const confirmedDays = ep!.requiresEscort
      ? await tx
          .select({ d: escortAvailability.localDate })
          .from(escortAvailability)
          .innerJoin(escort, eq(escort.id, escortAvailability.escortId))
          .where(
            and(
              eq(escort.patientId, ep!.patientId),
              eq(escortAvailability.status, 'confirmed'),
              inArray(escortAvailability.localDate, days),
            ),
          )
      : [];
    const transportIds = plan.detail.trips.map((t) => t.transportId);
    const transport = transportIds.length
      ? await tx
          .select({ id: transportOption.id })
          .from(transportOption)
          .where(inArray(transportOption.id, transportIds))
      : [];
    const blockers = confirmationBlockers({
      status: plan.status as PlanStatus,
      holdExpiresAt: h?.expiresAt.getTime() ?? null,
      now,
      urgent: ep!.urgent,
      documents: docs.map((d) => ({
        kind: d.kind,
        label: d.label,
        status: d.status,
        validUntil: d.validUntil,
      })),
      lastVisitDate: days.sort().at(-1)!,
      requiresEscort: ep!.requiresEscort,
      escortConfirmedForAllDays: days.every((d) => confirmedDays.some((c) => c.d === d)),
      transportFeasible: new Set(transport.map((t) => t.id)).size === new Set(transportIds).size,
      approvedByCoordinator: plan.approvedBy !== null,
      externalUncertain: false,
    });
    if (blockers.length) return { confirmed: false, blockers, slotIds: [] };

    const slotIds = visits.map((v) => v.slotId).sort();
    const ext = await ctx.schedule.commit(slotIds, planId);
    if (!ext.ok) {
      return {
        confirmed: false,
        blockers: [{ code: 'EXTERNAL_UNCERTAIN' as const, message: `Belum dikonfirmasi: ${ext.message}` }],
        slotIds: [],
      };
    }
    const booked = await tx
      .update(slot)
      .set({ status: 'booked', holdId: null, bookedPlanId: planId })
      .where(and(inArray(slot.id, slotIds), eq(slot.holdId, h!.id), eq(slot.status, 'held')))
      .returning({ id: slot.id });
    if (booked.length !== slotIds.length)
      throw new Error(`Invariant violated: plan ${planId} lost held slots`);
    await endHold(tx, ctx, h!, 'converted');
    await movePlan(tx, ctx, plan, 'confirm');
    const [fac] = await tx.select({ name: facility.name }).from(facility).limit(1);
    await notify(tx, ctx, {
      template: 'plan_confirmed',
      episodeId: plan.episodeId,
      visits: await noticeVisits(tx, planId),
      facility: fac?.name ?? 'rumah sakit',
    });
    return { confirmed: true, blockers: [], slotIds };
  });
  return { confirmed: out.confirmed, blockers: out.blockers };
}

export async function approvePlan(
  ctx: Ctx,
  planId: string,
  idempotencyKey: string | null | undefined,
): Promise<ConfirmOutcome> {
  requireRole(ctx, 'coordinator');
  return withIdempotency(ctx, 'approve', idempotencyKey, { planId }, async () => {
    await ctx.db.transaction(async (tx) => {
      const plan = await lockPlan(tx, planId);
      if (plan.status !== 'HELD')
        throw new DomainError('BAD_STATE', 'Hanya jadwal yang sedang ditahan yang bisa disetujui.');
      if (plan.approvedBy) return;
      await tx
        .update(tripPlan)
        .set({ approvedBy: ctx.actor.id, approvedAt: new Date(ctx.clock.now()) })
        .where(eq(tripPlan.id, planId));
      await audit(tx, ctx, { entity: 'trip_plan', entityId: planId, action: 'approved' });
    });
    return tryConfirm(ctx, planId);
  });
}

/** Re-check confirmation for the episode's held plan after a dependency changed. */
export async function recheckEpisode(ctx: Ctx, episodeId: string): Promise<ConfirmOutcome | null> {
  const [p] = await ctx.db
    .select({ id: tripPlan.id })
    .from(tripPlan)
    .where(and(eq(tripPlan.episodeId, episodeId), eq(tripPlan.status, 'HELD')));
  return p ? tryConfirm(ctx, p.id) : null;
}

// ---- Release / extend / cancel / complete ---------------------------------------------------

function requireReason(reason: string | undefined | null): string {
  const r = (reason ?? '').trim();
  if (r.length < policy.minReasonLength)
    throw new DomainError('REASON_REQUIRED', 'Alasan wajib diisi (minimal 5 karakter).', 400);
  return r.slice(0, 500);
}

export async function releasePlan(
  ctx: Ctx,
  planId: string,
  reason: string,
  idempotencyKey: string | null | undefined,
) {
  requireRole(ctx, 'coordinator');
  const why = requireReason(reason);
  return withIdempotency(ctx, 'release', idempotencyKey, { planId, why }, async () => {
    const freed = await ctx.db.transaction(async (tx) => {
      const plan = await lockPlan(tx, planId);
      const [h] = await tx.select().from(hold).where(eq(hold.tripPlanId, planId));
      let slots: string[] = [];
      if (h && (h.status === 'active' || h.status === 'pending')) {
        slots = await freeHeldSlots(tx, h.id);
        await endHold(tx, ctx, h, 'released', why);
      }
      const wasHeld = plan.status === 'HELD';
      await movePlan(tx, ctx, plan, 'release', why);
      if (wasHeld) await notify(tx, ctx, { template: 'plan_released', episodeId: plan.episodeId });
      return { slots, holdId: h?.id };
    });
    if (freed.holdId && freed.slots.length) await ctx.schedule.release(freed.slots, freed.holdId);
    return { released: true, slots: freed.slots.length };
  });
}

export async function extendHold(
  ctx: Ctx,
  planId: string,
  reason: string,
  idempotencyKey: string | null | undefined,
) {
  requireRole(ctx, 'coordinator');
  const why = requireReason(reason);
  return withIdempotency(ctx, 'extend', idempotencyKey, { planId, why }, async () => {
    await expireDueHolds(ctx);
    return ctx.db.transaction(async (tx) => {
      const plan = await lockPlan(tx, planId);
      const [h] = await tx.select().from(hold).where(eq(hold.tripPlanId, planId)).for('update');
      if (plan.status !== 'HELD' || !h || h.status !== 'active') {
        throw new DomainError('BAD_STATE', 'Tidak ada penahanan aktif untuk diperpanjang.');
      }
      const services = await tx
        .select({ st: serviceType })
        .from(planVisit)
        .innerJoin(serviceType, eq(serviceType.id, planVisit.serviceTypeId))
        .where(eq(planVisit.tripPlanId, planId));
      const maxExt = Math.min(...services.map((s) => s.st.maxExtensions));
      if (h.extensionsCount >= maxExt) {
        throw new DomainError(
          'EXTENSION_LIMIT',
          `Penahanan sudah diperpanjang ${h.extensionsCount} kali (batas ${maxExt}).`,
        );
      }
      const ttl = Math.min(...services.map((s) => s.st.holdTtlMinutes[h.tier]));
      const newExpires = new Date(h.expiresAt.getTime() + ttl * MINUTE);
      await tx
        .update(hold)
        .set({ expiresAt: newExpires, extensionsCount: h.extensionsCount + 1 })
        .where(eq(hold.id, h.id));
      await tx.insert(holdExtension).values({
        holdId: h.id,
        byUserId: ctx.actor.id,
        reason: why,
        oldExpiresAt: h.expiresAt,
        newExpiresAt: newExpires,
        at: new Date(ctx.clock.now()),
      });
      await audit(tx, ctx, {
        entity: 'hold',
        entityId: h.id,
        action: 'extended',
        reason: why,
        data: { from: h.expiresAt.toISOString(), to: newExpires.toISOString(), count: h.extensionsCount + 1 },
      });
      return {
        expiresAt: newExpires.toISOString(),
        extensionsCount: h.extensionsCount + 1,
        maxExtensions: maxExt,
      };
    });
  });
}

export async function cancelPlan(
  ctx: Ctx,
  planId: string,
  reason: string,
  idempotencyKey: string | null | undefined,
) {
  requireRole(ctx, 'coordinator');
  const why = requireReason(reason);
  return withIdempotency(ctx, 'cancel', idempotencyKey, { planId, why }, async () =>
    ctx.db.transaction(async (tx) => {
      const plan = await lockPlan(tx, planId);
      if (plan.status !== 'CONFIRMED')
        throw new DomainError('BAD_STATE', 'Hanya rencana terkonfirmasi yang bisa dibatalkan.');
      const visits = await tx.select().from(planVisit).where(eq(planVisit.tripPlanId, planId));
      const firstStart = Math.min(...visits.map((v) => v.startsAt.getTime()));
      const late = firstStart - ctx.clock.now() < policy.lateCancellationHours * 60 * MINUTE;
      const freed = await freeBookedSlots(tx, planId);
      await movePlan(tx, ctx, plan, 'cancel', why, { late, slots: freed.length });
      await notify(tx, ctx, { template: 'plan_released', episodeId: plan.episodeId });
      return { cancelled: true, late };
    }),
  );
}

export async function completePlan(ctx: Ctx, planId: string) {
  requireRole(ctx, 'coordinator');
  return ctx.db.transaction(async (tx) => {
    const plan = await lockPlan(tx, planId);
    await movePlan(tx, ctx, plan, 'complete');
    await tx
      .update(episode)
      .set({ closedAt: new Date(ctx.clock.now()) })
      .where(eq(episode.id, plan.episodeId));
    return { completed: true };
  });
}

// ---- Expiry --------------------------------------------------------------------------------

async function expireHoldTx(tx: Tx, ctx: Ctx, h: HoldRow, lockedPlan?: PlanRow) {
  const freed = await freeHeldSlots(tx, h.id);
  await endHold(tx, ctx, h, 'expired', 'Batas waktu penahanan habis');
  const plan = lockedPlan ?? (await lockPlan(tx, h.tripPlanId));
  if (plan.status === 'HELD') {
    await movePlan(tx, ctx, plan, 'expire', 'Batas waktu penahanan habis', { slots: freed.length });
    await notify(tx, ctx, { template: 'hold_expired_patient', episodeId: plan.episodeId });
    await notify(tx, ctx, {
      template: 'hold_expired_coordinator',
      episodeId: plan.episodeId,
      patientLabel: await patientLabel(tx, plan.episodeId),
    });
  }
  return freed;
}

/**
 * Expires every due hold and compensates holds stuck in `pending`. Safe to run concurrently (SKIP LOCKED);
 * called by the cron endpoint and lazily before any read that depends on slot state.
 */
export async function expireDueHolds(ctx: Ctx): Promise<{ expired: number; compensated: number }> {
  const now = ctx.clock.now();
  const released: { holdId: string; slots: string[] }[] = [];
  const counts = await ctx.db.transaction(async (tx) => {
    const due = await tx
      .select()
      .from(hold)
      .where(and(eq(hold.status, 'active'), lte(hold.expiresAt, new Date(now))))
      .orderBy(asc(hold.expiresAt), asc(hold.id))
      .limit(200)
      .for('update', { skipLocked: true });
    for (const h of due) released.push({ holdId: h.id, slots: await expireHoldTx(tx, ctx, h) });

    const stuck = await tx
      .select()
      .from(hold)
      .where(
        and(
          eq(hold.status, 'pending'),
          lte(hold.createdAt, new Date(now - policy.pendingHoldSweepMin * MINUTE)),
        ),
      )
      .limit(200)
      .for('update', { skipLocked: true });
    for (const h of stuck) {
      released.push({ holdId: h.id, slots: await freeHeldSlots(tx, h.id) });
      await endHold(tx, ctx, h, 'released', 'Kompensasi otomatis: penahanan tidak selesai');
    }
    return { expired: due.length, compensated: stuck.length };
  });
  for (const r of released) if (r.slots.length) await ctx.schedule.release(r.slots, r.holdId);
  if (counts.expired || counts.compensated)
    ctx.log.info('holds_expired', { expired: counts.expired, count: counts.compensated });
  return counts;
}

// ---- Clinical priority / dependency changes -------------------------------------------------

/** Releases every hold/booking of the episode and marks active plans REPLAN_REQUIRED, in one transaction. */
async function invalidateEpisodePlans(tx: Tx, ctx: Ctx, episodeId: string, reason: string) {
  const plans = await tx
    .select()
    .from(tripPlan)
    .where(
      and(
        eq(tripPlan.episodeId, episodeId),
        inArray(tripPlan.status, ['DRAFT', 'PROPOSED', 'HELD', 'CONFIRMED']),
      ),
    )
    .for('update');
  const released: { holdId: string; slots: string[] }[] = [];
  for (const plan of plans) {
    const [h] = await tx.select().from(hold).where(eq(hold.tripPlanId, plan.id));
    if (h && (h.status === 'active' || h.status === 'pending')) {
      released.push({ holdId: h.id, slots: await freeHeldSlots(tx, h.id) });
      await endHold(tx, ctx, h, 'released', reason);
    }
    if (plan.status === 'CONFIRMED') await freeBookedSlots(tx, plan.id);
    await movePlan(tx, ctx, plan, 'replan', reason);
  }
  if (plans.length) {
    await notify(tx, ctx, {
      template: 'replan_coordinator',
      episodeId,
      patientLabel: await patientLabel(tx, episodeId),
    });
  }
  return released;
}

export async function markPriorityChanged(
  ctx: Ctx,
  episodeId: string,
  change: { priority?: 'rutin' | 'segera'; urgent?: boolean; earliestDate?: string; latestDate?: string },
  reason: string,
): Promise<ProposalOutcome | null> {
  requireRole(ctx, 'coordinator');
  const why = requireReason(reason);
  const released = await ctx.db.transaction(async (tx) => {
    const [ep] = await tx.select().from(episode).where(eq(episode.id, episodeId)).for('update');
    if (!ep) throw new NotFoundError('Episode');
    await tx.update(episode).set(change).where(eq(episode.id, episodeId));
    await audit(tx, ctx, {
      entity: 'episode',
      entityId: episodeId,
      action: 'priority_changed',
      from: `${ep.priority}${ep.urgent ? '+mendesak' : ''}`,
      to: `${change.priority ?? ep.priority}${(change.urgent ?? ep.urgent) ? '+mendesak' : ''}`,
      reason: why,
    });
    return invalidateEpisodePlans(tx, ctx, episodeId, `Prioritas klinis berubah: ${why}`);
  });
  for (const r of released) if (r.slots.length) await ctx.schedule.release(r.slots, r.holdId);
  return proposePlans(ctx, episodeId);
}

/** A dependency changed under an active plan (document expired, escort cancelled): replan without leaving holds behind. */
export async function dependencyChanged(ctx: Ctx, episodeId: string, reason: string) {
  const released = await ctx.db.transaction((tx) => invalidateEpisodePlans(tx, ctx, episodeId, reason));
  for (const r of released) if (r.slots.length) await ctx.schedule.release(r.slots, r.holdId);
  return released.length;
}

export async function planSlots(ex: Executor, planId: string) {
  return planSlotIds(ex, planId);
}
