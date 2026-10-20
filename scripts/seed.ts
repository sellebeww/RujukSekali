// Rebuilds a database with fresh synthetic data. `--zone=demo` (default) or `--zone=app --force`.
import { systemClock, toLocalDate } from '../src/lib/time';
import { createDb } from '../src/server/db/client';
import { recreateDb } from '../src/server/db/migrate';
import { seedDatabase } from '../seed/seed';
import { loadEnv } from './env';

loadEnv();
const zone = process.argv.find((a) => a.startsWith('--zone='))?.split('=')[1] === 'app' ? 'app' : 'demo';
if (zone === 'app' && !process.argv.includes('--force')) {
  console.error('Rebuilding the app database deletes its data. Re-run with --force.');
  process.exit(1);
}
const db = createDb((zone === 'app' ? process.env.DATABASE_URL : process.env.DEMO_DATABASE_URL)!);
await recreateDb(db);
await seedDatabase(db, {
  zone,
  startDate: toLocalDate(Date.now()),
  clock: systemClock,
  staffPassword: process.env.SEED_STAFF_PASSWORD!,
});
await db.$close();
console.log(`Database "${zone}" rebuilt with synthetic data.`);
