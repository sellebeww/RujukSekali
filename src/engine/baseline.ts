// Baseline for comparison: the patient books each service on its own, earliest feasible slot first, without
// coordinating the services. A consultation that happens before the lab result is ready is wasted and repeated.
import { MINUTE } from '../lib/time';
import { planTrips } from './plan';
import type { PlanningInput, PlannedVisit } from './types';

export interface BaselineVisit extends PlannedVisit {
  /** Consultation took place before the needed result existed, so it had to be repeated. */
  wasted: boolean;
}

export interface BaselineResult {
  visits: BaselineVisit[];
  visitDays: number;
  costIdr: number;
  complete: boolean;
}

function bookOne(input: PlanningInput, code: string, notBefore: number | null, taken: Set<string>) {
  const svc = input.services.find((s) => s.code === code)!;
  const lead = input.minLeadMin ?? 120;
  const res = planTrips({
    ...input,
    services: [svc],
    precedence: [],
    slots: input.slots.filter((s) => s.serviceCode === code && !taken.has(s.id)),
    ...(notBefore !== null ? { nowMs: Math.max(input.nowMs, notBefore - lead * MINUTE) } : {}),
    maxPlans: 1,
    cost: { ...input.cost, maxLodgingNights: 0 },
  });
  const plan = res.plans[0];
  return plan ? { visit: plan.visits[0]!, fare: plan.cost.transportIdr } : null;
}

export function baselinePlan(input: PlanningInput): BaselineResult {
  const visits: BaselineVisit[] = [];
  const taken = new Set<string>();
  let transport = 0;
  const order = [...input.services].sort((a, b) => a.code.localeCompare(b.code)).map((s) => s.code);
  // Independent bookings: each service at its own earliest slot, ignoring the others.
  for (const code of order) {
    const b = bookOne(input, code, null, taken);
    if (!b) return { visits, visitDays: new Set(visits.map((v) => v.localDate)).size, costIdr: transport, complete: false };
    taken.add(b.visit.slotId);
    visits.push({ ...b.visit, wasted: false });
    transport += b.fare;
  }
  // Discover precedence too late: repeat any visit that happened before its prerequisite's result.
  for (const r of input.precedence) {
    const before = visits.find((v) => v.serviceCode === r.before && !v.wasted);
    const after = visits.find((v) => v.serviceCode === r.after && !v.wasted);
    if (!before || !after) continue;
    const ready = before.resultReadyAt + r.minGapMin * MINUTE;
    if (after.startsAt >= ready) continue;
    after.wasted = true;
    const again = bookOne(input, r.after, ready, taken);
    if (!again) return { visits, visitDays: new Set(visits.map((v) => v.localDate)).size, costIdr: transport, complete: false };
    taken.add(again.visit.slotId);
    visits.push({ ...again.visit, wasted: false });
    transport += again.fare;
  }
  const days = new Set(visits.map((v) => v.localDate));
  const travellers = input.requiresEscort ? 2 : 1;
  // Same-day visits share one trip; fares above were per booking, so normalise to one round trip per day.
  const perTrip = visits.length ? transport / visits.length : 0;
  const lost = input.cost.includeLostIncome ? days.size * input.cost.lostIncomePerDayIdr * travellers : 0;
  return { visits, visitDays: days.size, costIdr: Math.round(perTrip * days.size + lost), complete: true };
}
