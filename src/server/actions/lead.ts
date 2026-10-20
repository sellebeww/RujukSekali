'use server';

import { clientIp } from '../auth';
import { makeCtx } from '../context';
import { submitLead } from '../usecases/leads';
import { run, type ActionState } from './ctx';

export async function leadAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const ctx = makeCtx('app', { type: 'public', id: null, label: 'Formulir publik', role: null });
    const res = await submitLead(
      ctx,
      {
        name: String(fd.get('name') ?? ''),
        organization: String(fd.get('organization') ?? ''),
        role: String(fd.get('role') ?? ''),
        contactChannel: String(fd.get('contactChannel') ?? '') as 'email' | 'whatsapp',
        contactValue: String(fd.get('contactValue') ?? ''),
        need: String(fd.get('need') ?? ''),
        consent: fd.get('consent') === 'on',
        honeypot: String(fd.get('website') ?? ''),
        startedAt: Number(fd.get('startedAt') ?? 0) || undefined,
      },
      await clientIp(),
    );
    return res.ok
      ? {
          ok: true,
          message:
            'Terima kasih! Permintaan Anda kami terima. Kami akan menghubungi Anda lewat kanal yang Anda pilih.',
        }
      : { ok: false, message: 'Periksa kembali isian berikut:', details: res.errors };
  });
}
