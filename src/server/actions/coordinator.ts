'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { links } from '@/config/links';
import { formatLocalDate, formatLocalTime, toLocalDate } from '@/lib/time';
import { DomainError } from '../errors';
import {
  createEpisode,
  issuePatientToken,
  markDocumentExpired,
  rejectDocument,
  resolvePatientRequest,
  revokePatientTokens,
  uploadDocument,
  verifyDocument,
} from '../usecases/episodes';
import {
  approvePlan,
  cancelPlan,
  completePlan,
  extendHold,
  holdPlan,
  markPriorityChanged,
  releasePlan,
  type ConfirmOutcome,
} from '../usecases/holds';
import { proposePlans, type ProposalOutcome } from '../usecases/planning';
import { parseZone, run, staffCtx, type ActionState } from './ctx';

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '');
const refresh = (zone: 'app' | 'demo') => revalidatePath(zone === 'demo' ? '/demo' : '/app', 'layout');

function proposalMessage(p: ProposalOutcome): ActionState {
  if (p.status === 'manual')
    return {
      ok: false,
      message: 'Episode mendesak: tidak disusun otomatis.',
      details: p.rejections.map((r) => r.message),
    };
  if (p.planIds.length === 0)
    return {
      ok: false,
      message: 'Belum ada rencana yang memenuhi semua syarat.',
      details: p.rejections.map((r) => r.message),
    };
  return { ok: true, message: `${p.planIds.length} opsi rencana disusun.`, details: p.notes };
}

function confirmMessage(c: ConfirmOutcome | null, okText: string): ActionState {
  if (!c) return { ok: true, message: okText };
  if (c.confirmed) return { ok: true, message: 'Semua syarat terpenuhi — jadwal terkonfirmasi.' };
  return {
    ok: true,
    message: `${okText} Jadwal tetap ditahan sampai syarat lengkap:`,
    details: c.blockers.map((b) => b.message),
  };
}

export async function proposeAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const zone = parseZone(fd.get('zone'));
    const res = await proposePlans(await staffCtx(zone), str(fd, 'episodeId'));
    refresh(zone);
    return proposalMessage(res);
  });
}

export async function holdAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const zone = parseZone(fd.get('zone'));
    const res = await holdPlan(await staffCtx(zone), str(fd, 'planId'), str(fd, 'idempotencyKey'));
    refresh(zone);
    if (res.ok) {
      return {
        ok: true,
        message: `Jadwal ditahan sampai ${formatLocalDate(toLocalDate(Date.parse(res.expiresAt)))} ${formatLocalTime(Date.parse(res.expiresAt))} WIB.`,
      };
    }
    return { ok: false, message: res.message, details: res.alternatives?.notes };
  });
}

export async function approveAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const zone = parseZone(fd.get('zone'));
    const res = await approvePlan(await staffCtx(zone), str(fd, 'planId'), str(fd, 'idempotencyKey'));
    refresh(zone);
    return confirmMessage(res, 'Rencana disetujui.');
  });
}

export async function releaseAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const zone = parseZone(fd.get('zone'));
    const r = await releasePlan(
      await staffCtx(zone),
      str(fd, 'planId'),
      str(fd, 'reason'),
      str(fd, 'idempotencyKey'),
    );
    refresh(zone);
    return { ok: true, message: `Rencana dilepas. ${r.slots} slot kembali tersedia untuk pasien lain.` };
  });
}

export async function extendAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const zone = parseZone(fd.get('zone'));
    const r = await extendHold(
      await staffCtx(zone),
      str(fd, 'planId'),
      str(fd, 'reason'),
      str(fd, 'idempotencyKey'),
    );
    refresh(zone);
    return { ok: true, message: `Penahanan diperpanjang (${r.extensionsCount}/${r.maxExtensions}).` };
  });
}

