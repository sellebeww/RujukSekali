// Before/after example for the company profile, computed with the real planner and baseline on synthetic slots.
import { baselinePlan, planTrips, type PlanningInput, type SlotSnapshot } from '@/engine';
import { createRng } from '@/lib/rng';
import { addDays, dayOfWeek, formatLocalTime, hhmmToMin, localToUtc, minToHhmm, MINUTE } from '@/lib/time';
import { SERVICE_TYPES, TRANSPORT } from '@seed/reference';
import { policy } from '@/config/policy';

const START = '2026-11-02';

function inputFor(seed: number): PlanningInput {
  const rng = createRng(seed);
  const slots: SlotSnapshot[] = [];
  for (const st of SERVICE_TYPES) {
    for (let d = 0; d < 10; d++) {
      const date = addDays(START, d);
      if (!(st.open.days as readonly number[]).includes(dayOfWeek(date))) continue;
      const load = 0.55 + rng.next() * 0.35;
      for (
        let m = hhmmToMin(st.open.from);
        m + st.durationMin <= hhmmToMin(st.open.to);
        m += st.durationMin
      ) {
        if (rng.chance(load)) continue;
        const startsAt = localToUtc(date, minToHhmm(m));
        slots.push({
          id: `${st.code}-${date}-${m}`,
          serviceCode: st.code,
          startsAt,
          endsAt: startsAt + st.durationMin * MINUTE,
          localDate: date,
        });
      }
    }
  }
  return {
    episodeId: 'contoh',
    earliestDate: addDays(START, 1),
    latestDate: addDays(START, 9),
    requiresEscort: false,
    urgent: false,
    services: SERVICE_TYPES.map((s) => ({
      code: s.code,
      name: s.shortName,
      durationMin: s.durationMin,
      fasting: s.fasting,
      latestStartLocal: s.latestStartLocal,
      resultReadyMin: s.resultReadyMin,
    })),
    precedence: [{ before: 'LAB_DARAH', after: 'POLI_PD', minGapMin: 0 }],
    slots,
    escortWindows: [],
    transport: TRANSPORT.filter((t) => t.originRegency === 'Kab. Sukamaju').map((t, i) => ({
      ...t,
      id: `t${i}`,
    })),
    holdCapReached: [],
    cost: { ...policy.cost, includeLostIncome: true },
    nowMs: localToUtc(START, '08:00'),
    holdTtlMin: 1440,
    maxPlans: 1,
  };
}

export interface JourneyDay {
  date: string;
  visits: { time: string; label: string; wasted: boolean }[];
}

/** First seed (deterministic) whose synthetic schedule shows the typical problem: independent booking needs repeat trips. */
function build() {
  for (let seed = 1; seed < 200; seed++) {
    const inp = inputFor(seed);
    const plan = planTrips(inp).plans[0];
    const base = baselinePlan(inp);
    if (!plan || !base.complete || plan.visitDays !== 1 || base.visitDays < 3) continue;
    const toDays = (
      visits: { localDate: string; startsAt: number; serviceName: string; wasted?: boolean }[],
    ) => {
      const days = [...new Set(visits.map((v) => v.localDate))].sort();
      return days.map((date) => ({
        date,
        visits: visits
          .filter((v) => v.localDate === date)
          .sort((a, b) => a.startsAt - b.startsAt)
          .map((v) => ({ time: formatLocalTime(v.startsAt), label: v.serviceName, wasted: !!v.wasted })),
      }));
    };
    return {
      seed,
      windowStart: inp.earliestDate,
      windowDays: 9,
      before: { days: toDays(base.visits), costIdr: base.costIdr },
      after: { days: toDays(plan.visits), costIdr: plan.cost.totalIdr, summary: plan.summary },
    };
  }
  throw new Error('No illustrative sample found');
}

export const sampleJourney = build();
