import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS, simulate } from '@sim/model';

const small = { ...DEFAULT_PARAMS, days: 6, arrivalsPerDay: 5 };

describe('simulator', () => {
  it('seed sama → hasil identik (reproducible)', () => {
    const a = simulate({ ...small, seed: 5, strategy: 'rujuksekali', ttlMin: 240 });
    const b = simulate({ ...small, seed: 5, strategy: 'rujuksekali', ttlMin: 240 });
    expect(b).toEqual(a);
  });

  it('metrik konsisten secara internal', () => {
    for (const strategy of ['baseline', 'rujuksekali'] as const) {
      const r = simulate({ ...small, seed: 9, strategy, ttlMin: 1440 });
      expect(r.completed + r.lost).toBeLessThanOrEqual(r.episodes);
      expect(r.cancellationRate).toBeGreaterThanOrEqual(0);
      expect(r.cancellationRate).toBeLessThanOrEqual(1);
      expect(r.wastedTotal).toBe(r.wastedLateCancel + r.wastedExpiredHold + r.wastedNoShow);
      if (strategy === 'baseline') expect(r.holdsCreated).toBe(0);
      else expect(r.holdsConfirmed + r.holdsExpired).toBeLessThanOrEqual(r.holdsCreated);
    }
  });

  it('TTL lebih panjang memblokir lebih banyak slot-jam', () => {
    const short = simulate({ ...small, seed: 3, strategy: 'rujuksekali', ttlMin: 15 });
    const long = simulate({ ...small, seed: 3, strategy: 'rujuksekali', ttlMin: 2880 });
    expect(long.blockedSlotHours).toBeGreaterThan(short.blockedSlotHours);
  });
});
