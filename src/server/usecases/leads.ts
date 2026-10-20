import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { policy } from '@/config/policy';
import { audit } from '../audit';
import { requireRole, type Ctx } from '../context';
import { lead } from '../db/schema';
import { DomainError } from '../errors';
import { notify } from '../notifications';
import { hitRateLimit } from '../rateLimit';
import { looksLikePersonalData } from './episodes';

export const CONSENT_VERSION = 'v1-2026-10';
export const CONSENT_TEXT =
  'Saya setuju data kontak di atas dipakai hanya untuk menindaklanjuti permintaan ini, dan dapat meminta penghapusannya kapan saja.';

// Words that suggest someone is about to send patient/clinical data through a sales form.
const CLINICAL_HINTS = /\b(diagnosa|diagnosis|rekam medis|no\.?\s*rm|bpjs\s*\d|nik)\b/i;

export const leadSchema = z
  .object({
    name: z.string().trim().min(2, 'Isi nama Anda').max(80),
    organization: z.string().trim().min(2, 'Isi nama instansi').max(120),
    role: z.string().trim().min(2, 'Isi peran Anda').max(80),
    contactChannel: z.enum(['email', 'whatsapp'], { message: 'Pilih kanal kontak' }),
    contactValue: z.string().trim().min(5, 'Isi kontak').max(120),
    need: z.string().trim().min(10, 'Ceritakan kebutuhan minimal 10 karakter').max(1000),
    consent: z.literal(true, { message: 'Persetujuan penggunaan data kontak wajib dicentang' }),
  })
  .superRefine((v, ctx) => {
    if (v.contactChannel === 'email' && !z.string().email().safeParse(v.contactValue).success) {
      ctx.addIssue({ code: 'custom', path: ['contactValue'], message: 'Email tidak valid' });
    }
    if (v.contactChannel === 'whatsapp' && !/^\+?\d[\d\s-]{8,16}$/.test(v.contactValue)) {
      ctx.addIssue({ code: 'custom', path: ['contactValue'], message: 'Nomor WhatsApp tidak valid' });
    }
    if (looksLikePersonalData(v.need) || CLINICAL_HINTS.test(v.need)) {
      ctx.addIssue({
        code: 'custom',
        path: ['need'],
        message: 'Mohon jangan kirim data pasien (NIK, nomor rekam medis, diagnosis) lewat formulir ini.',
      });
    }
  });

export type LeadInput = z.input<typeof leadSchema>;

export type LeadResult = { ok: true; id: string } | { ok: false; errors: string[] };

/** Public form: honeypot + minimum fill time + per-IP rate limit + explicit consent. Never accepts patient data. */
export async function submitLead(
  ctx: Ctx,
  input: LeadInput & { honeypot?: string; startedAt?: number },
  ip: string,
): Promise<LeadResult> {
  const now = ctx.clock.now();
  // Bots fill hidden fields or submit instantly; answer like a success so they learn nothing.
  if (input.honeypot || (input.startedAt && now - input.startedAt < 2000)) {
    ctx.log.warn('lead_spam_blocked', { code: input.honeypot ? 'honeypot' : 'too_fast' });
    return { ok: false, errors: ['Permintaan tidak dapat diproses.'] };
  }
  const { limit, windowSec } = policy.rateLimits.lead;
  if (!(await hitRateLimit(ctx.db, `lead:${ip}`, limit, windowSec, now))) {
    throw new DomainError('RATE_LIMIT', 'Terlalu banyak permintaan dari perangkat ini. Coba lagi nanti.', 429);
  }
  const parsed = leadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => i.message) };
  const v = parsed.data;
  const [row] = await ctx.db
    .insert(lead)
    .values({
      name: v.name,
      organization: v.organization,
      role: v.role,
      contactChannel: v.contactChannel,
      contactValue: v.contactValue,
      need: v.need,
      consentAt: new Date(now),
      consentTextVersion: CONSENT_VERSION,
      createdAt: new Date(now),
    })
    .returning({ id: lead.id });
  await notify(ctx.db, ctx, { template: 'lead_received', leadId: row!.id, organization: v.organization });
  await audit(ctx.db, ctx, { entity: 'lead', entityId: row!.id, action: 'lead_submitted' });
  return { ok: true, id: row!.id };
}

export async function listLeads(ctx: Ctx) {
  requireRole(ctx, 'system_admin');
  return ctx.db.select().from(lead).orderBy(desc(lead.createdAt));
}

export async function setLeadStatus(ctx: Ctx, id: string, status: 'baru' | 'dihubungi' | 'selesai' | 'ditolak') {
  requireRole(ctx, 'system_admin');
  await ctx.db.update(lead).set({ status }).where(eq(lead.id, id));
  await audit(ctx.db, ctx, { entity: 'lead', entityId: id, action: 'lead_status', to: status });
}