export async function cancelAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const zone = parseZone(fd.get('zone'));
    const r = await cancelPlan(
      await staffCtx(zone),
      str(fd, 'planId'),
      str(fd, 'reason'),
      str(fd, 'idempotencyKey'),
    );
    refresh(zone);
    return {
      ok: true,
      message: r.late
        ? 'Dibatalkan (pembatalan terlambat tercatat).'
        : 'Jadwal dibatalkan; slot kembali tersedia.',
    };
  });
}

export async function completeAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const zone = parseZone(fd.get('zone'));
    await completePlan(await staffCtx(zone), str(fd, 'planId'));
    refresh(zone);
    return { ok: true, message: 'Episode ditandai selesai.' };
  });
}

export async function priorityAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const zone = parseZone(fd.get('zone'));
    const priority = str(fd, 'priority') === 'segera' ? 'segera' : 'rutin';
    const urgent = fd.get('urgent') === 'on';
    const res = await markPriorityChanged(
      await staffCtx(zone),
      str(fd, 'episodeId'),
      { priority, urgent },
      str(fd, 'reason'),
    );
    refresh(zone);
    if (urgent)
      return {
        ok: true,
        message: 'Ditandai mendesak. Semua jadwal dilepas; tangani langsung di luar sistem.',
      };
    const m = res ? proposalMessage(res) : { ok: true, message: '' };
    return { ...m, message: `Semua jadwal yang ditahan dilepas. ${m.message}` };
  });
}

export async function docAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const zone = parseZone(fd.get('zone'));
    const ctx = await staffCtx(zone);
    const docId = str(fd, 'documentId');
    const op = str(fd, 'op');
    let out: ActionState;
    if (op === 'verify') out = confirmMessage(await verifyDocument(ctx, docId), 'Dokumen diverifikasi.');
    else if (op === 'reject') {
      await rejectDocument(ctx, docId, str(fd, 'reason') || 'Dokumen tidak terbaca');
      out = { ok: true, message: 'Dokumen dikembalikan ke pasien untuk diunggah ulang.' };
    } else if (op === 'expire') {
      await markDocumentExpired(ctx, docId);
      out = { ok: true, message: 'Dokumen ditandai tidak berlaku.' };
    } else if (op === 'upload') {
      await uploadDocument(ctx, docId, 'diterima-di-loket.pdf');
      out = { ok: true, message: 'Dokumen dicatat diterima (unggah oleh petugas).' };
    } else throw new DomainError('BAD_OP', 'Aksi tidak dikenal.', 400);
    refresh(zone);
    return out;
  });
}

export async function patientLinkAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const zone = parseZone(fd.get('zone'));
    const ctx = await staffCtx(zone);
    const episodeId = str(fd, 'episodeId');
    if (str(fd, 'op') === 'revoke') {
      await revokePatientTokens(ctx, episodeId);
      return { ok: true, message: 'Semua tautan pasien untuk episode ini dicabut.' };
    }
    const { token, expiresAt } = await issuePatientToken(ctx, episodeId);
    const url = zone === 'demo' ? links.demo.patient(token) : links.patient.absoluteAccess(token);
    return {
      ok: true,
      message: `Tautan baru berlaku sampai ${formatLocalDate(toLocalDate(Date.parse(expiresAt)))}. Salin sekarang — tautan hanya ditampilkan sekali.`,
      secret: url,
    };
  });
}

