import { randomUUID } from 'node:crypto';
import { systemClock, type Clock } from '@/lib/time';
import { MockScheduleAdapter, type ScheduleAdapter } from './adapters/schedule';
import { getDb, type Db, type Zone } from './db/client';
import { ForbiddenError } from './errors';
import { createLogger, type Logger } from './log';

export type Role = 'coordinator' | 'unit_admin' | 'system_admin';

export interface Actor {
  type: 'user' | 'patient' | 'system' | 'demo' | 'public';
  id: string | null;
  label: string;
  role: Role | null;
}

export interface Ctx {
  db: Db;
  zone: Zone | 'test';
  clock: Clock;
  schedule: ScheduleAdapter;
  log: Logger;
  actor: Actor;
  correlationId: string;
}

export const SYSTEM_ACTOR: Actor = { type: 'system', id: null, label: 'Sistem', role: null };

const adapters = globalThis as unknown as { __rujukSchedule?: Partial<Record<Zone, ScheduleAdapter>> };
function scheduleFor(zone: Zone): ScheduleAdapter {
  adapters.__rujukSchedule ??= {};
  return (adapters.__rujukSchedule[zone] ??= new MockScheduleAdapter());
}

export function makeCtx(zone: Zone, actor: Actor, correlationId: string = randomUUID()): Ctx {
  return {
    db: getDb(zone),
    zone,
    clock: systemClock,
    schedule: scheduleFor(zone),
    log: createLogger({ zone, correlationId }),
    actor,
    correlationId,
  };
}

/** RBAC is enforced in use-cases, not only in the UI. The demo sandbox actor may do everything inside the sandbox. */
export function requireRole(ctx: Ctx, ...roles: Role[]) {
  if (ctx.actor.type === 'demo' && ctx.zone === 'demo') return;
  if (ctx.actor.type === 'system') return;
  if (ctx.actor.type !== 'user' || !ctx.actor.role || !roles.includes(ctx.actor.role))
    throw new ForbiddenError();
}

export function withActor(ctx: Ctx, actor: Actor): Ctx {
  return { ...ctx, actor };
}
