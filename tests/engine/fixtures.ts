import { hhmmToMin, localToUtc, minToHhmm, MINUTE, addDays } from '@/lib/time';
import type { PlanningInput, ServiceSpec, SlotSnapshot, TransportOption } from '@/engine';

export const LAB: ServiceSpec = {
  code: 'LAB_DARAH',
  name: 'Ambil darah (laboratorium)',
  durationMin: 15,
  fasting: true,
  latestStartLocal: '10:00',
  resultReadyMin: 180,
};
export const POLI: ServiceSpec = {
  code: 'POLI_PD',
  name: 'Konsultasi Poli Penyakit Dalam',
  durationMin: 20,
  fasting: false,
  latestStartLocal: null,
  resultReadyMin: 0,
};

export const D = '2026-11-03';
export const NOW = localToUtc(addDays(D, -1), '08:00');

export const BUS: TransportOption = {
  id: 'bus-pagi',
  mode: 'bus',
  label: 'Bus Pagi Kab. Contoh',
  departLocal: '05:00',
  arriveLocal: '07:00',
  returnDepartLocal: '16:00',
  returnArriveLocal: '18:00',
  fareIdr: 60_000,
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
};

export function slots(
  svc: ServiceSpec,
  date: string,
  from: string,
  to: string,
  opts: { skip?: (hhmm: string) => boolean; prefix?: string } = {},
): SlotSnapshot[] {
  const out: SlotSnapshot[] = [];
  for (let m = hhmmToMin(from); m + svc.durationMin <= hhmmToMin(to); m += svc.durationMin) {
    const hhmm = minToHhmm(m);
    if (opts.skip?.(hhmm)) continue;
    const startsAt = localToUtc(date, hhmm);
    out.push({
      id: `${opts.prefix ?? svc.code}-${date}-${hhmm}`,
      serviceCode: svc.code,
      startsAt,
      endsAt: startsAt + svc.durationMin * MINUTE,
      localDate: date,
    });
  }
  return out;
}

export function input(over: Partial<PlanningInput> = {}): PlanningInput {
  return {
    episodeId: 'ep-1',
    earliestDate: D,
    latestDate: addDays(D, 6),
    requiresEscort: false,
    urgent: false,
    services: [LAB, POLI],
    precedence: [{ before: 'LAB_DARAH', after: 'POLI_PD', minGapMin: 0 }],
    slots: [],
    escortWindows: [],
    transport: [BUS],
    holdCapReached: [],
    cost: {
      lodgingPerNightIdr: 250_000,
      lostIncomePerDayIdr: 150_000,
      includeLostIncome: true,
      maxLodgingNights: 2,
    },
    nowMs: NOW,
    holdTtlMin: 24 * 60,
    ...over,
  };
}
