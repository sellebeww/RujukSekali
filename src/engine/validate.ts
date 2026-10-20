// Independent checker for hard constraints. Deliberately does not reuse planner internals,
// so property tests catch planner bugs instead of mirroring them.
import { dayOfWeek, daysBetween, hhmmToMin, localMinuteOfDay, localToUtc, MINUTE } from '../lib/time';
import type { CandidatePlan, PlanningInput } from './types';

export function hardConstraintViolations(input: PlanningInput, plan: CandidatePlan): string[] {
  const v: string[] = [];
  const arr = input.arrivalBufferMin ?? 30;
  const dep = input.departureBufferMin ?? 30;
  const lead = input.minLeadMin ?? 120;
  const slotById = new Map(input.slots.map((s) => [s.id, s]));
  const svcByCode = new Map(input.services.map((s) => [s.code, s]));
  const capped = new Set(input.holdCapReached.map((h) => `${h.serviceCode}|${h.localDate}`));

  const codes = plan.visits.map((x) => x.serviceCode).sort();
  const wanted = input.services.map((s) => s.code).sort();
  if (codes.join() !== wanted.join()) v.push(`services mismatch: ${codes} vs ${wanted}`);
  if (new Set(plan.visits.map((x) => x.slotId)).size !== plan.visits.length) v.push('slot used twice');

  for (const visit of plan.visits) {
    const slot = slotById.get(visit.slotId);
    const svc = svcByCode.get(visit.serviceCode);
    if (!slot || !svc) {
      v.push(`unknown slot/service ${visit.slotId}`);
      continue;
    }
    if (slot.serviceCode !== visit.serviceCode) v.push(`slot ${slot.id} is for ${slot.serviceCode}`);
    if (slot.startsAt !== visit.startsAt || slot.endsAt !== visit.endsAt)
      v.push(`visit times differ from slot ${slot.id}`);
    if (slot.localDate < input.earliestDate || slot.localDate > input.latestDate)
      v.push(`slot ${slot.id} outside window`);
    if (slot.startsAt < input.nowMs + lead * MINUTE) v.push(`slot ${slot.id} too soon`);
    if (
      svc.fasting &&
      svc.latestStartLocal &&
      localMinuteOfDay(slot.startsAt) > hhmmToMin(svc.latestStartLocal)
    ) {
      v.push(`fasting slot ${slot.id} too late`);
    }
    if (capped.has(`${slot.serviceCode}|${slot.localDate}`)) v.push(`slot ${slot.id} on hold-capped day`);
    if (input.requiresEscort) {
      const s = localMinuteOfDay(slot.startsAt);
      const e = s + (slot.endsAt - slot.startsAt) / MINUTE;
      const ok = input.escortWindows.some(
        (w) => w.localDate === slot.localDate && hhmmToMin(w.fromLocal) <= s && e <= hhmmToMin(w.toLocal),
      );
      if (!ok) v.push(`no escort for slot ${slot.id}`);
    }
  }

  for (const r of input.precedence) {
    const a = plan.visits.find((x) => x.serviceCode === r.before);
    const b = plan.visits.find((x) => x.serviceCode === r.after);
    const svc = svcByCode.get(r.before);
    if (!a || !b || !svc) continue;
    if (b.startsAt < a.endsAt + (svc.resultReadyMin + r.minGapMin) * MINUTE)
      v.push(`precedence ${r.before}→${r.after} violated`);
  }

  const sorted = [...plan.visits].sort((a, b) => a.startsAt - b.startsAt);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.startsAt < sorted[i - 1]!.endsAt) v.push('visits overlap');
  }

  const transport = new Map(input.transport.map((t) => [t.id, t]));
  const covered = new Set<string>();
  for (const trip of plan.trips) {
    const t = transport.get(trip.transportId);
    if (!t) {
      v.push(`unknown transport ${trip.transportId}`);
      continue;
    }
    if (
      !t.daysOfWeek.includes(dayOfWeek(trip.startDate)) ||
      !t.daysOfWeek.includes(dayOfWeek(trip.endDate))
    ) {
      v.push(`transport ${t.id} not running`);
    }
    const nights = daysBetween(trip.startDate, trip.endDate);
    if (nights !== trip.lodgingNights || nights < 0 || nights > input.cost.maxLodgingNights)
      v.push('bad lodging nights');
    const inTrip = plan.visits.filter((x) => x.localDate >= trip.startDate && x.localDate <= trip.endDate);
    if (inTrip.length === 0) v.push('empty trip');
    for (const x of inTrip) covered.add(x.slotId);
    const firstDay = inTrip.filter((x) => x.localDate === trip.startDate);
    const lastDay = inTrip.filter((x) => x.localDate === trip.endDate);
    if (firstDay.length === 0 || lastDay.length === 0) v.push('trip does not start/end on a visit day');
    const arrive = localToUtc(trip.startDate, t.arriveLocal) + arr * MINUTE;
    if (firstDay.some((x) => x.startsAt < arrive)) v.push('visit before patient can arrive');
    const leave = localToUtc(trip.endDate, t.returnDepartLocal) - dep * MINUTE;
    if (lastDay.some((x) => x.endsAt > leave)) v.push('visit ends after return departure');
  }
  if (covered.size !== plan.visits.length) v.push('visit not covered by exactly one trip');
  return v;
}
