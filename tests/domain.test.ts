import { describe, expect, it } from 'vitest';
import {
  ACTIVE,
  allTransitions,
  canTransition,
  confirmationBlockers,
  InvalidTransitionError,
  PLAN_STATUSES,
  TERMINAL,
  transition,
  type ConfirmationContext,
} from '@/domain/tripPlan';

describe('state machine TripPlan', () => {
  it('jalur utama DRAFT → PROPOSED → HELD → CONFIRMED → COMPLETED', () => {
    let s = transition('DRAFT', 'propose');
    s = transition(s, 'hold');
    s = transition(s, 'confirm');
    expect(transition(s, 'complete')).toBe('COMPLETED');
  });

  it('jalur samping sesuai spesifikasi', () => {
    expect(transition('HELD', 'expire')).toBe('EXPIRED');
    expect(transition('HELD', 'release')).toBe('RELEASED');
    expect(transition('CONFIRMED', 'cancel')).toBe('CANCELLED');
    for (const s of ACTIVE) expect(transition(s, 'replan')).toBe('REPLAN_REQUIRED');
  });

  it('menolak transisi yang tidak valid', () => {
    expect(() => transition('PROPOSED', 'confirm')).toThrow(InvalidTransitionError);
    expect(() => transition('EXPIRED', 'hold')).toThrow(InvalidTransitionError);
    expect(canTransition('CONFIRMED', 'expire')).toBe(false);
  });

  it('status terminal tidak punya transisi keluar', () => {
    expect([...TERMINAL].sort()).toEqual([
      'CANCELLED',
      'COMPLETED',
      'EXPIRED',
      'RELEASED',
      'REPLAN_REQUIRED',
    ]);
    for (const t of allTransitions()) expect(TERMINAL.has(t.from)).toBe(false);
    expect(PLAN_STATUSES).toHaveLength(9);
  });
});

describe('penjaga konfirmasi (gagal-aman)', () => {
  const ok: ConfirmationContext = {
    status: 'HELD',
    holdExpiresAt: 2000,
    now: 1000,
    urgent: false,
    documents: [
      { kind: 'surat_rujukan', label: 'Surat rujukan', status: 'verified', validUntil: '2026-12-31' },
    ],
    lastVisitDate: '2026-11-03',
    requiresEscort: true,
    escortConfirmedForAllDays: true,
    transportFeasible: true,
    approvedByCoordinator: true,
    externalUncertain: false,
  };
  it('boleh konfirmasi bila semua syarat penting terpenuhi', () => {
    expect(confirmationBlockers(ok)).toEqual([]);
  });
  it.each([
    [
      'dokumen belum verified',
      { documents: [{ ...ok.documents[0]!, status: 'uploaded' as const }] },
      'DOCUMENT_NOT_VERIFIED',
    ],
    [
      'dokumen habis sebelum kunjungan',
      { documents: [{ ...ok.documents[0]!, validUntil: '2026-11-01' }] },
      'DOCUMENT_EXPIRES',
    ],
    ['hold kedaluwarsa', { now: 2000 }, 'HOLD_EXPIRED'],
    ['pendamping belum konfirmasi', { escortConfirmedForAllDays: false }, 'ESCORT_NOT_CONFIRMED'],
    ['belum disetujui', { approvedByCoordinator: false }, 'NOT_APPROVED'],
    ['status eksternal tidak pasti', { externalUncertain: true }, 'EXTERNAL_UNCERTAIN'],
    ['mendesak', { urgent: true }, 'URGENT'],
    ['bukan HELD', { status: 'PROPOSED' as const }, 'NOT_HELD'],
  ])('%s → diblokir', (_n, over, code) => {
    expect(confirmationBlockers({ ...ok, ...over }).map((b) => b.code)).toContain(code);
  });
});
