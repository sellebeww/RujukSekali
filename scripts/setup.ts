// One-time local setup: .env with fresh secrets, migrations for app + demo, synthetic seed.
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { systemClock, toLocalDate } from '../src/lib/time';
import { createDb } from '../src/server/db/client';
import { migrateDb, recreateDb } from '../src/server/db/migrate';
import { seedMeta } from '../src/server/db/schema';
import { seedDatabase } from '../seed/seed';
import { loadEnv } from './env';

function ensureEnv() {
  if (!existsSync('.env')) copyFileSync('.env.example', '.env');
  let text = readFileSync('.env', 'utf8');
  const fill = (k: string, v: string) => {
    text = text.replace(new RegExp(`^${k}=\\s*$`, 'm'), `${k}=${v}`);
  };
  fill('SESSION_SECRET', randomBytes(32).toString('base64url'));
  fill('NATIONAL_ID_PEPPER', randomBytes(32).toString('base64url'));
  fill('CRON_SECRET', randomBytes(24).toString('base64url'));
  fill('SEED_STAFF_PASSWORD', `contoh-${randomBytes(4).toString('hex')}`);
  writeFileSync('.env', text);
}

async function waitFor(url: string) {
  for (let i = 0; i < 60; i++) {
    const db = createDb(url, 1);
    try {
      await db.execute(sql`select 1`);
      await db.$close();
      return;
    } catch {
      await db.$close();
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error(`Database not reachable: ${url}. Did you run "docker compose up -d"?`);
}

async function main() {
  ensureEnv();
  loadEnv();
  const pw = process.env.SEED_STAFF_PASSWORD!;
  const today = toLocalDate(Date.now());

  await waitFor(process.env.DATABASE_URL!);
  const app = createDb(process.env.DATABASE_URL!);
  await migrateDb(app);
  const seeded = await app
    .select()
    .from(seedMeta)
    .catch(() => []);
  if (seeded.length === 0 || process.argv.includes('--reset')) {
    if (seeded.length) await recreateDb(app);
    console.log('Seeding app database (synthetic data)…');
    await seedDatabase(app, { zone: 'app', startDate: today, clock: systemClock, staffPassword: pw });
  } else {
    console.log('App database already seeded (use "npm run setup -- --reset" to rebuild).');
  }
  await app.$close();

  const demo = createDb(process.env.DEMO_DATABASE_URL!);
  console.log('Rebuilding demo sandbox…');
  await recreateDb(demo);
  await seedDatabase(demo, { zone: 'demo', startDate: today, clock: systemClock, staffPassword: pw });
  await demo.$close();

  console.log('\nSiap. Jalankan "npm run dev" lalu buka http://localhost:3000');
  console.log('Login staf (data sintetis, hanya lokal):');
  console.log('  koordinator@rs-contoh.test / admin.unit@rs-contoh.test / admin@rs-contoh.test');
  console.log(`  kata sandi: ${pw}  (tersimpan di .env sebagai SEED_STAFF_PASSWORD)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
