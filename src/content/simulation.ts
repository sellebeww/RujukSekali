// Simulation results are read from the committed output of `npm run sim` — never typed by hand.
import summary from '../../sim/out/summary.json';

export interface SimRow {
  ttlMin: number;
  tripsPerEpisode: number;
  cancellationRate: number;
  wastedTotal: number;
  wastedLateCancel: number;
  wastedExpiredHold: number;
  wastedNoShow: number;
  holdToConfirm: number;
  holdToConfirmSd: number;
  blockedSlotHours: number;
  blockedSlotHoursSd: number;
  displaced: number;
  displacedSd: number;
  avgCostIdr: number;
  avgHoldHours: number;
  completed: number;
  lost: number;
  episodes: number;
  [k: string]: number | string;
}

export const simulation = summary as unknown as {
  label: string;
  seeds: number[];
  params: Record<string, unknown>;
  defaultTtlMin: number;
  baseline: SimRow;
  coordinated: SimRow;
  ttl: SimRow[];
};

export const ttlLabel = (min: number) => (min < 60 ? `${min} mnt` : `${min / 60} jam`);

export function headline() {
  const b = simulation.baseline;
  const c = simulation.coordinated;
  const pct = (x: number, y: number) => Math.round((1 - y / x) * 100);
  return {
    trips: {
      baseline: b.tripsPerEpisode,
      coordinated: c.tripsPerEpisode,
      reductionPct: pct(b.tripsPerEpisode, c.tripsPerEpisode),
    },
    cancel: { baseline: b.cancellationRate, coordinated: c.cancellationRate },
    wasted: {
      baseline: b.wastedTotal,
      coordinated: c.wastedTotal,
      reductionPct: pct(b.wastedTotal, c.wastedTotal),
    },
    cost: {
      baseline: b.avgCostIdr,
      coordinated: c.avgCostIdr,
      reductionPct: pct(b.avgCostIdr, c.avgCostIdr),
    },
  };
}
