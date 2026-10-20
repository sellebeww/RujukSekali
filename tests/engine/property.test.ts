import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  compareScore,
  hardConstraintViolations,
  planTrips,
  type PlanningInput,
  type SlotSnapshot,
} from '@/engine';
import { addDays, localToUtc, minToHhmm, MINUTE } from '@/lib/time';
import { D, LAB, NOW, POLI, input } from './fixtures';

const hhmm = (lo: number, hi: number) => fc.integer({ min: lo, max: hi }).map((m) => minToHhmm(m * 5));

const arbInput: fc.Arbitrary<PlanningInput> = fc
  .record({
    nDays: fc.integer({ min: 1, max: 5 }),
    labMask: fc.array(fc.boolean(), { minLength: 5 * 16, maxLength: 5 * 16 }),
    poliMask: fc.array(fc.boolean(), { minLength: 5 * 21, maxLength: 5 * 21 }),
    fasting: fc.boolean(),
    latestStart: hhmm(96, 132),
    resultReady: fc.integer({ min: 0, max: 300 }),
    gap: fc.integer({ min: 0, max: 60 }),
    escort: fc.boolean(),
    escortDays: fc.array(fc.tuple(fc.integer({ min: 0, max: 4 }), hhmm(72, 120), hhmm(144, 216)), {
      maxLength: 5,
    }),
    transports: fc.array(
      fc.record({
        arrive: hhmm(66, 132),
        ret: hhmm(144, 228),
        fare: fc.integer({ min: 10, max: 500 }).map((x) => x * 1000),
        dows: fc.subarray([0, 1, 2, 3, 4, 5, 6], { minLength: 1 }),
      }),
      { minLength: 1, maxLength: 3 },
    ),
    lodgingNights: fc.integer({ min: 0, max: 3 }),
    capDay: fc.option(fc.integer({ min: 0, max: 4 }), { nil: undefined }),
    lead: fc.integer({ min: 0, max: 48 * 60 }),
  })
  .map((r) => {
    const s: SlotSnapshot[] = [];
    for (let d = 0; d < r.nDays; d++) {
      const date = addDays(D, d);
      for (let i = 0; i < 16; i++) {
        if (!r.labMask[d * 16 + i]) continue;
        const t = localToUtc(date, minToHhmm(7 * 60 + i * 15));
        s.push({
          id: `L${d}-${i}`,
          serviceCode: LAB.code,
          startsAt: t,
          endsAt: t + 15 * MINUTE,
          localDate: date,
        });
      }
      for (let i = 0; i < 21; i++) {
        if (!r.poliMask[d * 21 + i]) continue;
        const t = localToUtc(date, minToHhmm(8 * 60 + i * 20));
        s.push({
          id: `P${d}-${i}`,
          serviceCode: POLI.code,
          startsAt: t,
          endsAt: t + 20 * MINUTE,
          localDate: date,
        });
      }
    }
    return input({
      latestDate: addDays(D, r.nDays - 1),
      services: [
        { ...LAB, fasting: r.fasting, latestStartLocal: r.latestStart, resultReadyMin: r.resultReady },
        POLI,
      ],
      precedence: [{ before: LAB.code, after: POLI.code, minGapMin: r.gap }],
      slots: s,
      requiresEscort: r.escort,
      escortWindows: r.escortDays.map(([d, from, to]) => ({
        localDate: addDays(D, d),
        fromLocal: from,
        toLocal: to,
      })),
      transport: r.transports.map((t, i) => ({
        id: `t${i}`,
        mode: 'bus',
        label: `Bus ${i}`,
        departLocal: '05:00',
        arriveLocal: t.arrive,
        returnDepartLocal: t.ret,
        returnArriveLocal: '23:00',
        fareIdr: t.fare,
        daysOfWeek: t.dows,
      })),
      holdCapReached:
        r.capDay === undefined ? [] : [{ serviceCode: POLI.code, localDate: addDays(D, r.capDay) }],
      cost: {
        lodgingPerNightIdr: 250_000,
        lostIncomePerDayIdr: 150_000,
        includeLostIncome: true,
        maxLodgingNights: r.lodgingNights,
      },
      nowMs: NOW + r.lead * MINUTE,
    });
  });

describe('Property: rencana tidak pernah melanggar constraint keras', () => {
  it('setiap rencana lolos validator independen', () => {
    fc.assert(
      fc.property(arbInput, (inp) => {
        const res = planTrips(inp);
        for (const p of res.plans) expect(hardConstraintViolations(inp, p)).toEqual([]);
      }),
      { numRuns: 400, seed: 20261020 },
    );
  });

  it('terurut, maksimal 3, deterministik, dan alasan selalu ada bila gagal', () => {
    fc.assert(
      fc.property(arbInput, (inp) => {
        const a = planTrips(inp);
        const b = planTrips(structuredClone(inp));
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
        expect(a.plans.length).toBeLessThanOrEqual(3);
        for (let i = 1; i < a.plans.length; i++)
          expect(compareScore(a.plans[i - 1]!, a.plans[i]!)).toBeLessThanOrEqual(0);
        if (a.plans.length === 0) expect(a.rejections.length).toBeGreaterThan(0);
        else expect(a.status).toBe('ok');
      }),
      { numRuns: 200, seed: 7 },
    );
  });

  it('urutan slot pada input tidak mengubah hasil', () => {
    fc.assert(
      fc.property(arbInput, (inp) => {
        const reversed = { ...inp, slots: [...inp.slots].reverse() };
        expect(JSON.stringify(planTrips(reversed).plans)).toBe(JSON.stringify(planTrips(inp).plans));
      }),
      { numRuns: 100, seed: 11 },
    );
  });
});
