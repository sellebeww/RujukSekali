import { and, eq, sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { HOUR, MINUTE } from '@/lib/time';
import {
  auditLog,
  document,
  episode,
  hold,
  outbox,
  planVisit,
  serviceType,
  slot,
  tripPlan,
} from '@/server/db/schema';
import { ForbiddenError } from '@/server/errors';
import { uploadDocument, verifyDocument } from '@/server/usecases/episodes';
import {
  approvePlan,
  cancelPlan,
  expireDueHolds,
  extendHold,
  holdPlan,
  markPriorityChanged,
  planSlots,
  releasePlan,
  tryConfirm,
} from '@/server/usecases/holds';
import { proposePlans } from '@/server/usecases/planning';
import {
  assertInvariants,
  newScenarioEpisode,
  proposedBest,
  setupTestDb,
  slotStatuses,
  type TestEnv,
} from '../support/db';

let env: TestEnv;
const key = () => crypto.randomUUID();

beforeAll(async () => {
  env = await setupTestDb();
});
afterAll(async () => {
  await env.close();
});
afterEach(async () => {
  env.schedule.setFaults({});
  await assertInvariants(env.db);
});

async function planStatus(planId: string) {
  const [p] = await env.db.select({ s: tripPlan.status }).from(tripPlan).where(eq(tripPlan.id, planId));
  return p!.s;
}

describe('Skenario 1 — koordinator menyetujui rencana 1 hari', () => {
  it('PROPOSED → HELD → CONFIRMED, slot booked, notifikasi tanpa detail klinis', async () => {
    const ep = await newScenarioEpisode(env, '1');
    const planId = await proposedBest(env, ep);
    const [p] = await env.db.select().from(tripPlan).where(eq(tripPlan.id, planId));
    expect(p!.visitDays).toBe(1);
    const held = await holdPlan(env.ctx(), planId, key());
    expect(held.ok).toBe(true);
    expect(await planStatus(planId)).toBe('HELD');
    const res = await approvePlan(env.ctx(), planId, key());
    expect(res).toEqual({ confirmed: true, blockers: [] });
    expect(await planStatus(planId)).toBe('CONFIRMED');
    expect(new Set(await slotStatuses(env.db, await planSlots(env.db, planId)))).toEqual(new Set(['booked']));
    const msgs = await env.db.select().from(outbox).where(eq(outbox.episodeId, ep));
    expect(msgs.map((m) => m.template)).toEqual(['plan_held', 'plan_confirmed']);
  });
});

describe('Skenario 2 — dokumen belum siap', () => {
  it('tetap HELD sampai dokumen verified, lalu otomatis CONFIRMED', async () => {
    const ep = await newScenarioEpisode(env, '2');
    const planId = await proposedBest(env, ep);
    expect((await holdPlan(env.ctx(), planId, key())).ok).toBe(true);
    const r1 = await approvePlan(env.ctx(), planId, key());
    expect(r1.confirmed).toBe(false);
    expect(r1.blockers.map((b) => b.code)).toContain('DOCUMENT_NOT_VERIFIED');
    expect(await planStatus(planId)).toBe('HELD');

    const docs = await env.db.select().from(document).where(eq(document.episodeId, ep));
    for (const d of docs) {
      await uploadDocument(
        env.ctx({ type: 'patient', id: ep, label: 'Pasien', role: null }),
        d.id,
        'rujukan.pdf',
      );
    }
    // Uploaded is not enough: confirmation needs verification.
    expect((await tryConfirm(env.ctx(), planId)).confirmed).toBe(false);
    await verifyDocument(env.ctx(), docs[0]!.id);
    expect(await planStatus(planId)).toBe('HELD');
    const last = await verifyDocument(env.ctx(), docs[1]!.id);
    expect(last?.confirmed).toBe(true);
    expect(await planStatus(planId)).toBe('CONFIRMED');
  });

  it('TTL habis sebelum verifikasi → EXPIRED, slot kembali, koordinator diberi tahu', async () => {
    const ep = await newScenarioEpisode(env, '2');
    const planId = await proposedBest(env, ep);
    await holdPlan(env.ctx(), planId, key());
    const slots = await planSlots(env.db, planId);
    expect(new Set(await slotStatuses(env.db, slots))).toEqual(new Set(['held']));
    const t0 = env.clock.now();
    env.clock.advance(24 * HOUR + MINUTE);
    const r = await expireDueHolds(env.ctx());
    expect(r.expired).toBeGreaterThanOrEqual(1);
    expect(await planStatus(planId)).toBe('EXPIRED');
    expect(new Set(await slotStatuses(env.db, slots))).toEqual(new Set(['available']));
    const coord = await env.db
      .select()
      .from(outbox)
      .where(and(eq(outbox.episodeId, ep), eq(outbox.template, 'hold_expired_coordinator')));
    expect(coord).toHaveLength(1);
    env.clock.set(t0);
  });
});

describe('Skenario 5 — prioritas klinis berubah setelah hold', () => {
  it('melepas semua hold, REPLAN_REQUIRED, rencana baru disusun, audit tercatat', async () => {
    const ep = await newScenarioEpisode(env, '5');
    const planId = await proposedBest(env, ep);
    await holdPlan(env.ctx(), planId, key());
    const slots = await planSlots(env.db, planId);
    const res = await markPriorityChanged(
      env.ctx(),
      ep,
      { priority: 'segera' },
      'Dokter meminta jadwal lebih cepat',
    );
    expect(await planStatus(planId)).toBe('REPLAN_REQUIRED');
    expect(new Set(await slotStatuses(env.db, slots))).toEqual(new Set(['available']));
    expect(res!.planIds.length).toBeGreaterThan(0);
    const [h] = await env.db.select().from(hold).where(eq(hold.tripPlanId, planId));
    expect(h!.status).toBe('released');
    const actions = await env.db
      .select({ a: auditLog.action })
      .from(auditLog)
      .where(eq(auditLog.entityId, ep));
    expect(actions.map((x) => x.a)).toContain('priority_changed');
    const planActions = await env.db
      .select({ a: auditLog.action })
      .from(auditLog)
      .where(eq(auditLog.entityId, planId));
    expect(planActions.map((x) => x.a)).toEqual(expect.arrayContaining(['proposed', 'hold', 'replan']));
  });

  it('flag mendesak: hold dilepas dan tidak ada rencana otomatis', async () => {
    const ep = await newScenarioEpisode(env, '1');
    const planId = await proposedBest(env, ep);
    await holdPlan(env.ctx(), planId, key());
    const res = await markPriorityChanged(
      env.ctx(),
      ep,
      { urgent: true },
      'Kondisi memburuk, ditangani langsung',
    );
    expect(res!.status).toBe('manual');
    expect(res!.planIds).toEqual([]);
    expect(await planStatus(planId)).toBe('REPLAN_REQUIRED');
  });
});

describe('Skenario 6 — konkurensi: slot terakhir', () => {
  it('20 permintaan paralel atas slot yang sama → tepat satu menang, tanpa double-booking', async () => {
    const eps = await Promise.all(
      Array.from({ length: 20 }, (_, i) => newScenarioEpisode(env, '1', `Race ${i}`)),
    );
    const plans: string[] = [];
    for (const ep of eps) plans.push(await proposedBest(env, ep));
    const slotSets = await Promise.all(plans.map((p) => planSlots(env.db, p)));
    expect(new Set(slotSets.map((s) => s.join()))).toHaveProperty('size', 1); // all contend for identical slots

    const results = await Promise.all(plans.map((p) => holdPlan(env.ctx(), p, key())));
    const winners = results.filter((r) => r.ok);
    expect(winners).toHaveLength(1);
    for (const r of results.filter((r) => !r.ok)) {
      expect(r.ok === false && r.code).toBe('SLOT_TAKEN');
      expect(r.ok === false && r.message).toMatch(/diambil pasien lain/);
      expect(r.ok === false && r.alternatives?.planIds.length).toBeGreaterThan(0);
    }
    const owners = await env.db
      .select({ holdId: slot.holdId })
      .from(slot)
      .where(sql`${slot.id} in ${slotSets[0]!}`);
    expect(new Set(owners.map((o) => o.holdId)).size).toBe(1);
  });
});

describe('Skenario 7 — kegagalan parsial (all-or-nothing)', () => {
  it('reserve gagal di slot kedua → slot pertama dilepas, tidak ada slot yatim', async () => {
    const ep = await newScenarioEpisode(env, '1');
    const planId = await proposedBest(env, ep);
    const slots = await planSlots(env.db, planId);
    env.schedule.setFaults({ failReserveOn: (id) => id === slots[1] });
    const r = await holdPlan(env.ctx(), planId, key());
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.code).toBe('EXTERNAL_FAILED');
    expect(new Set(await slotStatuses(env.db, slots))).toEqual(new Set(['available']));
    expect(await planStatus(planId)).toBe('PROPOSED');
    for (const s of slots) expect(env.schedule.reserved.has(s)).toBe(false);
    const [h] = await env.db.select().from(hold).where(eq(hold.tripPlanId, planId));
    expect(h!.status).toBe('released');
  });

  it('sistem eksternal tidak merespons (timeout) → dianggap gagal, dikompensasi', async () => {
    const ep = await newScenarioEpisode(env, '1');
    const planId = await proposedBest(env, ep);
    const slots = await planSlots(env.db, planId);
    env.schedule.setFaults({ hangReserveOn: (id) => id === slots[0], timeoutMs: 50 });
    const r = await holdPlan(env.ctx(), planId, key());
    expect(r.ok === false && r.message).toMatch(/tidak merespons/);
    expect(new Set(await slotStatuses(env.db, slots))).toEqual(new Set(['available']));
  });

  it('salah satu slot sudah diambil secara lokal → transaksi rollback, tidak ada yang ditahan', async () => {
    const ep = await newScenarioEpisode(env, '1');
    const planId = await proposedBest(env, ep);
    const slots = await planSlots(env.db, planId);
    await env.db.update(slot).set({ status: 'booked', externalBooking: true }).where(eq(slot.id, slots[1]!));
    const r = await holdPlan(env.ctx(), planId, key());
    expect(r.ok === false && r.code).toBe('SLOT_TAKEN');
    expect(await slotStatuses(env.db, [slots[0]!])).toEqual(['available']);
    await env.db
      .update(slot)
      .set({ status: 'available', externalBooking: false })
      .where(eq(slot.id, slots[1]!));
  });

  it('konfirmasi eksternal tidak pasti → tetap HELD (gagal-aman)', async () => {
    const ep = await newScenarioEpisode(env, '1');
    const planId = await proposedBest(env, ep);
    await holdPlan(env.ctx(), planId, key());
    env.schedule.setFaults({ failCommit: true });
    const r = await approvePlan(env.ctx(), planId, key());
    expect(r.confirmed).toBe(false);
    expect(r.blockers[0]!.code).toBe('EXTERNAL_UNCERTAIN');
    expect(await planStatus(planId)).toBe('HELD');
    await releasePlan(env.ctx(), planId, 'Bersihkan data uji', key());
  });
});

