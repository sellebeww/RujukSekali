import { and, eq, inArray, lte, notInArray, sql } from 'drizzle-orm';
import { expect } from 'vitest';
import { seedDatabase } from '@seed/seed';
import { SCENARIOS, type ScenarioId } from '@seed/scenarios';
import { FakeClock, localToUtc } from '@/lib/time';
import { MockScheduleAdapter } from '@/server/adapters/schedule';
import type { Actor, Ctx } from '@/server/context';
import { createDb, type Db } from '@/server/db/client';
import { recreateDb } from '@/server/db/migrate';
import { appUser, hold, slot, tripPlan } from '@/server/db/schema';
import { createLogger } from '@/server/log';
import { createEpisode } from '@/server/usecases/episodes';
import { proposePlans } from '@/server/usecases/planning';

export const START = '2026-11-02'; // Monday

export interface TestEnv {
  db: Db;
  clock: FakeClock;
  schedule: MockScheduleAdapter;
  coordinator: Actor;
  ctx(actor?: Actor): Ctx;
  close(): Promise<void>;
}

export async function setupTestDb(): Promise<TestEnv> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL missing — run "npm run setup" and keep Docker running');
  process.env.NATIONAL_ID_PEPPER ??= 'test-pepper-0123456789abcdef';
  const db = createDb(url, 20);
  await recreateDb(db);
  const clock = new FakeClock(localToUtc(START, '05:00'));
  await seedDatabase(db, {
    zone: 'test',
    startDate: START,
    clock,
    staffPassword: 'test-password',
    randomEpisodes: 0,
  });
  const [u] = await db.select().from(appUser).where(eq(appUser.role, 'coordinator'));
  const coordinator: Actor = { type: 'user', id: u!.id, label: u!.name, role: 'coordinator' };
  const schedule = new MockScheduleAdapter();
  return {
    db,
    clock,
    schedule,
    coordinator,
    ctx: (actor = coordinator) => ({
      db,
      zone: 'test',
      clock,
      schedule,
      log: createLogger({}, () => {}),
      actor,
      correlationId: 'test',
    }),
    close: () => db.$close(),
  };
}

export async function newScenarioEpisode(
  env: TestEnv,
  id: ScenarioId,
  label = `T${Math.random().toString(36).slice(2, 7)}`,
) {
  const { episodeId } = await createEpisode(env.ctx(), SCENARIOS[id].build(START, label));
  return episodeId;
}

export async function proposedBest(env: TestEnv, episodeId: string) {
  const res = await proposePlans(env.ctx(), episodeId);
  expect(res.planIds.length).toBeGreaterThan(0);
  return res.planIds[0]!;
}

/** Global invariants that must hold after every operation: no orphan or double-owned slots. */
export async function assertInvariants(db: Db) {
  const orphanHeld = await db
    .select({ id: slot.id })
    .from(slot)
    .leftJoin(hold, eq(hold.id, slot.holdId))
    .where(
      and(
        eq(slot.status, 'held'),
        sql`(${hold.status} is null or ${hold.status} not in ('pending','active'))`,
      ),
    );
  expect(orphanHeld, 'held slots without a live hold').toEqual([]);

  const orphanBooked = await db
    .select({ id: slot.id })
    .from(slot)
    .innerJoin(tripPlan, eq(tripPlan.id, slot.bookedPlanId))
    .where(and(eq(slot.status, 'booked'), notInArray(tripPlan.status, ['CONFIRMED', 'COMPLETED'])));
  expect(orphanBooked, 'booked slots owned by a non-confirmed plan').toEqual([]);

  const activeOnDeadPlan = await db
    .select({ id: hold.id })
    .from(hold)
    .innerJoin(tripPlan, eq(tripPlan.id, hold.tripPlanId))
    .where(and(eq(hold.status, 'active'), sql`${tripPlan.status} <> 'HELD'`));
  expect(activeOnDeadPlan, 'active hold on a plan that is not HELD').toEqual([]);

  const heldPlansWithoutHold = await db
    .select({ id: tripPlan.id })
    .from(tripPlan)
    .leftJoin(hold, and(eq(hold.tripPlanId, tripPlan.id), eq(hold.status, 'active')))
    .where(and(eq(tripPlan.status, 'HELD'), sql`${hold.id} is null`));
  expect(heldPlansWithoutHold, 'HELD plan without an active hold').toEqual([]);
}

export async function slotStatuses(db: Db, ids: string[]) {
  const rows = await db.select({ id: slot.id, status: slot.status }).from(slot).where(inArray(slot.id, ids));
  return rows.map((r) => r.status);
}

export async function dueActiveHolds(db: Db, nowMs: number) {
  return db
    .select({ id: hold.id })
    .from(hold)
    .where(and(eq(hold.status, 'active'), lte(hold.expiresAt, new Date(nowMs))));
}
