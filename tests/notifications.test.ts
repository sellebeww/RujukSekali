import { describe, expect, it } from 'vitest';
import { render, type Notice } from '@/server/notifications';
import { SERVICE_TYPES } from '@seed/reference';

const visits = [
  {
    startsAt: Date.parse('2026-11-03T00:30:00Z'),
    localDate: '2026-11-03',
    location: 'Gedung A, Lantai 1, Loket 3',
    fasting: true,
  },
  {
    startsAt: Date.parse('2026-11-03T04:00:00Z'),
    localDate: '2026-11-03',
    location: 'Gedung B, Lantai 2, Ruang 204',
    fasting: false,
  },
];

const all: Notice[] = [
  {
    template: 'plan_held',
    episodeId: 'e',
    visits,
    expiresAt: Date.parse('2026-11-02T10:00:00Z'),
    pendingItems: ['Surat rujukan'],
  },
  { template: 'plan_confirmed', episodeId: 'e', visits, facility: 'RS Contoh Nusantara' },
  { template: 'plan_released', episodeId: 'e' },
  { template: 'hold_expired_patient', episodeId: 'e' },
  { template: 'hold_expired_coordinator', episodeId: 'e', patientLabel: 'Pasien A-001' },
  { template: 'replan_coordinator', episodeId: 'e', patientLabel: 'Pasien A-001' },
  { template: 'patient_request_coordinator', episodeId: 'e', patientLabel: 'Pasien A-001' },
  { template: 'lead_received', leadId: 'l', organization: 'RS X' },
];

// Words that would reveal a service, specialty or clinical detail.
const forbidden = [
  ...SERVICE_TYPES.flatMap((s) => [s.name, s.shortName]),
  'penyakit dalam',
  'darah',
  'laboratorium',
  'diagnosis',
  'poli',
  'dokter',
];

describe('isi notifikasi tanpa detail klinis', () => {
  it.each(all.map((n) => [n.template, n] as const))(
    '%s hanya memuat waktu, tempat, instruksi umum',
    (_t, n) => {
      const r = render(n);
      const text = `${r.subject}\n${r.body}`.toLowerCase();
      for (const w of forbidden) expect(text).not.toContain(w.toLowerCase());
    },
  );
  it('instruksi puasa disertakan bila aturan layanan memintanya', () => {
    expect(render(all[1]!).body).toContain('puasa');
    expect(render(all[0]!).body).toMatch(/07:30 WIB di Gedung A/);
  });
});
