import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type Zone = 'app' | 'demo';

export function createDb(url: string, max = 10) {
  const client = postgres(url, { max, onnotice: () => {}, idle_timeout: 20 });
  return Object.assign(drizzle(client, { schema, casing: 'snake_case' }), { $close: () => client.end() });
}

export type Db = ReturnType<typeof createDb>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
/** Anything that can run queries: the pool or an open transaction. */
export type Executor = Db | Tx;

const globalDbs = globalThis as unknown as { __rujukDbs?: Partial<Record<Zone, Db>> };

/** One pool per zone. Demo pages only ever receive the demo pool, so demo writes cannot reach real data. */
export function getDb(zone: Zone): Db {
  globalDbs.__rujukDbs ??= {};
  const url = zone === 'demo' ? process.env.DEMO_DATABASE_URL : process.env.DATABASE_URL;
  if (!url) throw new Error(`Database URL for zone "${zone}" is not configured`);
  return (globalDbs.__rujukDbs[zone] ??= createDb(url));
}
