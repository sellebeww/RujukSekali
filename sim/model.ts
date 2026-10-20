// Discrete-event simulation of one hospital, two services, out-of-town episodes and local background demand.
// Seeded and deterministic: the same parameters always produce the same numbers. Synthetic only.
import { policy } from '@/config/policy';
import { allowedHeld } from '@/domain/capacity';
import {
  baselinePlan,
  planTrips,
  type PlanningInput,
  type ServiceSpec,
  type SlotSnapshot,
  type TransportOption,
} from '@/engine';
import { createRng } from '@/lib/rng';
import { addDays, DAY, dayOfWeek, HOUR, hhmmToMin, localToUtc, MINUTE, toLocalDate } from '@/lib/time';
import { REGENCIES, SERVICE_TYPES, TRANSPORT } from '@seed/reference';

export type Strategy = 'baseline' | 'rujuksekali';

export interface SimParams {
  seed: number;
  startDate: string;
  /** Days over which episodes arrive. */
  days: number;
  arrivalsPerDay: number;
  backgroundPerDay: Record<string, number>;
  initialLoad: number;
  pDocsReady: number;
  docDelayMeanH: number;
  noShowRate: number;
  /** Chance a confirmed patient cancels for reasons outside the system (illness, work…), same for both strategies. */
  pCancelAfterConfirm: number;
  pEscortNeeded: number;
  pEscortDay: number;
  escortReplyMeanH: number;
  ttlMin: number;
  maxHoldRatio: number;
  strategy: Strategy;
}

export const DEFAULT_PARAMS: Omit<SimParams, 'seed' | 'strategy' | 'ttlMin'> = {
  startDate: '2026-11-02',
  days: 28,
  arrivalsPerDay: 10,
  backgroundPerDay: { LAB_DARAH: 38, POLI_PD: 28 },
  initialLoad: 0.45,
  pDocsReady: 0.5,
  docDelayMeanH: 30,
  noShowRate: 0.05,
  pCancelAfterConfirm: 0.04,
  pEscortNeeded: 0.3,
  pEscortDay: 0.6,
  escortReplyMeanH: 8,
  maxHoldRatio: 0.3,
};

export interface SimMetrics {
  strategy: Strategy;
  ttlMin: number;
  seed: number;
  episodes: number;
  completed: number;
  lost: number;
  tripsPerEpisode: number;
  avgCostIdr: number;
  confirmations: number;
  cancellationsAfterConfirm: number;
  cancellationRate: number;
  holdsCreated: number;
  holdsConfirmed: number;
  holdsExpired: number;
  holdToConfirm: number;
  avgHoldHours: number;
  blockedSlotHours: number;
  displaced: number;
  backgroundDenied: number;
  wastedLateCancel: number;
  wastedExpiredHold: number;
  wastedNoShow: number;
  wastedTotal: number;
}

type SlotState = 'available' | 'held' | 'booked';
interface SimSlot extends SlotSnapshot {
  status: SlotState;
  holdId: number | null;
  freed: 'expired' | 'late_cancel' | null;
}

interface Episode {
  id: number;
  arrival: number;
  earliest: string;
  latest: string;
  regency: string;
  escort: boolean;
  escortDays: string[];
  docsReadyAt: number;
  escortReadyAt: number;
  slots: string[];
  holdId: number | null;
  holdCreated: number;
  status: 'waiting' | 'held' | 'confirmed' | 'done' | 'lost' | 'noshow';
  attempts: number;
  visitDays: number;
  costIdr: number;
}

type Ev =
  | { t: number; seq: number; kind: 'arrival'; ep: Episode }
  | { t: number; seq: number; kind: 'plan'; ep: Episode }
  | { t: number; seq: number; kind: 'check'; ep: Episode; holdId: number }
  | { t: number; seq: number; kind: 'expire'; ep: Episode; holdId: number }
  | { t: number; seq: number; kind: 'baselineCheck'; ep: Episode }
  | { t: number; seq: number; kind: 'visit'; ep: Episode; slotId: string }
  | { t: number; seq: number; kind: 'patientCancel'; ep: Episode }
  | { t: number; seq: number; kind: 'background'; service: string; date: string };

type DistOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type EvInput = DistOmit<Ev, 'seq'>;

const SERVICES: ServiceSpec[] = SERVICE_TYPES.map((s) => ({
  code: s.code,
  name: s.name,
  durationMin: s.durationMin,
  fasting: s.fasting,
  latestStartLocal: s.latestStartLocal,
  resultReadyMin: s.resultReadyMin,
}));

