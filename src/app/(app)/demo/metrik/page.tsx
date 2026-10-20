import { links } from '@/config/links';
import { MetricsView } from '@/features/shared/MetricsView';
import { SYSTEM_ACTOR, makeCtx } from '@/server/context';
import { operationalMetrics } from '@/server/metrics';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Metrik' };

export default async function Metrics() {
  const ctx = makeCtx('demo', SYSTEM_ACTOR);
  const db = ctx.db;
  return <MetricsView m={await operationalMetrics(db, ctx.clock.now())} csvHref={links.demo.metricsCsv()} />;
}
