import { InboxView } from '@/features/shared/InboxView';
import { SYSTEM_ACTOR, makeCtx } from '@/server/context';
import { loadOutbox } from '@/server/queries';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Kotak masuk simulasi' };

export default async function Inbox() {
  const db = makeCtx('app', SYSTEM_ACTOR).db;
  return <InboxView messages={await loadOutbox(db)} />;
}
