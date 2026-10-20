import 'server-only';
import { and, eq, gt, inArray, isNotNull, lt, sql } from 'drizzle-orm';
import { policy } from '@/config/policy';
import type { Db } from './db/client';
import { auditLog, capacityDenial, hold, planVisit, slot, tripPlan } from './db/schema';

/** Operational metrics computed from the database. Exact definitions: docs/METRIK.md. */
export async function operationalMetrics(db: Db, nowMs: number) {
  const now = new Date(nowMs);
  const completed = await db
    .select({ visitDays: tripPlan.visitDays })
    .from(tripPlan)
    .where(eq(tripPlan.status, 'COMPLETED'));
  const everConfirmed = await db
    .select({ id: auditLog.entityId })
    .from(auditLog)
    .where(and(eq(auditLog.entity, 'trip_plan'), eq(auditLog.action, 'confirm')));
  const cancelled = await db
    .select({ data: auditLog.data })
    .from(auditLog)
    .where(and(eq(auditLog.entity, 'trip_plan'), eq(auditLog.action, 'cancel')));
  const holds = await db
    .select()
    .from(hold)
    .where(inArray(hold.status, ['active', 'released', 'expired', 'converted']));
  const slotsPerHold = await db
    .select({ planId: planVisit.tripPlanId, n: sql<number>`count(*)`.mapWith(Number) })
    .from(planVisit)
    .groupBy(planVisit.tripPlanId);
  const nByPlan = new Map(slotsPerHold.map((r) => [r.planId, r.n]));
  const ended = holds.filter((h) => h.endedAt);
  const holdHours = ended.map((h) => (h.endedAt!.getTime() - h.createdAt.getTime()) / 3_600_000);
  const blockedSlotHours = holds.reduce((sum, h) => {
    const end = h.endedAt ?? (h.status === 'active' ? now : h.createdAt);
    return sum + ((end.getTime() - h.createdAt.getTime()) / 3_600_000) * (nByPlan.get(h.tripPlanId) ?? 0);
  }, 0);
  const [displacement] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(capacityDenial)
    .where(gt(capacityDenial.heldSlotsThatDay, 0));
  // Wasted: a past slot that is empty at service time after one of our holds expired or a booking was cancelled.
  const [wasted] = await db
    .select({ n: sql<number>`count(distinct ${slot.id})`.mapWith(Number) })
    .from(slot)
    .innerJoin(planVisit, eq(planVisit.slotId, slot.id))
    .innerJoin(tripPlan, eq(tripPlan.id, planVisit.tripPlanId))
    .where(
      and(
        eq(slot.status, 'available'),
        lt(slot.startsAt, now),
        inArray(tripPlan.status, ['EXPIRED', 'CANCELLED']),
      ),
    );
  const costs = await db
    .select({ cost: tripPlan.costIdr })
    .from(tripPlan)
    .where(inArray(tripPlan.status, ['CONFIRMED', 'COMPLETED']));
  const lateCancels = cancelled.filter((c) => (c.data as { late?: boolean } | null)?.late).length;
  const confirmedHolds = holds.filter((h) => h.status === 'converted').length;
  const finishedHolds = holds.filter((h) => h.status !== 'active').length;
  const active = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(hold)
    .where(eq(hold.status, 'active'));
  const pendingVerification = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(tripPlan)
    .where(and(eq(tripPlan.status, 'HELD'), isNotNull(tripPlan.approvedAt)));

  return {
    tripsPerEpisode: completed.length
      ? completed.reduce((s, c) => s + c.visitDays, 0) / completed.length
      : null,
    completedEpisodes: completed.length,
    confirmations: new Set(everConfirmed.map((c) => c.id)).size,
    cancellations: cancelled.length,
    lateCancellations: lateCancels,
    cancellationRate: everConfirmed.length
      ? cancelled.length / new Set(everConfirmed.map((c) => c.id)).size
      : null,
    wastedSlots: wasted?.n ?? 0,
    holdsCreated: holds.length,
    holdsActive: active[0]?.n ?? 0,
    holdToConfirm: finishedHolds ? confirmedHolds / finishedHolds : null,
    avgHoldHours: holdHours.length ? holdHours.reduce((a, b) => a + b, 0) / holdHours.length : null,
    blockedSlotHours,
    displacement: displacement?.n ?? 0,
    avgPatientCostIdr: costs.length ? costs.reduce((s, c) => s + c.cost, 0) / costs.length : null,
    approvedAwaitingDependencies: pendingVerification[0]?.n ?? 0,
    lateCancellationHours: policy.lateCancellationHours,
  };
}

export type OperationalMetrics = Awaited<ReturnType<typeof operationalMetrics>>;

export function metricsCsv(m: OperationalMetrics): string {
  const rows = Object.entries(m).map(
    ([k, v]) => `${k},${v === null ? '' : typeof v === 'number' ? +v.toFixed(4) : v}`,
  );
  return ['metric,value', ...rows].join('\n') + '\n';
}
