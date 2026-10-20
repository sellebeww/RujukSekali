import { createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { Ctx } from './context';
import { idempotencyKey } from './db/schema';
import { DomainError } from './errors';

interface StoredError {
  __error: { code: string; message: string; status: number };
}

/**
 * Runs `op` at most once per (scope, key). A replay with the same key returns the stored result (or re-throws the
 * stored domain error); a replay with a different payload is rejected. Unexpected crashes free the key for retry.
 */
export async function withIdempotency<T>(
  ctx: Ctx,
  action: string,
  key: string | null | undefined,
  request: unknown,
  op: () => Promise<T>,
): Promise<T> {
  if (!key || key.length < 8 || key.length > 200) {
    throw new DomainError(
      'IDEMPOTENCY_KEY_REQUIRED',
      'Permintaan tidak lengkap (kunci idempotensi wajib).',
      400,
    );
  }
  const scope = `${action}:${ctx.actor.id ?? ctx.actor.type}`;
  const requestHash = createHash('sha256').update(JSON.stringify(request)).digest('hex');
  const inserted = await ctx.db
    .insert(idempotencyKey)
    .values({ scope, key, requestHash })
    .onConflictDoNothing()
    .returning({ key: idempotencyKey.key });

  const where = and(eq(idempotencyKey.scope, scope), eq(idempotencyKey.key, key));
  if (inserted.length === 0) {
    const [row] = await ctx.db.select().from(idempotencyKey).where(where);
    if (!row) throw new DomainError('IDEMPOTENCY_RACE', 'Coba lagi.', 409);
    if (row.requestHash !== requestHash) {
      throw new DomainError(
        'IDEMPOTENCY_MISMATCH',
        'Kunci permintaan sudah dipakai untuk permintaan lain.',
        422,
      );
    }
    if (row.response === null)
      throw new DomainError('IN_PROGRESS', 'Permintaan yang sama sedang diproses.', 409);
    const stored = row.response as T | StoredError;
    if (stored && typeof stored === 'object' && '__error' in stored) {
      const e = (stored as StoredError).__error;
      throw new DomainError(e.code, e.message, e.status);
    }
    return stored as T;
  }

  try {
    const result = await op();
    await ctx.db
      .update(idempotencyKey)
      .set({ response: result ?? null, statusCode: 200 })
      .where(where);
    return result;
  } catch (err) {
    if (err instanceof DomainError) {
      const stored: StoredError = { __error: { code: err.code, message: err.message, status: err.status } };
      await ctx.db.update(idempotencyKey).set({ response: stored, statusCode: err.status }).where(where);
    } else {
      await ctx.db.delete(idempotencyKey).where(where);
    }
    throw err;
  }
}
