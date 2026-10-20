import { AuditView } from '@/features/shared/AuditView';
import { SYSTEM_ACTOR, makeCtx } from '@/server/context';
import { loadAudit } from '@/server/queries';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Audit log' };

export default async function Audit() {
  const db = makeCtx('demo', SYSTEM_ACTOR).db;
  return <AuditView rows={await loadAudit(db)} />;
}
