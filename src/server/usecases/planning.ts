import { and, asc, eq, gte, inArray, lte, ne, sql } from 'drizzle-orm';
import { policy } from '@/config/policy';
import { allowedHeld } from '@/domain/capacity';
import { planTrips, type PlanningInput, type PlanningResult } from '@/engine';
import { addDays } from '@/lib/time';
import { audit } from '../audit';
import { requireRole, type Ctx } from '../context';
import type { Executor } from '../db/client';
import {
  dependency,
  episode,
  episodeService,
  escort,
  escortAvailability,
  patient,
  planVisit,
  serviceType,
  slot,
  transportOption,
  tripPlan,
} from '../db/schema';
import { DomainError, NotFoundError } from '../errors';
import { expireDueHolds } from './holds';

export async function loadEpisodeServices(ex: Executor, episodeId: string) {
  return ex
    .select({ st: serviceType })
    .from(episodeService)
    .innerJoin(serviceType, eq(serviceType.id, episodeService.serviceTypeId))
    .where(eq(episodeService.episodeId, episodeId))
    .orderBy(asc(serviceType.sortOrder))
    .then((r) => r.map((x) => x.st));
}

/** Service/day pairs whose share of held slots already reached the configured maximum. */
export async function holdCapDays(ex: Executor, serviceTypeIds: string[], from: string, to: string) {
  if (serviceTypeIds.length === 0) return [];
  const rows = await ex
    .select({
      serviceTypeId: slot.serviceTypeId,
      localDate: slot.localDate,
      held: sql<number>`count(*) filter (where ${slot.status} = 'held')`.mapWith(Number),
      total: sql<number>`count(*) filter (where ${slot.status} <> 'blocked')`.mapWith(Number),
      ratio: sql<number>`max(${serviceType.maxHoldRatio})`.mapWith(Number),
    })
    .from(slot)
    .innerJoin(serviceType, eq(serviceType.id, slot.serviceTypeId))
    .where(
      and(inArray(slot.serviceTypeId, serviceTypeIds), gte(slot.localDate, from), lte(slot.localDate, to)),
    )
    .groupBy(slot.serviceTypeId, slot.localDate);
  return rows.filter((r) => r.held >= allowedHeld(r.total, r.ratio));
}

export { allowedHeld } from '@/domain/capacity';

export async function buildPlanningInput(
  ex: Executor,
  episodeId: string,
  nowMs: number,
): Promise<PlanningInput> {
  const [row] = await ex
    .select({ ep: episode, pt: patient })
    .from(episode)
    .innerJoin(patient, eq(patient.id, episode.patientId))
    .where(eq(episode.id, episodeId));
  if (!row) throw new NotFoundError('Episode');
  const { ep, pt } = row;

  const services = await loadEpisodeServices(ex, episodeId);
  const codeById = new Map(services.map((s) => [s.id, s.code]));
  const deps = await ex.select().from(dependency).where(eq(dependency.episodeId, episodeId));
  // Slots up to 3 weeks past the window so the planner can name the nearest option outside it.
  const horizon = addDays(ep.latestDate, 21);
  const slots = await ex
    .select({
      id: slot.id,
      serviceTypeId: slot.serviceTypeId,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      localDate: slot.localDate,
    })
    .from(slot)
    .where(
      and(
        inArray(
          slot.serviceTypeId,
          services.map((s) => s.id),
        ),
        eq(slot.status, 'available'),
        gte(slot.localDate, ep.earliestDate),
        lte(slot.localDate, horizon),
      ),
    );
  const escorts = await ex
    .select({ a: escortAvailability })
    .from(escortAvailability)
    .innerJoin(escort, eq(escort.id, escortAvailability.escortId))
    .where(and(eq(escort.patientId, pt.id), ne(escortAvailability.status, 'cancelled')));
  const transport = await ex
    .select()
    .from(transportOption)
    .where(eq(transportOption.originRegency, pt.originRegency));
  const caps = await holdCapDays(
    ex,
    services.map((s) => s.id),
    ep.earliestDate,
    horizon,
  );

  return {
    episodeId,
    earliestDate: ep.earliestDate,
    latestDate: ep.latestDate,
    ...(ep.desiredDate ? { desiredDate: ep.desiredDate } : {}),
    requiresEscort: ep.requiresEscort,
    urgent: ep.urgent,
    services: services.map((s) => ({
      code: s.code,
      name: s.name,
      durationMin: s.durationMin,
      fasting: s.fasting,
      latestStartLocal: s.latestStartLocal,
      resultReadyMin: s.resultReadyMin,
      ...(s.prepNote ? { prepNote: s.prepNote } : {}),
    })),
    precedence: deps
      .filter((d) => d.type === 'PRECEDENCE' && d.fromServiceTypeId && d.toServiceTypeId)
      .map((d) => ({
        before: codeById.get(d.fromServiceTypeId!)!,
        after: codeById.get(d.toServiceTypeId!)!,
        minGapMin: d.minGapMin ?? 0,
      }))
      .filter((r) => r.before && r.after),
    slots: slots.map((s) => ({
      id: s.id,
      serviceCode: codeById.get(s.serviceTypeId)!,
      startsAt: s.startsAt.getTime(),
      endsAt: s.endsAt.getTime(),
      localDate: s.localDate,
    })),
    escortWindows: escorts.map(({ a }) => ({
      localDate: a.localDate,
      fromLocal: a.fromLocal,
      toLocal: a.toLocal,
    })),
    transport: transport.map((t) => ({
      id: t.id,
      mode: t.mode,
      label: t.label,
      departLocal: t.departLocal,
      arriveLocal: t.arriveLocal,
      returnDepartLocal: t.returnDepartLocal,
      returnArriveLocal: t.returnArriveLocal,
      fareIdr: t.fareIdr,
      daysOfWeek: t.daysOfWeek,
    })),
    holdCapReached: caps.map((c) => ({
      serviceCode: codeById.get(c.serviceTypeId)!,
      localDate: c.localDate,
    })),
    cost: { ...policy.cost, includeLostIncome: ep.includeLostIncome },
    nowMs,
    holdTtlMin: Math.min(...services.map((s) => s.holdTtlMinutes[ep.holdTier])),
    arrivalBufferMin: policy.planner.arrivalBufferMin,
    departureBufferMin: policy.planner.departureBufferMin,
    minLeadMin: policy.planner.minLeadMin,
    maxSpanDays: policy.planner.maxSpanDays,
  };
}

