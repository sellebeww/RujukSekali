// Deterministic synthetic seed: same (startDate, rngSeed) -> same data. No real patient data, ever.
import { eq } from 'drizzle-orm';
import { createRng } from '@/lib/rng';
import { addDays, dayOfWeek, hhmmToMin, localToUtc, minToHhmm, MINUTE, type Clock } from '@/lib/time';
import { MockScheduleAdapter } from '@/server/adapters/schedule';
import type { Ctx } from '@/server/context';
import { hashPassword } from '@/server/crypto';
import type { Db, Zone } from '@/server/db/client';
import {
  appUser,
  document,
  facility,
  seedMeta,
  serviceType,
  slot,
  transportOption,
  unit,
} from '@/server/db/schema';
import { createLogger } from '@/server/log';
import {
  confirmEscortDays,
  createEpisode,
  uploadDocument,
  verifyDocument,
  type NewEpisode,
} from '@/server/usecases/episodes';
import { approvePlan, holdPlan } from '@/server/usecases/holds';
import { proposePlans } from '@/server/usecases/planning';
import { runScenario } from '@/server/usecases/scenarios';
import { FACILITY, REGENCIES, SERVICE_TYPES, STAFF, TRANSPORT } from './reference';
import { specialDays, type ScenarioId } from './scenarios';

export interface SeedOptions {
  zone: Zone | 'test';
  startDate: string;
  clock: Clock;
  staffPassword: string;
  rngSeed?: number;
  /** Number of random synthetic episodes in addition to the 5 scenario episodes. */
  randomEpisodes?: number;
  days?: number;
}

