import type { PlanStatus } from '@/domain/tripPlan';

export const PLAN_TONE: Record<PlanStatus, 'teal' | 'ochre' | 'leaf' | 'clay' | 'neutral' | 'danger'> = {
  DRAFT: 'neutral',
  PROPOSED: 'teal',
  HELD: 'ochre',
  CONFIRMED: 'leaf',
  COMPLETED: 'leaf',
  EXPIRED: 'neutral',
  RELEASED: 'neutral',
  CANCELLED: 'danger',
  REPLAN_REQUIRED: 'clay',
};

export const DOC_LABEL = {
  missing: 'Belum ada',
  uploaded: 'Sudah diunggah, menunggu verifikasi',
  verified: 'Terverifikasi',
  expired: 'Tidak berlaku',
} as const;

export const DOC_TONE = {
  missing: 'danger',
  uploaded: 'ochre',
  verified: 'leaf',
  expired: 'danger',
} as const;

export const AUDIT_LABEL: Record<string, string> = {
  created: 'Episode dibuat',
  planned: 'Mesin menyusun opsi',
  proposed: 'Opsi disusun',
  superseded: 'Opsi lama diganti',
  hold: 'Jadwal ditahan',
  activated: 'Penahanan aktif',
  hold_rejected: 'Penahanan ditolak',
  hold_compensated: 'Penahanan dibatalkan otomatis (kompensasi)',
  approved: 'Disetujui koordinator',
  confirm: 'Terkonfirmasi',
  converted: 'Penahanan menjadi pemesanan',
  release: 'Rencana dilepas',
  released: 'Penahanan dilepas',
  expire: 'Penahanan berakhir',
  expired: 'Waktu penahanan habis',
  extended: 'Penahanan diperpanjang',
  cancel: 'Dibatalkan',
  complete: 'Selesai',
  replan: 'Perlu disusun ulang',
  priority_changed: 'Prioritas klinis diubah',
  uploaded: 'Dokumen diunggah',
  verified: 'Dokumen diverifikasi',
  rejected: 'Dokumen dikembalikan',
  escort_confirmed: 'Pendamping konfirmasi',
  escort_cancelled: 'Pendamping batal',
  patient_link_issued: 'Tautan pasien dibuat',
  patient_links_revoked: 'Tautan pasien dicabut',
  reschedule_requested: 'Pasien minta ubah jadwal',
};

export const TIER_LABEL = {
  singkat: 'Singkat (2 jam)',
  standar: 'Standar (24 jam)',
  panjang: 'Panjang (48 jam)',
} as const;
