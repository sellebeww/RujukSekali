'use server';

import { revalidatePath } from 'next/cache';
import { setLeadStatus } from '../usecases/leads';
import { setDayBlocked, updateServiceRules } from '../usecases/admin';
import { parseZone, run, staffCtx, type ActionState } from './ctx';

export async function serviceRulesAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const zone = parseZone(fd.get('zone'));
    const g = (k: string) => String(fd.get(k) ?? '');
    await updateServiceRules(await staffCtx(zone), g('code'), {
      latestStartLocal: g('latestStartLocal'),
      resultReadyMin: Number(g('resultReadyMin')),
      ttlSingkatMin: Number(g('ttlSingkatMin')),
      ttlStandarMin: Number(g('ttlStandarMin')),
      ttlPanjangMin: Number(g('ttlPanjangMin')),
      maxHoldRatioPct: Number(g('maxHoldRatioPct')),
      maxExtensions: Number(g('maxExtensions')),
    });
    revalidatePath(zone === 'demo' ? '/demo' : '/app', 'layout');
    return {
      ok: true,
      message: 'Aturan layanan disimpan. Berlaku untuk penyusunan dan penahanan berikutnya.',
    };
  });
}

export async function blockDayAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const zone = parseZone(fd.get('zone'));
    const blocked = fd.get('op') === 'block';
    const n = await setDayBlocked(
      await staffCtx(zone),
      String(fd.get('serviceTypeId')),
      String(fd.get('localDate')),
      blocked,
    );
    revalidatePath(zone === 'demo' ? '/demo' : '/app', 'layout');
    return { ok: true, message: blocked ? `${n} slot kosong diblokir.` : `${n} slot dibuka kembali.` };
  });
}

export async function leadStatusAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const status = String(fd.get('status')) as 'baru' | 'dihubungi' | 'selesai' | 'ditolak';
    await setLeadStatus(await staffCtx('app'), String(fd.get('leadId')), status);
    revalidatePath('/app/admin/leads');
    return { ok: true, message: 'Status diperbarui.' };
  });
}
