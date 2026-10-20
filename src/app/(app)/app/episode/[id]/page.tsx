import { notFound } from 'next/navigation';
import { EpisodeView } from '@/features/coordinator/EpisodeView';
import { SYSTEM_ACTOR, makeCtx } from '@/server/context';
import { loadEpisodeDetail } from '@/server/queries';
import { expireDueHolds } from '@/server/usecases/holds';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Detail episode' };

export default async function EpisodePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const ctx = makeCtx('app', SYSTEM_ACTOR);
  await expireDueHolds(ctx);
  const d = await loadEpisodeDetail(ctx.db, id);
  if (!d) notFound();
  return <EpisodeView d={d} zone="app" now={Date.now()} />;
}
