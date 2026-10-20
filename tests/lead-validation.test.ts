import { describe, expect, it } from 'vitest';
import { leadSchema } from '@/server/usecases/leads';

const ok = {
  name: 'Dr. Contoh',
  organization: 'RS Uji Coba',
  role: 'Kepala Instalasi',
  contactChannel: 'email' as const,
  contactValue: 'contoh@rs-uji.test',
  need: 'Kami ingin mengurangi pasien rujukan yang bolak-balik.',
  consent: true as const,
};

describe('validasi formulir minta demo', () => {
  it('menerima isian valid', () => expect(leadSchema.safeParse(ok).success).toBe(true));
  it('persetujuan wajib', () => expect(leadSchema.safeParse({ ...ok, consent: false }).success).toBe(false));
  it('email harus valid', () =>
    expect(leadSchema.safeParse({ ...ok, contactValue: 'bukan-email' }).success).toBe(false));
  it('menolak data pasien (NIK / rekam medis / diagnosis)', () => {
    for (const need of [
      'Pasien kami NIK 3201234567890123 perlu dibantu',
      'Lampirkan no RM 1234 pasien',
      'Diagnosis pasien diabetes tipe 2',
    ]) {
      const r = leadSchema.safeParse({ ...ok, need });
      expect(r.success).toBe(false);
    }
  });
  it('WhatsApp harus berupa nomor', () => {
    expect(
      leadSchema.safeParse({ ...ok, contactChannel: 'whatsapp', contactValue: '+62 812-0000-0000' }).success,
    ).toBe(true);
    expect(leadSchema.safeParse({ ...ok, contactChannel: 'whatsapp', contactValue: 'halo' }).success).toBe(
      false,
    );
  });
});