export async function resolveRequestAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const zone = parseZone(fd.get('zone'));
    await resolvePatientRequest(await staffCtx(zone), str(fd, 'requestId'));
    refresh(zone);
    return { ok: true, message: 'Permintaan ditandai selesai.' };
  });
}

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal tidak valid');
const newEpisodeSchema = z
  .object({
    pseudonym: z.string().trim().min(2, 'Isi nama samaran/inisial').max(40),
    nationalId: z
      .string()
      .trim()
      .regex(/^(\d{16})?$/, 'NIK harus 16 digit atau dikosongkan'),
    originRegency: z.string().min(2),
    distanceKm: z.coerce.number().int().min(1).max(2000),
    travelMinutes: z.coerce.number().int().min(10).max(2000),
    wheelchair: z.boolean(),
    title: z.string().trim().min(3).max(80),
    serviceCodes: z.array(z.enum(['LAB_DARAH', 'POLI_PD'])).min(1, 'Pilih minimal satu layanan'),
    earliestDate: date,
    latestDate: date,
    priority: z.enum(['rutin', 'segera']),
    urgent: z.boolean(),
    requiresEscort: z.boolean(),
    escortPseudonym: z.string().trim().max(40),
    escortRelation: z.string().trim().max(30),
    escortDates: z.array(date),
    holdTier: z.enum(['singkat', 'standar', 'panjang']),
    referralStatus: z.enum(['missing', 'uploaded', 'verified']),
  })
  .refine((v) => v.latestDate >= v.earliestDate, {
    message: 'Tanggal paling lambat harus setelah tanggal paling awal',
    path: ['latestDate'],
  })
  .refine((v) => !v.requiresEscort || v.escortPseudonym.length >= 2, {
    message: 'Isi nama samaran pendamping',
    path: ['escortPseudonym'],
  });

export async function createEpisodeAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const zone = parseZone(fd.get('zone'));
  let episodeId: string | undefined;
  const result = await run(async () => {
    const parsed = newEpisodeSchema.safeParse({
      pseudonym: str(fd, 'pseudonym'),
      nationalId: str(fd, 'nationalId'),
      originRegency: str(fd, 'originRegency'),
      distanceKm: str(fd, 'distanceKm'),
      travelMinutes: str(fd, 'travelMinutes'),
      wheelchair: fd.get('wheelchair') === 'on',
      title: str(fd, 'title'),
      serviceCodes: fd.getAll('serviceCodes').map(String),
      earliestDate: str(fd, 'earliestDate'),
      latestDate: str(fd, 'latestDate'),
      priority: str(fd, 'priority'),
      urgent: fd.get('urgent') === 'on',
      requiresEscort: fd.get('requiresEscort') === 'on',
      escortPseudonym: str(fd, 'escortPseudonym'),
      escortRelation: str(fd, 'escortRelation'),
      escortDates: fd.getAll('escortDates').map(String).filter(Boolean),
      holdTier: str(fd, 'holdTier'),
      referralStatus: str(fd, 'referralStatus'),
    });
    if (!parsed.success) {
      return {
        ok: false,
        message: 'Periksa isian berikut:',
        details: parsed.error.issues.map((i) => i.message),
      };
    }
    const v = parsed.data;
    const ctx = await staffCtx(zone);
    const created = await createEpisode(ctx, {
      title: v.title,
      patient: {
        pseudonym: v.pseudonym,
        originRegency: v.originRegency,
        distanceKm: v.distanceKm,
        travelMinutes: v.travelMinutes,
        mobilityNeeds: v.wheelchair ? ['kursi roda'] : [],
        ...(v.nationalId ? { nationalId: v.nationalId } : {}),
      },
      serviceCodes: v.serviceCodes,
      earliestDate: v.earliestDate,
      latestDate: v.latestDate,
      priority: v.priority,
      urgent: v.urgent,
      requiresEscort: v.requiresEscort,
      ...(v.requiresEscort
        ? {
            escort: {
              pseudonym: v.escortPseudonym,
              relation: v.escortRelation || 'keluarga',
              windows: v.escortDates.map((localDate) => ({
                localDate,
                fromLocal: '05:00',
                toLocal: '20:00',
              })),
            },
          }
        : {}),
      holdTier: v.holdTier,
      includeLostIncome: true,
      documents: [{ kind: 'surat_rujukan', label: 'Surat rujukan', status: v.referralStatus }],
    });
    episodeId = created.episodeId;
    if (!v.urgent) await proposePlans(ctx, created.episodeId);
    return { ok: true, message: 'Episode dibuat.' };
  });
  if (episodeId) {
    refresh(zone);
    redirect(zone === 'demo' ? links.demo.episode(episodeId) : links.app.episode(episodeId));
  }
  return result;
}
