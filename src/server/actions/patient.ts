'use server';

import { revalidatePath } from 'next/cache';
import { DomainError } from '../errors';
import { confirmEscortDays, requestReschedule, uploadDocument } from '../usecases/episodes';
import { parseZone, patientCtx, run, type ActionState } from './ctx';

const refresh = (zone: 'app' | 'demo') => revalidatePath(zone === 'demo' ? '/demo/pasien' : '/p', 'layout');

export async function patientUploadAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const zone = parseZone(fd.get('zone'));
    const { ctx } = await patientCtx(zone, String(fd.get('token') ?? ''));
    const file = fd.get('file');
    const name = file instanceof File && file.size > 0 ? file.name : '';
    if (!name) throw new DomainError('NO_FILE', 'Pilih foto atau berkas dokumen terlebih dahulu.', 400);
    // Mock upload: only the file name is recorded; the content is discarded (no storage in the MVP).
    await uploadDocument(ctx, String(fd.get('documentId')), name);
    refresh(zone);
    return { ok: true, message: 'Terima kasih. Dokumen diterima dan akan diperiksa petugas.' };
  });
}

export async function patientEscortAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const zone = parseZone(fd.get('zone'));
    const { ctx, episodeId } = await patientCtx(zone, String(fd.get('token') ?? ''));
    const res = await confirmEscortDays(ctx, episodeId);
    refresh(zone);
    return res?.confirmed
      ? { ok: true, message: 'Terima kasih! Semua syarat lengkap — jadwal Anda sudah pasti.' }
      : {
          ok: true,
          message: 'Terima kasih, kehadiran pendamping tercatat.',
          details: res?.blockers.map((b) => b.message),
        };
  });
}

export async function patientRescheduleAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const zone = parseZone(fd.get('zone'));
    const { ctx, episodeId } = await patientCtx(zone, String(fd.get('token') ?? ''));
    await requestReschedule(ctx, episodeId, String(fd.get('message') ?? ''));
    refresh(zone);
    return { ok: true, message: 'Permintaan terkirim. Petugas akan menghubungi Anda.' };
  });
}
