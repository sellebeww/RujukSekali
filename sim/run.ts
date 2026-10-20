// Runs baseline vs coordinated planning and the hold-TTL experiment; writes CSV + JSON to sim/out/.
import { mkdirSync, writeFileSync } from 'node:fs';
import { DEFAULT_PARAMS, simulate, type SimMetrics } from './model';

const SEEDS = [11, 23, 37, 41, 59];
const TTLS = [15, 60, 240, 1440, 2880];
const DEFAULT_TTL = 1440;

const runs: SimMetrics[] = [];
const t0 = Date.now();
for (const seed of SEEDS) {
  runs.push(simulate({ ...DEFAULT_PARAMS, seed, strategy: 'baseline', ttlMin: 0 }));
  for (const ttlMin of TTLS) runs.push(simulate({ ...DEFAULT_PARAMS, seed, strategy: 'rujuksekali', ttlMin }));
}

const keys = Object.keys(runs[0]!) as (keyof SimMetrics)[];
const csv = (rows: Record<string, unknown>[]) =>
  [Object.keys(rows[0]!).join(','), ...rows.map((r) => Object.values(r).map((v) => (typeof v === 'number' ? +v.toFixed(4) : v)).join(','))].join('\n') + '\n';

function mean(rows: SimMetrics[]) {
  const out: Record<string, number | string> = { strategy: rows[0]!.strategy, ttlMin: rows[0]!.ttlMin, runs: rows.length };
  for (const k of keys) {
    if (k === 'strategy' || k === 'ttlMin' || k === 'seed') continue;
    const vals = rows.map((r) => r[k] as number);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce((a, b) => a + (b - avg) ** 2, 0) / Math.max(1, vals.length - 1));
    out[k] = avg;
    out[`${k}Sd`] = sd;
  }
  return out;
}

const baseline = mean(runs.filter((r) => r.strategy === 'baseline'));
const byTtl = TTLS.map((ttl) => mean(runs.filter((r) => r.strategy === 'rujuksekali' && r.ttlMin === ttl)));
const coordinated = byTtl[TTLS.indexOf(DEFAULT_TTL)]!;

mkdirSync('sim/out', { recursive: true });
writeFileSync('sim/out/runs.csv', csv(runs as unknown as Record<string, unknown>[]));
writeFileSync('sim/out/ttl-experiment.csv', csv(byTtl));
writeFileSync('sim/out/baseline-comparison.csv', csv([baseline, coordinated]));
writeFileSync(
  'sim/out/summary.json',
  JSON.stringify(
    {
      label: 'Simulasi data sintetis, bukan hasil lapangan',
      generatedBy: 'npm run sim',
      seeds: SEEDS,
      params: DEFAULT_PARAMS,
      defaultTtlMin: DEFAULT_TTL,
      baseline,
      coordinated,
      ttl: byTtl,
    },
    null,
    2,
  ) + '\n',
);
console.log(`Simulated ${runs.length} runs in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
const pick = (r: Record<string, number | string>) =>
  ['tripsPerEpisode', 'cancellationRate', 'wastedTotal', 'holdToConfirm', 'displaced', 'blockedSlotHours', 'avgCostIdr', 'lost', 'completed'].map(
    (k) => `${k}=${typeof r[k] === 'number' ? (r[k] as number).toFixed(2) : r[k]}`,
  );
console.log('baseline     ', pick(baseline).join(' '));
for (const r of byTtl) console.log(`TTL ${String(r.ttlMin).padStart(4)} min`, pick(r).join(' '));
