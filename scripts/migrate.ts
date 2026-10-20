import { createDb } from '../src/server/db/client';
import { migrateDb } from '../src/server/db/migrate';
import { loadEnv } from './env';

loadEnv();
for (const url of [process.env.DATABASE_URL, process.env.DEMO_DATABASE_URL]) {
  if (!url) continue;
  const db = createDb(url);
  await migrateDb(db);
  await db.$close();
}
console.log('Migrations applied.');
