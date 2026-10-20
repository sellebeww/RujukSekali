// Scenario 12: the demo sandbox is a different database; demo actions never touch the real zone.
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { makeCtx } from '@/server/context';
import { getDb } from '@/server/db/client';
import { appUser, episode } from '@/server/db/schema';
import { eq } from 'drizzle-orm';
import { runScenario } from '@/server/usecases/scenarios';

const configured = !!process.env.DATABASE_URL && !!process.env.DEMO_DATABASE_URL;

describe.skipIf(!configured)('Skenario 12 — isolasi sandbox demo', () => {
  it('zona demo dan zona kerja memakai database berbeda', async () => {
    const [a] = await getDb('app').execute<{ db: string }>(sql`select current_database() as db`);
    const [d] = await getDb('demo').execute<{ db: string }>(sql`select current_database() as db`);
    expect(a!.db).not.toBe(d!.db);
    expect(d!.db).toMatch(/demo/);
  });

  it('menjalankan skenario demo tidak mengubah data zona kerja', async () => {
    const count = async () =>
      (
        await getDb('app')
          .select({ n: sql<number>`count(*)`.mapWith(Number) })
          .from(episode)
      )[0]!.n;
    const before = await count();
    const [u] = await getDb('demo').select().from(appUser).where(eq(appUser.role, 'coordinator'));
    const ctx = makeCtx('demo', { type: 'demo', id: u!.id, label: 'Koordinator Demo', role: 'coordinator' });
    const { episodeId } = await runScenario(ctx, '1', 'tahan', 'Pasien Demo Uji Isolasi');
    expect(await count()).toBe(before);
    const inApp = await getDb('app').select().from(episode).where(eq(episode.id, episodeId));
    expect(inApp).toEqual([]);
  });
});
