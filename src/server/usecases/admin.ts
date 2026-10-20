import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '../audit';
import { requireRole, type Ctx } from '../context';
import { serviceType, slot } from '../db/schema';
import { DomainError, NotFoundError } from '../errors';

export const serviceRulesSchema = z.object({
  latestStartLocal: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Jam harus HH:MM')
    .or(z.literal('')),
  resultReadyMin: z.coerce.number().int().min(0).max(24 * 60),
  ttlSingkatMin: z.coerce.number().int().min(15).max(7 * 24 * 60),
  ttlStandarMin: z.coerce.number().int().min(15).max(7 * 24 * 60),
  ttlPanjangMin: z.coerce.number().int().min(15).max(7 * 24 * 60),
  maxHoldRatioPct: z.coerce.number().min(0).max(100),
  maxExtensions: z.coerce.number().int().min(0).max(10),
});
export type ServiceRulesInput = z.infer<typeof serviceRulesSchema>;

export async function updateServiceRules(ctx: Ctx, code: string, input: ServiceRulesInput) {
  requireRole(ctx, 'unit_admin', 'system_admin');
  const v = serviceRulesSchema.parse(input);
  if (!(v.ttlSingkatMin <= v.ttlStandarMin && v.ttlStandarMin <= v.ttlPanjangMin)) {
    throw new DomainError('BAD_TTL', 'Urutan TTL harus singkat ≤ standar ≤ panjang.', 400);
  }
  const [st] = await ctx.db.select().from(serviceType).where(eq(serviceType.code, code));
  if (!st) throw new NotFoundError('Layanan');
  const next = {
    latestStartLocal: st.fasting ? v.latestStartLocal || null : null,
    resultReadyMin: v.resultReadyMin,
    holdTtlMinutes: { singkat: v.ttlSingkatMin, standar: v.ttlStandarMin, panjang: v.ttlPanjangMin },
    maxHoldRatio: v.maxHoldRatioPct / 100,
    maxExtensions: v.maxExtensions,
  };
  await ctx.db.transaction(async (tx) => {
    await tx.update(serviceType).set(next).where(eq(serviceType.id, st.id));
    await audit(tx, ctx, {
      entity: 'service_type',
      entityId: st.id,
      action: 'rules_updated',
      data: { before: { ratio: st.maxHoldRatio, ttl: st.holdTtlMinutes, ext: st.maxExtensions }, after: { ratio: next.maxHoldRatio, ttl: next.holdTtlMinutes, ext: next.maxExtensions } },
    });
  });
}

/** Blocks every still-free slot of a service on a day (e.g. doctor unavailable), or reopens them. Held/booked slots are untouched. */
export async function setDayBlocked(ctx: Ctx, serviceTypeId: string, localDate: string, blocked: boolean) {
  requireRole(ctx, 'unit_admin', 'system_admin');
  const rows = await ctx.db.transaction(async (tx) => {
    const changed = await tx
      .update(slot)
      .set({ status: blocked ? 'blocked' : 'available' })
      .where(and(eq(slot.serviceTypeId, serviceTypeId), eq(slot.localDate, localDate), eq(slot.status, blocked ? 'available' : 'blocked')))
      .returning({ id: slot.id });
    await audit(tx, ctx, {
      entity: 'capacity',
      entityId: `${serviceTypeId}:${localDate}`,
      action: blocked ? 'day_blocked' : 'day_unblocked',
      data: { slots: changed.length },
    });
    return changed.length;
  });
  return rows;
}
