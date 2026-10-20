import { existsSync } from 'node:fs';
import { systemClock, toLocalDate } from '../src/lib/time';
import { createDb } from '../src/server/db/client';
import { recreateDb } from '../src/server/db/migrate';
import { seedDatabase } from '../seed/seed';

/** Fresh synthetic data for both E2E databases before the run. */
export default async function globalSetup() {
  if (existsSync('.env')) process.loadEnvFile('.env');
  for (const [url, zone] of [
    [process.env.E2E_DATABASE_URL!, 'app'],
    [process.env.E2E_DEMO_DATABASE_URL!, 'demo'],
  ] as const) {
    const db = createDb(url);
    await recreateDb(db);
    await seedDatabase(db, {
      zone,
      startDate: toLocalDate(Date.now()),
      clock: systemClock,
      staffPassword: 'e2e-password',
      randomEpisodes: 10,
    });
    await db.$close();
  }
}