describe('Skenario 8 — pagar pengaman rasio hold', () => {
  it('rasio maksimum tercapai → hold ditolak dengan penjelasan dan alternatif', async () => {
    await env.db.update(serviceType).set({ maxHoldRatio: 0.0001 }).where(eq(serviceType.code, 'POLI_PD'));
    try {
      const a = await newScenarioEpisode(env, '1');
      const b = await newScenarioEpisode(env, '1');
      const pa = await proposedBest(env, a);
      const pb = await proposedBest(env, b);
      expect((await holdPlan(env.ctx(), pa, key())).ok).toBe(true);
      // b's option was computed before a held: the guard catches it at hold time.
      const r = await holdPlan(env.ctx(), pb, key());
      expect(r.ok).toBe(false);
      expect(r.ok === false && r.code).toBe('HOLD_CAP');
      expect(r.ok === false && r.message).toMatch(/Batas penahanan/);
      const [poli] = await env.db.select().from(serviceType).where(eq(serviceType.code, 'POLI_PD'));
      const cappedDay = (await env.db.select().from(planVisit).where(eq(planVisit.tripPlanId, pa))).find(
        (v) => v.serviceTypeId === poli!.id,
      )!.localDate;
      // Fresh alternatives avoid the poli day whose hold quota is full.
      const alts = r.ok === false ? (r.alternatives?.planIds ?? []) : [];
      for (const alt of alts) {
        const v = await env.db.select().from(planVisit).where(eq(planVisit.tripPlanId, alt));
        expect(v.some((x) => x.serviceTypeId === poli!.id && x.localDate === cappedDay)).toBe(false);
      }
      await releasePlan(env.ctx(), pa, 'Bersihkan data uji', key());
    } finally {
      await env.db.update(serviceType).set({ maxHoldRatio: 0.3 }).where(eq(serviceType.code, 'POLI_PD'));
    }
  });
});