export async function seedDatabase(db: Db, o: SeedOptions) {
  const rng = createRng(o.rngSeed ?? 20261020);
  const days = o.days ?? 30;

  const [fac] = await db.insert(facility).values(FACILITY).returning();
  const { busyPoli, busyLab } = specialDays(o.startDate);

  const slotRows: (typeof slot.$inferInsert)[] = [];
  for (const st of SERVICE_TYPES) {
    const { units, open, ...fields } = st;
    const [row] = await db
      .insert(serviceType)
      .values({ ...fields, holdTtlMinutes: { ...fields.holdTtlMinutes } })
      .returning();
    for (const u of units) {
      const [un] = await db
        .insert(unit)
        .values({ facilityId: fac!.id, serviceTypeId: row!.id, ...u })
        .returning();
      for (let d = 0; d < days; d++) {
        const date = addDays(o.startDate, d);
        if (!(open.days as readonly number[]).includes(dayOfWeek(date))) continue;
        const load = 0.3 + rng.next() * 0.4; // background bookings by the hospital's own patients
        for (let m = hhmmToMin(open.from); m + st.durationMin <= hhmmToMin(open.to); m += st.durationMin) {
          const hhmm = minToHhmm(m);
          const startsAt = localToUtc(date, hhmm);
          const forcedFull =
            (st.code === 'POLI_PD' && date === busyPoli && m >= hhmmToMin('10:00')) ||
            (st.code === 'LAB_DARAH' && date === busyLab);
          const external = forcedFull || rng.chance(load);
          slotRows.push({
            unitId: un!.id,
            serviceTypeId: row!.id,
            startsAt: new Date(startsAt),
            endsAt: new Date(startsAt + st.durationMin * MINUTE),
            localDate: date,
            status: external ? 'booked' : 'available',
            externalBooking: external,
          });
        }
      }
    }
  }
  for (let i = 0; i < slotRows.length; i += 500) await db.insert(slot).values(slotRows.slice(i, i + 500));
  await db.insert(transportOption).values(TRANSPORT);

  const pw = await hashPassword(o.staffPassword);
  const users = await db
    .insert(appUser)
    .values(STAFF.map((s) => ({ ...s, passwordHash: pw })))
    .returning();
  const coordinator = users.find((u) => u.role === 'coordinator')!;
  await db.insert(seedMeta).values({
    id: 1,
    startDate: o.startDate,
    seededAt: new Date(o.clock.now()),
    rngSeed: o.rngSeed ?? 20261020,
  });

  const ctx: Ctx = {
    db,
    zone: o.zone,
    clock: o.clock,
    schedule: new MockScheduleAdapter(),
    log: createLogger({ zone: o.zone }, () => {}),
    actor: { type: 'user', id: coordinator.id, label: coordinator.name, role: 'coordinator' },
    correlationId: 'seed',
  };

  const n = o.randomEpisodes ?? 35;
  for (let i = 1; i <= n; i++) {
    const r = rng.pick(REGENCIES);
    const escort = rng.chance(0.3);
    const startOffset = rng.int(1, 6);
    const earliest = addDays(o.startDate, startOffset);
    const docRoll = rng.next();
    const docStatus = docRoll < 0.5 ? 'verified' : docRoll < 0.75 ? 'uploaded' : 'missing';
    const label = `Pasien A-${String(i).padStart(3, '0')}`;
    const data: NewEpisode = {
      title: rng.pick([
        'Pemeriksaan lanjutan penyakit dalam',
        'Kontrol hasil lab dan konsultasi',
        'Evaluasi rujukan dari puskesmas',
      ]),
      patient: {
        pseudonym: label,
        originRegency: r.name,
        distanceKm: r.distanceKm,
        travelMinutes: r.travelMinutes,
        mobilityNeeds: rng.chance(0.15) ? ['kursi roda'] : [],
      },
      serviceCodes: ['LAB_DARAH', 'POLI_PD'],
      earliestDate: earliest,
      latestDate: addDays(earliest, rng.int(6, 14)),
      priority: rng.chance(0.2) ? 'segera' : 'rutin',
      urgent: rng.chance(0.04),
      requiresEscort: escort,
      ...(escort
        ? {
            escort: {
              pseudonym: `Pendamping A-${String(i).padStart(3, '0')}`,
              relation: rng.pick(['anak', 'pasangan', 'saudara']),
              windows: Array.from({ length: 14 }, (_, k) => addDays(earliest, k))
                .filter(() => rng.chance(0.55))
                .map((localDate) => ({ localDate, fromLocal: '05:00', toLocal: '20:00' })),
            },
          }
        : {}),
      holdTier: rng.pick(['singkat', 'standar', 'standar', 'panjang'] as const),
      includeLostIncome: true,
      documents: [
        {
          kind: 'surat_rujukan',
          label: 'Surat rujukan',
          status: docStatus,
          ...(docStatus === 'verified' ? { validUntil: addDays(o.startDate, 60) } : {}),
        },
      ],
    };
    const { episodeId } = await createEpisode(ctx, data);
    if (data.urgent) continue;
    const stage = rng.next();
    if (stage < 0.3) continue;
    const proposal = await proposePlans(ctx, episodeId);
    const best = proposal.planIds[0];
    if (!best || stage < 0.55) continue;
    const held = await holdPlan(ctx, best, crypto.randomUUID());
    if (!held.ok || stage < 0.8) continue;
    const [doc] = await db.select().from(document).where(eq(document.episodeId, episodeId));
    if (doc && doc.status !== 'verified') {
      if (doc.status === 'missing') await uploadDocument(ctx, doc.id, 'surat-rujukan.pdf');
      await verifyDocument(ctx, doc.id);
    }
    if (escort) await confirmEscortDays(ctx, episodeId).catch(() => null);
    await approvePlan(ctx, best, crypto.randomUUID());
  }
  // Scenarios last, so their proposed options reflect the final synthetic state.
  // The five acceptance scenarios, each at a meaningful stage for the coordinator queue.
  const stages: Record<ScenarioId, 'susun' | 'tahan' | 'konfirmasi'> = {
    '1': 'susun',
    '2': 'tahan',
    '3': 'tahan',
    '4': 'susun',
    '5': 'tahan',
  };
  // Held scenarios first, then proposal-only ones, so the latter are not invalidated by the former.
  for (const id of ['2', '3', '5', '1', '4'] as ScenarioId[]) {
    await runScenario(ctx, id, stages[id], `Pasien S${id}`);
  }

  return { coordinatorId: coordinator.id };
}