export function simulate(p: SimParams): SimMetrics {
  const rng = createRng(p.seed);
  const horizon = p.days + 21;
  const slots = new Map<string, SimSlot>();
  const byDay = new Map<string, SimSlot[]>();
  for (const st of SERVICE_TYPES) {
    for (let d = 0; d < horizon; d++) {
      const date = addDays(p.startDate, d);
      if (!(st.open.days as readonly number[]).includes(dayOfWeek(date))) continue;
      const load = d < 7 ? p.initialLoad : p.initialLoad * 0.4;
      st.units.forEach((_, u) => {
        for (
          let m = hhmmToMin(st.open.from);
          m + st.durationMin <= hhmmToMin(st.open.to);
          m += st.durationMin
        ) {
          const startsAt = localToUtc(
            date,
            `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`,
          );
          const s: SimSlot = {
            id: `${st.code}-${date}-${u}-${m}`,
            serviceCode: st.code,
            startsAt,
            endsAt: startsAt + st.durationMin * MINUTE,
            localDate: date,
            status: rng.chance(load) ? 'booked' : 'available',
            holdId: null,
            freed: null,
          };
          slots.set(s.id, s);
          const k = `${st.code}|${date}`;
          (byDay.get(k) ?? byDay.set(k, []).get(k)!).push(s);
        }
      });
    }
  }

  const transport: (TransportOption & { originRegency: string })[] = TRANSPORT.map((t, i) => ({
    ...t,
    id: `t${i}`,
  }));
  const queue: Ev[] = [];
  let seq = 0;
  const push = (e: EvInput) => {
    const ev = { ...e, seq: seq++ } as Ev;
    let lo = 0;
    let hi = queue.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const q = queue[mid]!;
      if (q.t < ev.t || (q.t === ev.t && q.seq < ev.seq)) lo = mid + 1;
      else hi = mid;
    }
    queue.splice(lo, 0, ev);
  };

  const m: SimMetrics = {
    strategy: p.strategy,
    ttlMin: p.ttlMin,
    seed: p.seed,
    episodes: 0,
    completed: 0,
    lost: 0,
    tripsPerEpisode: 0,
    avgCostIdr: 0,
    confirmations: 0,
    cancellationsAfterConfirm: 0,
    cancellationRate: 0,
    holdsCreated: 0,
    holdsConfirmed: 0,
    holdsExpired: 0,
    holdToConfirm: 0,
    avgHoldHours: 0,
    blockedSlotHours: 0,
    displaced: 0,
    backgroundDenied: 0,
    wastedLateCancel: 0,
    wastedExpiredHold: 0,
    wastedNoShow: 0,
    wastedTotal: 0,
  };
  let holdHours = 0;
  let holdSeq = 0;
  let tripsSum = 0;
  let costSum = 0;
  const episodes: Episode[] = [];

  // Episode arrivals and local background demand.
  for (let d = 0; d < p.days; d++) {
    const date = addDays(p.startDate, d);
    const n = Math.round(p.arrivalsPerDay * (0.6 + rng.next() * 0.8));
    for (let i = 0; i < n; i++) {
      const t = localToUtc(date, '08:00') + rng.int(0, 8 * 60) * MINUTE;
      const r = rng.pick(REGENCIES);
      const earliest = addDays(date, rng.int(2, 4));
      const escort = rng.chance(p.pEscortNeeded);
      const ep: Episode = {
        id: episodes.length,
        arrival: t,
        earliest,
        latest: addDays(earliest, rng.int(7, 12)),
        regency: r.name,
        escort,
        escortDays: escort
          ? Array.from({ length: 16 }, (_, k) => addDays(earliest, k)).filter(() => rng.chance(p.pEscortDay))
          : [],
        docsReadyAt: rng.chance(p.pDocsReady) ? t : t + rng.exp(p.docDelayMeanH) * HOUR,
        escortReadyAt: escort ? t + rng.exp(p.escortReplyMeanH) * HOUR : t,
        slots: [],
        holdId: null,
        holdCreated: 0,
        status: 'waiting',
        attempts: 0,
        visitDays: 0,
        costIdr: 0,
      };
      episodes.push(ep);
      push({ t, kind: 'arrival', ep });
    }
  }
  for (let d = 0; d < horizon; d++) {
    const date = addDays(p.startDate, d);
    for (const [service, perDay] of Object.entries(p.backgroundPerDay)) {
      const n = Math.round(perDay * (0.7 + rng.next() * 0.6));
      for (let i = 0; i < n; i++) {
        const target = addDays(date, rng.int(1, 7));
        push({
          t: localToUtc(date, '07:00') + rng.int(0, 9 * 60) * MINUTE,
          kind: 'background',
          service,
          date: target,
        });
      }
    }
  }
  m.episodes = episodes.length;

  const heldOn = (service: string, date: string) =>
    (byDay.get(`${service}|${date}`) ?? []).filter((s) => s.status === 'held').length;
  const capReached = (from: string, to: string) => {
    const out: { serviceCode: string; localDate: string }[] = [];
    for (const [k, list] of byDay) {
      const [service, date] = k.split('|') as [string, string];
      if (date < from || date > to) continue;
      if (list.filter((s) => s.status === 'held').length >= allowedHeld(list.length, p.maxHoldRatio))
        out.push({ serviceCode: service, localDate: date });
    }
    return out;
  };

  const input = (ep: Episode, now: number): PlanningInput => {
    const to = addDays(ep.latest, 21);
    const avail: SlotSnapshot[] = [];
    for (const s of slots.values())
      if (s.status === 'available' && s.localDate >= ep.earliest && s.localDate <= to) avail.push(s);
    return {
      episodeId: String(ep.id),
      earliestDate: ep.earliest,
      latestDate: ep.latest,
      requiresEscort: ep.escort,
      urgent: false,
      services: SERVICES,
      precedence: [{ before: 'LAB_DARAH', after: 'POLI_PD', minGapMin: 0 }],
      slots: avail,
      escortWindows: ep.escortDays.map((localDate) => ({ localDate, fromLocal: '05:00', toLocal: '20:00' })),
      transport: transport.filter((t) => t.originRegency === ep.regency),
      holdCapReached: p.strategy === 'rujuksekali' ? capReached(ep.earliest, to) : [],
      cost: { ...policy.cost, includeLostIncome: true },
      nowMs: now,
      holdTtlMin: p.ttlMin,
      maxPlans: 1,
    };
  };

  const scheduleVisits = (ep: Episode) => {
    const first = Math.min(...ep.slots.map((id) => slots.get(id)!.startsAt));
    if (rng.chance(p.pCancelAfterConfirm)) {
      push({ t: first - rng.next() * 72 * HOUR, kind: 'patientCancel', ep });
      return;
    }
    for (const id of ep.slots) push({ t: slots.get(id)!.startsAt, kind: 'visit', ep, slotId: id });
  };
  const release = (ep: Episode, reason: 'expired' | 'late_cancel' | null) => {
    for (const id of ep.slots) {
      const s = slots.get(id)!;
      s.status = 'available';
      s.holdId = null;
      s.freed = reason;
    }
    ep.slots = [];
  };
  const confirm = (ep: Episode, now: number) => {
    for (const id of ep.slots) slots.get(id)!.status = 'booked';
    if (ep.holdId !== null) {
      m.holdsConfirmed++;
      holdHours += (now - ep.holdCreated) / HOUR;
      m.blockedSlotHours += ((now - ep.holdCreated) / HOUR) * ep.slots.length;
    }
    ep.holdId = null;
    ep.status = 'confirmed';
    m.confirmations++;
    scheduleVisits(ep);
  };
  const retryOrLose = (ep: Episode, now: number) => {
    if (++ep.attempts < 4) push({ t: now + DAY, kind: 'plan', ep });
    else {
      ep.status = 'lost';
      m.lost++;
    }
  };

  const planRS = (ep: Episode, now: number) => {
    if (toLocalDate(now) > ep.latest) return retryOrLose(ep, now);
    const res = planTrips(input(ep, now));
    const best = res.plans[0];
    if (!best) return retryOrLose(ep, now);
    ep.slots = best.visits.map((v) => v.slotId);
    ep.visitDays = best.visitDays;
    ep.costIdr = best.cost.totalIdr;
    for (const id of ep.slots) slots.get(id)!.freed = null;
    m.holdsCreated++;
    const ready = Math.max(ep.docsReadyAt, ep.escortReadyAt);
    if (ready <= now) {
      ep.holdId = ++holdSeq;
      ep.holdCreated = now;
      for (const id of ep.slots) slots.get(id)!.status = 'held';
      return confirm(ep, now);
    }
    const firstStart = Math.min(...best.visits.map((v) => v.startsAt));
    const expires = Math.min(now + p.ttlMin * MINUTE, firstStart - policy.planner.minLeadMin * MINUTE);
    ep.holdId = ++holdSeq;
    ep.holdCreated = now;
    ep.status = 'held';
    for (const id of ep.slots) {
      const s = slots.get(id)!;
      s.status = 'held';
      s.holdId = ep.holdId;
    }
    push({ t: expires, kind: 'expire', ep, holdId: ep.holdId });
    if (ready < expires) push({ t: ready, kind: 'check', ep, holdId: ep.holdId });
  };

  const planBaseline = (ep: Episode, now: number) => {
    if (toLocalDate(now) > ep.latest) return retryOrLose(ep, now);
    const b = baselinePlan(input(ep, now));
    if (!b.complete) {
      for (const v of b.visits) slots.get(v.slotId)!.status = 'available';
      return retryOrLose(ep, now);
    }
    ep.slots = b.visits.map((v) => v.slotId);
    ep.visitDays = b.visitDays;
    ep.costIdr = b.costIdr;
    for (const id of ep.slots) {
      const s = slots.get(id)!;
      s.status = 'booked';
      s.freed = null;
    }
    ep.status = 'confirmed';
    m.confirmations++;
    // The patient only discovers missing documents / an unavailable escort shortly before the first visit.
    const first = Math.min(...b.visits.map((v) => v.startsAt));
    push({ t: Math.max(now, first - 12 * HOUR), kind: 'baselineCheck', ep });
  };

  while (queue.length) {
    const e = queue.shift()!;
    switch (e.kind) {
      case 'arrival':
      case 'plan':
        if (e.ep.status === 'waiting') (p.strategy === 'rujuksekali' ? planRS : planBaseline)(e.ep, e.t);
        break;
      case 'check':
        if (e.ep.status === 'held' && e.ep.holdId === e.holdId) confirm(e.ep, e.t);
        break;
      case 'expire':
        if (e.ep.status === 'held' && e.ep.holdId === e.holdId) {
          m.holdsExpired++;
          holdHours += (e.t - e.ep.holdCreated) / HOUR;
          m.blockedSlotHours += ((e.t - e.ep.holdCreated) / HOUR) * e.ep.slots.length;
          release(e.ep, 'expired');
          e.ep.holdId = null;
          e.ep.status = 'waiting';
          // Replan once the dependencies are ready (then it confirms straight away).
          push({ t: Math.max(e.t, e.ep.docsReadyAt, e.ep.escortReadyAt), kind: 'plan', ep: e.ep });
        }
        break;
      case 'baselineCheck': {
        const ep = e.ep;
        if (ep.status !== 'confirmed') break;
        const ready = Math.max(ep.docsReadyAt, ep.escortReadyAt);
        if (ready > e.t) {
          m.cancellationsAfterConfirm++;
          release(ep, 'late_cancel');
          ep.status = 'waiting';
          push({ t: ready, kind: 'plan', ep });
        } else scheduleVisits(ep);
        break;
      }
      case 'patientCancel': {
        const ep = e.ep;
        if (ep.status !== 'confirmed') break;
        m.cancellationsAfterConfirm++;
        const first = Math.min(...ep.slots.map((id) => slots.get(id)!.startsAt));
        release(ep, first - e.t < policy.lateCancellationHours * HOUR ? 'late_cancel' : null);
        ep.status = 'waiting';
        push({ t: e.t, kind: 'plan', ep });
        break;
      }
      case 'visit': {
        const ep = e.ep;
        if (ep.status !== 'confirmed' || !ep.slots.includes(e.slotId)) break;
        if (rng.chance(p.noShowRate)) {
          m.wastedNoShow++;
          ep.status = 'noshow';
          break;
        }
        const last = Math.max(...ep.slots.map((id) => slots.get(id)!.startsAt));
        if (e.t === last) {
          ep.status = 'done';
          m.completed++;
          tripsSum += ep.visitDays;
          costSum += ep.costIdr;
        }
        break;
      }
      case 'background': {
        const list = (byDay.get(`${e.service}|${e.date}`) ?? []).filter(
          (s) => s.status === 'available' && s.startsAt > e.t + 2 * HOUR,
        );
        if (list.length === 0) {
          if ((byDay.get(`${e.service}|${e.date}`) ?? []).length === 0) break; // clinic closed that day
          m.backgroundDenied++;
          if (heldOn(e.service, e.date) > 0) m.displaced++;
          break;
        }
        const s = rng.pick(list);
        s.status = 'booked';
        s.freed = null;
        break;
      }
    }
  }

  // A slot is wasted when it was empty at service time because a hold expired or a booking was cancelled late.
  for (const s of slots.values()) {
    if (s.status !== 'available' || !s.freed) continue;
    if (s.freed === 'expired') m.wastedExpiredHold++;
    else m.wastedLateCancel++;
  }
  m.wastedTotal = m.wastedLateCancel + m.wastedExpiredHold + m.wastedNoShow;
  m.tripsPerEpisode = m.completed ? tripsSum / m.completed : 0;
  m.avgCostIdr = m.completed ? Math.round(costSum / m.completed) : 0;
  m.cancellationRate = m.confirmations ? m.cancellationsAfterConfirm / m.confirmations : 0;
  m.holdToConfirm = m.holdsCreated ? m.holdsConfirmed / m.holdsCreated : 0;
  m.avgHoldHours = m.holdsConfirmed + m.holdsExpired ? holdHours / (m.holdsConfirmed + m.holdsExpired) : 0;
  return m;
}