export interface ProposalOutcome {
  status: PlanningResult['status'];
  planIds: string[];
  notes: string[];
  rejections: { code: string; message: string }[];
}

/** Runs the planner for an episode and stores up to 3 PROPOSED options (replacing older unheld options). */
export async function proposePlans(ctx: Ctx, episodeId: string): Promise<ProposalOutcome> {
  requireRole(ctx, 'coordinator');
  await expireDueHolds(ctx);
  const now = ctx.clock.now();
  return ctx.db.transaction(async (tx) => {
    const [ep] = await tx.select().from(episode).where(eq(episode.id, episodeId)).for('update');
    if (!ep) throw new NotFoundError('Episode');
    if (ep.closedAt) throw new DomainError('EPISODE_CLOSED', 'Episode sudah ditutup.');

    const plans = await tx.select().from(tripPlan).where(eq(tripPlan.episodeId, episodeId));
    if (plans.some((p) => p.status === 'HELD' || p.status === 'CONFIRMED')) {
      throw new DomainError(
        'ACTIVE_PLAN',
        'Episode sudah punya jadwal yang ditahan atau terkonfirmasi. Lepas dulu sebelum menyusun ulang.',
      );
    }
    for (const p of plans.filter((p) => p.status === 'DRAFT' || p.status === 'PROPOSED')) {
      await tx
        .update(tripPlan)
        .set({
          status: 'RELEASED',
          statusReason: 'Diganti opsi baru',
          updatedAt: new Date(now),
          endedAt: new Date(now),
        })
        .where(eq(tripPlan.id, p.id));
      await audit(tx, ctx, {
        entity: 'trip_plan',
        entityId: p.id,
        action: 'superseded',
        from: p.status,
        to: 'RELEASED',
      });
    }

    const input = await buildPlanningInput(tx, episodeId, now);
    const result = planTrips(input);
    const services = await loadEpisodeServices(tx, episodeId);
    const idByCode = new Map(services.map((s) => [s.code, s.id]));

    const planIds: string[] = [];
    for (const [i, c] of result.plans.entries()) {
      const [row] = await tx
        .insert(tripPlan)
        .values({
          episodeId,
          status: 'PROPOSED',
          rank: i + 1,
          summary: c.summary,
          detail: c,
          visitDays: c.visitDays,
          costIdr: c.cost.totalIdr,
          createdAt: new Date(now),
          updatedAt: new Date(now),
        })
        .returning({ id: tripPlan.id });
      planIds.push(row!.id);
      await tx.insert(planVisit).values(
        c.visits.map((v) => ({
          tripPlanId: row!.id,
          slotId: v.slotId,
          serviceTypeId: idByCode.get(v.serviceCode)!,
          startsAt: new Date(v.startsAt),
          endsAt: new Date(v.endsAt),
          localDate: v.localDate,
        })),
      );
      await audit(tx, ctx, {
        entity: 'trip_plan',
        entityId: row!.id,
        action: 'proposed',
        from: 'DRAFT',
        to: 'PROPOSED',
        data: { rank: i + 1, visitDays: c.visitDays },
      });
    }
    const rejections = result.rejections.map((r) => ({ code: r.code, message: r.message }));
    await tx
      .update(episode)
      .set({
        planning: { at: new Date(now).toISOString(), status: result.status, notes: result.notes, rejections },
      })
      .where(eq(episode.id, episodeId));
    await audit(tx, ctx, {
      entity: 'episode',
      entityId: episodeId,
      action: 'planned',
      data: { status: result.status, options: planIds.length, nodes: result.nodesExplored },
    });
    return { status: result.status, planIds, notes: result.notes, rejections };
  });
}
