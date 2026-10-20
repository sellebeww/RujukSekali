import { describe, expect, it } from 'vitest';
import { planTrips, hardConstraintViolations } from '@/engine';
import { addDays, formatLocalTime, MINUTE } from '@/lib/time';
import { D, LAB, POLI, input, slots } from './fixtures';

describe('Skenario 1 — jalur ideal', () => {
  it('menyusun 1 hari kunjungan: lab pagi (puasa), poli setelah hasil siap', () => {
    const inp = input({ slots: [...slots(LAB, D, '07:00', '11:00'), ...slots(POLI, D, '08:00', '15:00')] });
    const res = planTrips(inp);
    expect(res.status).toBe('ok');
    const best = res.plans[0]!;
    expect(best.visitDays).toBe(1);
    expect(best.trips).toHaveLength(1);
    const [lab, poli] = best.visits;
    expect(lab!.serviceCode).toBe('LAB_DARAH');
    expect(formatLocalTime(lab!.startsAt)).toBe('07:30'); // bus arrives 07:00 + 30 min buffer
    expect(poli!.startsAt).toBeGreaterThanOrEqual(lab!.endsAt + 180 * MINUTE);
    expect(hardConstraintViolations(inp, best)).toEqual([]);
    expect(best.explanation[0]).toContain('Cukup 1 kali datang');
    expect(best.explanation.join(' ')).toContain('puasa');
  });

  it('deterministik: input sama → output sama', () => {
    const inp = input({ slots: [...slots(LAB, D, '07:00', '11:00'), ...slots(POLI, D, '08:00', '15:00')] });
    expect(JSON.stringify(planTrips(inp))).toBe(JSON.stringify(planTrips(inp)));
  });

  it('tidak menjadwalkan lab puasa terlalu siang', () => {
    const inp = input({ slots: [...slots(LAB, D, '10:30', '13:00'), ...slots(POLI, D, '08:00', '17:00')] });
    const res = planTrips(inp);
    expect(res.status).toBe('no_plan');
    expect(res.rejections[0]!.code).toBe('FASTING_TOO_LATE');
  });
});

describe('Skenario 3 — pendamping tidak tersedia di hari terbaik', () => {
  it('memilih hari lain dalam jendela pendamping dan menjelaskan alasannya', () => {
    const days = [D, addDays(D, 1), addDays(D, 2)];
    const all = days.flatMap((d) => [
      ...slots(LAB, d, '07:00', '11:00'),
      ...slots(POLI, d, '08:00', '15:00'),
    ]);
    const inp = input({
      requiresEscort: true,
      slots: all,
      escortWindows: [{ localDate: addDays(D, 2), fromLocal: '06:00', toLocal: '17:00' }],
    });
    const res = planTrips(inp);
    const best = res.plans[0]!;
    expect(best.visits.every((v) => v.localDate === addDays(D, 2))).toBe(true);
    expect(best.travellers).toBe(2);
    expect(res.notes.join(' ')).toMatch(/Pendamping belum tersedia/);
    expect(hardConstraintViolations(inp, best)).toEqual([]);
  });

  it('menolak dengan alasan spesifik bila pendamping tidak pernah tersedia', () => {
    const inp = input({
      requiresEscort: true,
      slots: [...slots(LAB, D, '07:00', '11:00'), ...slots(POLI, D, '08:00', '15:00')],
    });
    const res = planTrips(inp);
    expect(res.status).toBe('no_plan');
    expect(res.rejections.map((r) => r.code)).toContain('NO_ESCORT');
  });
});

