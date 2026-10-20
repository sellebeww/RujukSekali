import { Notice } from '@/components/ui';
import { QueueView } from '@/features/coordinator/QueueView';
import { SYSTEM_ACTOR, makeCtx } from '@/server/context';
import { loadQueue } from '@/server/queries';
import { expireDueHolds } from '@/server/usecases/holds';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Antrean koordinator' };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ filter?: string; akses?: string }> }) {
  const { filter, akses } = await searchParams;
  const ctx = makeCtx('app', SYSTEM_ACTOR);
  await expireDueHolds(ctx);
  const items = await loadQueue(ctx.db);
  return (
    <>
      {akses === 'ditolak' && (
        <div className="container-page pt-6">
          <Notice tone="danger" role="alert" title="Halaman itu tidak tersedia untuk peran Anda." />
        </div>
      )}
      <QueueView items={items} zone="app" now={Date.now()} filter={filter} />
    </>
  );
}