describe('Skenario 9 — idempotensi', () => {
  it('request hold yang sama dua kali → efek sekali', async () => {
    const ep = await newScenarioEpisode(env, '1');
    const planId = await proposedBest(env, ep);
    const k = key();
    const r1 = await holdPlan(env.ctx(), planId, k);
    const r2 = await holdPlan(env.ctx(), planId, k);
    expect(r2).toEqual(r1);
    expect(await env.db.select().from(hold).where(eq(hold.tripPlanId, planId))).toHaveLength(1);
    const a1 = await approvePlan(env.ctx(), planId, k);
    const a2 = await approvePlan(env.ctx(), planId, k);
    expect(a2).toEqual(a1);
    const confirms = await env.db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityId, planId), eq(auditLog.action, 'confirm')));
    expect(confirms).toHaveLength(1);
  });

  it('request paralel dengan kunci sama → tetap satu efek', async () => {
    const ep = await newScenarioEpisode(env, '1');
    const planId = await proposedBest(env, ep);
    const k = key();
    const settled = await Promise.allSettled([
      holdPlan(env.ctx(), planId, k),
      holdPlan(env.ctx(), planId, k),
    ]);
    expect(settled.filter((s) => s.status === 'fulfilled').length).toBeGreaterThanOrEqual(1);
    expect(await env.db.select().from(hold).where(eq(hold.tripPlanId, planId))).toHaveLength(1);
    await releasePlan(env.ctx(), planId, 'Bersihkan data uji', key());
  });

  it('kunci sama untuk permintaan berbeda ditolak; kunci wajib ada', async () => {
    const ep = await newScenarioEpisode(env, '1');
    const planId = await proposedBest(env, ep);
    const k = key();
    await releasePlan(env.ctx(), planId, 'Alasan pertama', k);
    await expect(releasePlan(env.ctx(), planId, 'Alasan lain sekali', k)).rejects.toMatchObject({
      code: 'IDEMPOTENCY_MISMATCH',
    });
    await expect(holdPlan(env.ctx(), planId, undefined)).rejects.toMatchObject({
      code: 'IDEMPOTENCY_KEY_REQUIRED',
    });
  });
});

