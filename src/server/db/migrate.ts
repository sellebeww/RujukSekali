import path from 'node:path';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import type { Db } from './client';

const migrationsFolder = path.join(process.cwd(), 'drizzle');

export async function migrateDb(db: Db) {
  await migrate(db, { migrationsFolder });
}

/**
 * Drops and recreates every schema, then migrates. Used for the test database and the demo sandbox only:
 * the append-only audit trigger forbids truncation, so a sandbox reset recreates the schema instead.
 */
export async function recreateDb(db: Db) {
  await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
  await db.execute(sql`DROP SCHEMA IF EXISTS marketing CASCADE`);
  await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
  await db.execute(sql`CREATE SCHEMA public`);
  await migrateDb(db);
}
