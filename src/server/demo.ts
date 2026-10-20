import 'server-only';
import { eq } from 'drizzle-orm';
import { policy } from '@/config/policy';
import { HOUR, systemClock, toLocalDate } from '@/lib/time';
import { seedDatabase } from '@seed/seed';
import { getDb } from './db/client';
import { recreateDb } from './db/migrate';
import { seedMeta } from './db/schema';

let rebuilding: Promise<void> | null = null;

/** The shared demo sandbox is rebuilt from synthetic data when it is stale (older than N hours or from another day). */
export async function ensureDemoFresh(): Promise<void> {
  const db = getDb('demo');
  const meta = await db
    .select()
    .from(seedMeta)
    .where(eq(seedMeta.id, 1))
    .then((r) => r[0])
    .catch(() => undefined);
  const today = toLocalDate(Date.now());
  const fresh =
    meta && meta.startDate === today && Date.now() - meta.seededAt.getTime() < policy.demo.maxAgeHours * HOUR;
  if (fresh) return;
  // shortcut: in-process guard only; a multi-instance deployment needs a pg advisory lock here.
  rebuilding ??= (async () => {
    await recreateDb(db);
    await seedDatabase(db, {
      zone: 'demo',
      startDate: today,
      clock: systemClock,
      staffPassword: process.env.SEED_STAFF_PASSWORD ?? crypto.randomUUID(),
    });
  })().finally(() => {
    rebuilding = null;
  });
  await rebuilding;
}