describe('Skenario 10 — kedaluwarsa dengan clock yang di-inject', () => {
  it('sebelum TTL tetap HELD; setelah TTL: EXPIRED (cron maupun lazy saat konfirmasi)', async () => {
    const t0 = env.clock.now();
    const ep = await newScenarioEpisode(env, '1');
    const planId = await proposedBest(env, ep);
    await holdPlan(env.ctx(), planId, key());
    env.clock.advance(24 * HOUR - MINUTE);
    expect((await expireDueHolds(env.ctx())).expired).toBe(0);
    expect(await planStatus(planId)).toBe('HELD');
    env.clock.advance(2 * MINUTE);
    // Lazy path: no cron ran; confirmation attempt detects expiry.
    const r = await approvePlan(env.ctx(), planId, key());
    expect(r.confirmed).toBe(false);
    expect(r.blockers.map((b) => b.code)).toEqual(['HOLD_EXPIRED']);
    expect(await planStatus(planId)).toBe('EXPIRED');
    const slots = await planSlots(env.db, planId);
    expect(new Set(await slotStatuses(env.db, slots))).toEqual(new Set(['available']));
    env.clock.set(t0);
  });

  it('perpanjangan manual: alasan wajib, terbatas jumlahnya', async () => {
    const ep = await newScenarioEpisode(env, '1');
    const planId = await proposedBest(env, ep);
    await holdPlan(env.ctx(), planId, key());
    await expect(extendHold(env.ctx(), planId, '', key())).rejects.toMatchObject({ code: 'REASON_REQUIRED' });
    const e1 = await extendHold(env.ctx(), planId, 'Pasien sedang mengurus rujukan', key());
    expect(e1.extensionsCount).toBe(1);
    await extendHold(env.ctx(), planId, 'Masih menunggu puskesmas', key());
    await expect(extendHold(env.ctx(), planId, 'Ketiga kalinya', key())).rejects.toMatchObject({
      code: 'EXTENSION_LIMIT',
    });
    await releasePlan(env.ctx(), planId, 'Bersihkan data uji', key());
  });
});

