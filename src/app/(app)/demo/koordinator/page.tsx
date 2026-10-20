import { QueueView } from '@/features/coordinator/QueueView';
import { demoActor } from '@/server/actions/ctx';
import { makeCtx } from '@/server/context';
import { loadQueue } from '@/server/queries';
import { expireDueHolds } from '@/server/usecases/holds';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Antrean koordinator' };

export default async function DemoQueue({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter } = await searchParams;
  const ctx = makeCtx('demo', await demoActor());
  await expireDueHolds(ctx);
  return <QueueView items={await loadQueue(ctx.db)} zone="demo" now={ctx.clock.now()} filter={filter} />;
}
