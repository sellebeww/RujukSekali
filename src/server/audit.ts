import type { Ctx } from './context';
import type { Executor } from './db/client';
import { auditLog } from './db/schema';

export interface AuditEntry {
  entity: string;
  entityId: string;
  action: string;
  from?: string | null;
  to?: string | null;
  reason?: string | null;
  /** Ids and counts only — never personal or clinical data. */
  data?: Record<string, unknown>;
}

export async function audit(ex: Executor, ctx: Ctx, e: AuditEntry) {
  await ex.insert(auditLog).values({
    at: new Date(ctx.clock.now()),
    actorType: ctx.actor.type,
    actorId: ctx.actor.id,
    actorLabel: ctx.actor.label,
    entity: e.entity,
    entityId: e.entityId,
    action: e.action,
    fromState: e.from ?? null,
    toState: e.to ?? null,
    reason: e.reason ?? null,
    correlationId: ctx.correlationId,
    data: e.data ?? null,
  });
  ctx.log.info('audit', { entity: e.entity, entityId: e.entityId, from: e.from, to: e.to, event: e.action });
}
