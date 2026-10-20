'use client';

import { startTransition, useActionState, useEffect, useRef } from 'react';
import { useHydrated } from '../useHydrated';
import { leadAction } from '@/server/actions/lead';
import type { ActionState } from '@/server/actions/ctx';

const initial: ActionState = { ok: null, message: '' };
const input = 'w-full rounded-lg border border-line bg-card px-3 py-2.5 text-base min-h-11';

export function LeadForm({ consentText }: { consentText: string }) {
  const [state, action, pending] = useActionState(leadAction, initial);
  const startedAt = useRef(0);
  const ready = useHydrated();
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  if (state.ok) {
    return (
      <div role="status" className="rounded-2xl bg-leaf-soft p-6 text-lg">
        <p className="font-display text-2xl text-leaf">Permintaan terkirim.</p>
        <p className="mt-2">{state.message}</p>
      </div>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set('startedAt', String(startedAt.current));
        startTransition(() => action(fd));
      }}
      className="grid gap-4"
      noValidate
    >
      {/* Honeypot: invisible to people, tempting to bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Situs web
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 font-semibold">
          Nama
          <input name="name" required autoComplete="name" className={input} />
        </label>
        <label className="flex flex-col gap-1 font-semibold">
          Instansi
          <input name="organization" required autoComplete="organization" className={input} />
        </label>
        <label className="flex flex-col gap-1 font-semibold">
          Peran
          <input name="role" required placeholder="mis. Kepala Instalasi Rawat Jalan" className={input} />
        </label>
        <fieldset className="flex flex-col gap-1">
          <legend className="font-semibold">Hubungi saya lewat</legend>
          <div className="flex gap-4 pt-2">
            <label className="flex items-center gap-2">
              <input type="radio" name="contactChannel" value="email" defaultChecked className="h-5 w-5" />{' '}
              Email
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="contactChannel" value="whatsapp" className="h-5 w-5" /> WhatsApp
            </label>
          </div>
        </fieldset>
      </div>
      <label className="flex flex-col gap-1 font-semibold">
        Email atau nomor WhatsApp
        <input name="contactValue" required className={input} />
      </label>
      <label className="flex flex-col gap-1 font-semibold">
        Kebutuhan singkat
        <textarea
          name="need"
          required
          rows={4}
          maxLength={1000}
          className={input}
          placeholder="mis. Kami ingin mengurangi pasien rujukan yang harus kembali berkali-kali."
        />
        <span className="text-sm font-normal text-muted">
          Jangan kirim data pasien (nama, NIK, nomor rekam medis, diagnosis).
        </span>
      </label>
      <label className="flex items-start gap-3">
        <input type="checkbox" name="consent" required className="mt-1 h-5 w-5 shrink-0" />
        <span>{consentText}</span>
      </label>
      <div aria-live="polite" role="status">
        {state.ok === false && (
          <div className="rounded-lg bg-danger-soft px-4 py-3 text-danger">
            <p className="font-semibold">{state.message}</p>
            {state.details && (
              <ul className="mt-1 list-disc pl-5 text-ink">
                {state.details.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      <button
        disabled={pending || !ready}
        className="inline-flex min-h-12 items-center justify-center rounded-full bg-clay px-6 text-lg font-semibold text-white hover:bg-[#7d2f18] disabled:opacity-60"
      >
        {pending ? 'Mengirim…' : 'Kirim permintaan'}
      </button>
    </form>
  );
}