describe('Skenario 4 — poli penuh di hari yang sama dengan lab', () => {
  const D1 = addDays(D, 1);
  const inp = input({
    earliestDate: D,
    latestDate: D1,
    slots: [
      ...slots(LAB, D, '07:00', '11:00'),
      ...slots(POLI, D, '08:00', '09:40'), // only before lab results could be ready
      ...slots(POLI, D1, '08:00', '15:00'),
    ],
  });
  const res = planTrips(inp);

  it('menawarkan 2 hari berurutan: menginap vs 2 perjalanan terpisah, dan membandingkannya', () => {
    expect(res.status).toBe('ok');
    const twoDay = res.plans.filter((p) => p.visitDays === 2);
    const strategies = twoDay.map((p) => p.strategy[0]).sort();
    expect(strategies).toEqual(['menginap', 'pulang']);
    const lodging = twoDay.find((p) => p.strategy[0] === 'menginap')!;
    expect(lodging.cost.lodgingIdr).toBe(250_000);
    expect(lodging.trips).toHaveLength(1);
    expect(twoDay.find((p) => p.strategy[0] === 'pulang')!.trips).toHaveLength(2);
    for (const p of twoDay) expect(p.explanation.join(' ')).toContain('Perbandingan');
    for (const p of res.plans) expect(hardConstraintViolations(inp, p)).toEqual([]);
  });

  it('menjelaskan kenapa tidak bisa 1 hari', () => {
    expect(res.notes.join(' ')).toMatch(
      /tidak ada jadwal Konsultasi Poli Penyakit Dalam yang kosong setelah hasil/,
    );
  });
});

describe('Penolakan dan pagar pengaman', () => {
  it('episode mendesak tidak dijadwalkan otomatis', () => {
    const res = planTrips(input({ urgent: true, slots: slots(LAB, D, '07:00', '11:00') }));
    expect(res.status).toBe('manual');
    expect(res.plans).toHaveLength(0);
    expect(res.rejections[0]!.code).toBe('URGENT_MANUAL');
  });

  it('melewati hari yang kuota penahanannya penuh dan menjelaskannya', () => {
    const D1 = addDays(D, 1);
    const all = [D, D1].flatMap((d) => [
      ...slots(LAB, d, '07:00', '11:00'),
      ...slots(POLI, d, '08:00', '15:00'),
    ]);
    const res = planTrips(input({ slots: all, holdCapReached: [{ serviceCode: 'POLI_PD', localDate: D }] }));
    expect(res.plans[0]!.visits[0]!.localDate).toBe(D1);
    expect(res.notes.join(' ')).toMatch(/Kuota penahanan/);
  });

  it('memberi opsi terdekat di luar jendela bila tidak ada rencana', () => {
    const later = addDays(D, 10);
    const res = planTrips(
      input({
        latestDate: addDays(D, 2),
        slots: [...slots(LAB, later, '07:00', '11:00'), ...slots(POLI, later, '08:00', '15:00')],
      }),
    );
    expect(res.status).toBe('no_plan');
    expect(res.rejections.map((r) => r.code)).toEqual([
      'NO_SLOTS_IN_WINDOW',
      'NO_SLOTS_IN_WINDOW',
      'NEAREST_OUTSIDE_WINDOW',
    ]);
  });

  it('menolak siklus aturan urutan', () => {
    const res = planTrips(
      input({
        precedence: [
          { before: 'LAB_DARAH', after: 'POLI_PD', minGapMin: 0 },
          { before: 'POLI_PD', after: 'LAB_DARAH', minGapMin: 0 },
        ],
      }),
    );
    expect(res.rejections[0]!.code).toBe('INVALID_INPUT');
  });

  it('transportasi yang tiba terlambat membuat lab puasa tidak mungkin', () => {
    const res = planTrips(
      input({
        transport: [{ ...input().transport[0]!, id: 'siang', arriveLocal: '10:00', departLocal: '07:00' }],
        slots: [...slots(LAB, D, '07:00', '11:00'), ...slots(POLI, D, '08:00', '15:00')],
      }),
    );
    expect(res.status).toBe('no_plan');
    expect(res.rejections[0]!.code).toBe('TRANSPORT_TIMING');
  });
});