describe('Keamanan & audit', () => {
  it('audit log append-only di level database', async () => {
    await expect(env.db.execute(sql`update audit_log set reason = 'x'`)).rejects.toThrow();
    await expect(env.db.execute(sql`delete from audit_log`)).rejects.toThrow();
  });

  it('RBAC: admin unit dan pasien tidak bisa menahan jadwal', async () => {
    const ep = await newScenarioEpisode(env, '1');
    const planId = await proposedBest(env, ep);
    await expect(
      holdPlan(
        env.ctx({ type: 'user', id: crypto.randomUUID(), label: 'x', role: 'unit_admin' }),
        planId,
        key(),
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      holdPlan(env.ctx({ type: 'patient', id: ep, label: 'x', role: null }), planId, key()),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await releasePlan(env.ctx(), planId, 'Bersihkan data uji', key());
  });

  it('pasien hanya bisa menyentuh episodenya sendiri', async () => {
    const a = await newScenarioEpisode(env, '2');
    const b = await newScenarioEpisode(env, '2');
    const [docB] = await env.db.select().from(document).where(eq(document.episodeId, b));
    await expect(
      uploadDocument(env.ctx({ type: 'patient', id: a, label: 'x', role: null }), docB!.id, 'x.pdf'),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('pembatalan setelah konfirmasi mengembalikan slot dan tercatat terlambat/tidak', async () => {
    const ep = await newScenarioEpisode(env, '1');
    const planId = await proposedBest(env, ep);
    await holdPlan(env.ctx(), planId, key());
    await approvePlan(env.ctx(), planId, key());
    const r = await cancelPlan(env.ctx(), planId, 'Pasien berhalangan', key());
    expect(r.cancelled).toBe(true);
    expect(await planStatus(planId)).toBe('CANCELLED');
    expect(new Set(await slotStatuses(env.db, await planSlots(env.db, planId)))).toEqual(
      new Set(['available']),
    );
  });

  it('menyusun ulang ditolak saat ada jadwal yang ditahan', async () => {
    const ep = await newScenarioEpisode(env, '1');
    const planId = await proposedBest(env, ep);
    await holdPlan(env.ctx(), planId, key());
    await expect(proposePlans(env.ctx(), ep)).rejects.toMatchObject({ code: 'ACTIVE_PLAN' });
    const [e] = await env.db.select().from(episode).where(eq(episode.id, ep));
    expect(e!.planning?.status).toBe('ok');
    await releasePlan(env.ctx(), planId, 'Bersihkan data uji', key());
  });
});
