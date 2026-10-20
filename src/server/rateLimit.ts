import { sql } from 'drizzle-orm';
import type { Executor } from './db/client';
import { rateLimit } from './db/schema';

/** Fixed-window counter in Postgres. Returns false once `limit` is exceeded within the window. */
export async function hitRateLimit(ex: Executor, bucket: string, limit: number, windowSec: number, nowMs: number) {
  const windowStart = new Date(Math.floor(nowMs / (windowSec * 1000)) * windowSec * 1000);
  const [row] = await ex
    .insert(rateLimit)
    .values({ bucket, windowStart, count: 1 })
    .onConflictDoUpdate({ target: [rateLimit.bucket, rateLimit.windowStart], set: { count: sql`${rateLimit.count} + 1` } })
    .returning({ count: rateLimit.count });
  return (row?.count ?? 0) <= limit;
}
