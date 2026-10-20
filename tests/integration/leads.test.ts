import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { lead, outbox, patient } from '@/server/db/schema';
import { listLeads, submitLead } from '@/server/usecases/leads';
import { setupTestDb, type TestEnv } from '../support/db';

let env: TestEnv;
const publicActor = { type: 'public' as const, id: null, label: 'Formulir publik', role: null };
const valid = {
  name: 'Dr. Contoh',
  organization: 'RS Uji Coba',
  role: 'Direktur Pelayanan',
  contactChannel: 'email' as const,
  contactValue: 'direktur@rs-uji.test',
  need: 'Kami ingin pilot untuk pasien rujukan dari kabupaten.',
  consent: true,
};

beforeAll(async () => {
  env = await setupTestDb();
});
afterAll(() => env.close());

describe('Skenario 13 — formulir minta demo', () => {
  it('submit valid membuat Lead dengan persetujuan tercatat dan muncul di panel admin', async () => {
    const r = await submitLead(
      env.ctx(publicActor),
      { ...valid, startedAt: env.clock.now() - 10_000 },
      '10.0.0.1',
    );
    expect(r.ok).toBe(true);
    const [row] = await env.db
      .select()
      .from(lead)
      .where(eq(lead.id, r.ok ? r.id : ''));
    expect(row!.consentAt).toBeInstanceOf(Date);
    expect(row!.consentTextVersion).toMatch(/^v1/);
    const admin = await listLeads(
      env.ctx({ type: 'user', id: crypto.randomUUID(), label: 'Admin', role: 'system_admin' }),
    );
    expect(admin.map((l) => l.organization)).toContain('RS Uji Coba');
    const note = await env.db.select().from(outbox).where(eq(outbox.template, 'lead_received'));
    expect(note.length).toBeGreaterThan(0);
  });

  it('tanpa persetujuan ditolak dengan pesan jelas', async () => {
    const r = await submitLead(env.ctx(publicActor), { ...valid, consent: false }, '10.0.0.2');
    expect(r).toEqual({ ok: false, errors: ['Persetujuan penggunaan data kontak wajib dicentang'] });
  });

  it('honeypot dan pengisian terlalu cepat ditolak tanpa menyimpan apa pun', async () => {
    const before = (await env.db.select().from(lead)).length;
    expect(
      (await submitLead(env.ctx(publicActor), { ...valid, honeypot: 'http://spam' }, '10.0.0.3')).ok,
    ).toBe(false);
    expect(
      (await submitLead(env.ctx(publicActor), { ...valid, startedAt: env.clock.now() - 200 }, '10.0.0.3')).ok,
    ).toBe(false);
    expect((await env.db.select().from(lead)).length).toBe(before);
  });

  it('melebihi rate limit ditolak', async () => {
    const ctx = env.ctx(publicActor);
    for (let i = 0; i < 5; i++)
      await submitLead(ctx, { ...valid, contactValue: `x${i}@rs-uji.test` }, '10.0.0.9');
    await expect(submitLead(ctx, valid, '10.0.0.9')).rejects.toMatchObject({ code: 'RATE_LIMIT' });
  });

  it('data pasien tidak diterima dan Lead tidak terhubung ke data pasien', async () => {
    const patientsBefore = (await env.db.select().from(patient)).length;
    const r = await submitLead(
      env.ctx(publicActor),
      { ...valid, need: 'Pasien NIK 3201234567890123 butuh jadwal' },
      '10.0.0.4',
    );
    expect(r.ok).toBe(false);
    expect((await env.db.select().from(patient)).length).toBe(patientsBefore);
  });
});
