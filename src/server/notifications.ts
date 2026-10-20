// Simulated notifications (dev inbox). Content rule: time, place and general instructions only — never the
// service/specialty name or any clinical detail. Enforced by tests/notifications.test.ts.
import { brand } from '@/config/brand.config';
import { formatLocalDate, formatLocalTime, toLocalDate } from '@/lib/time';
import type { Ctx } from './context';
import type { Executor } from './db/client';
import { outbox } from './db/schema';

export interface NoticeVisit {
  startsAt: number;
  localDate: string;
  location: string;
  fasting: boolean;
}

export type Notice =
  | {
      template: 'plan_held';
      episodeId: string;
      visits: NoticeVisit[];
      expiresAt: number;
      pendingItems: string[];
    }
  | { template: 'plan_confirmed'; episodeId: string; visits: NoticeVisit[]; facility: string }
  | { template: 'plan_released'; episodeId: string }
  | { template: 'hold_expired_patient'; episodeId: string }
  | { template: 'hold_expired_coordinator'; episodeId: string; patientLabel: string }
  | { template: 'replan_coordinator'; episodeId: string; patientLabel: string }
  | { template: 'patient_request_coordinator'; episodeId: string; patientLabel: string }
  | { template: 'lead_received'; leadId: string; organization: string };

function schedule(visits: NoticeVisit[]): string {
  return [...visits]
    .sort((a, b) => a.startsAt - b.startsAt)
    .map(
      (v) => `• ${formatLocalDate(v.localDate)}, pukul ${formatLocalTime(v.startsAt)} WIB di ${v.location}`,
    )
    .join('\n');
}

export function render(n: Notice): {
  recipient: string;
  subject: string;
  body: string;
  episodeId: string | null;
} {
  const sig = `\n\n— ${brand.name}. Pesan ini simulasi; tidak dikirim ke nomor mana pun.`;
  const fasting = (v: NoticeVisit[]) =>
    v.some((x) => x.fasting) ? '\nDatang dalam keadaan puasa sesuai petunjuk petugas.' : '';
  switch (n.template) {
    case 'plan_held':
      return {
        recipient: `pasien:${n.episodeId}`,
        episodeId: n.episodeId,
        subject: 'Jadwal Anda sedang ditahan sementara',
        body:
          `Kami menahan jadwal berikut untuk Anda sampai ${formatLocalDate(toLocalDate(n.expiresAt))} pukul ${formatLocalTime(n.expiresAt)} WIB:\n` +
          schedule(n.visits) +
          (n.pendingItems.length ? `\nYang masih perlu dilengkapi: ${n.pendingItems.join(', ')}.` : '') +
          fasting(n.visits) +
          '\nBuka tautan dari petugas untuk melihat rincian.' +
          sig,
      };
    case 'plan_confirmed':
      return {
        recipient: `pasien:${n.episodeId}`,
        episodeId: n.episodeId,
        subject: 'Jadwal Anda sudah pasti',
        body: `Jadwal kunjungan Anda di ${n.facility} sudah dikonfirmasi:\n${schedule(n.visits)}${fasting(n.visits)}\nBawa kartu identitas dan dokumen asli.${sig}`,
      };
    case 'plan_released':
      return {
        recipient: `pasien:${n.episodeId}`,
        episodeId: n.episodeId,
        subject: 'Jadwal sementara Anda dilepas',
        body: `Jadwal yang sempat ditahan untuk Anda sudah dilepas. Petugas akan menghubungi Anda untuk jadwal baru.${sig}`,
      };
    case 'hold_expired_patient':
      return {
        recipient: `pasien:${n.episodeId}`,
        episodeId: n.episodeId,
        subject: 'Waktu penahanan jadwal berakhir',
        body: `Waktu penahanan jadwal Anda sudah berakhir karena persyaratan belum lengkap. Petugas akan menyusun jadwal baru bersama Anda.${sig}`,
      };
    case 'hold_expired_coordinator':
      return {
        recipient: 'koordinator',
        episodeId: n.episodeId,
        subject: `Penahanan jadwal berakhir: ${n.patientLabel}`,
        body: `Penahanan jadwal untuk ${n.patientLabel} berakhir dan slot sudah dikembalikan. Perlu disusun ulang.${sig}`,
      };
    case 'replan_coordinator':
      return {
        recipient: 'koordinator',
        episodeId: n.episodeId,
        subject: `Perlu disusun ulang: ${n.patientLabel}`,
        body: `Rencana untuk ${n.patientLabel} perlu disusun ulang. Semua jadwal yang ditahan sudah dilepas.${sig}`,
      };
    case 'patient_request_coordinator':
      return {
        recipient: 'koordinator',
        episodeId: n.episodeId,
        subject: `Permintaan ubah jadwal: ${n.patientLabel}`,
        body: `${n.patientLabel} meminta perubahan jadwal. Lihat detail episode.${sig}`,
      };
    case 'lead_received':
      return {
        recipient: 'system_admin',
        episodeId: null,
        subject: `Permintaan demo baru: ${n.organization}`,
        body: `Ada permintaan demo/pilot baru dari ${n.organization}. Lihat panel admin.${sig}`,
      };
  }
}

export async function notify(ex: Executor, ctx: Ctx, n: Notice) {
  const r = render(n);
  await ex.insert(outbox).values({
    channel: 'simulasi',
    recipientRef: r.recipient,
    template: n.template,
    subject: r.subject,
    body: r.body,
    episodeId: r.episodeId,
    createdAt: new Date(ctx.clock.now()),
  });
}
