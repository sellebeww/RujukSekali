'use client';

import { useId, useRef, useState, useTransition, type ReactNode } from 'react';
import { toast } from './Toaster';
import { useHydrated } from './useHydrated';
import type { ActionState } from '@/server/actions/ctx';

type Action = (prev: ActionState, data: FormData) => Promise<ActionState>;

const initial: ActionState = { ok: null, message: '' };

/**
 * A small form wrapper for server actions: adds a fresh idempotency key per attempt, shows the result in a live
 * region, and optionally requires a reason (for release/extend/cancel).
 */
export function ActionForm({
  action,
  hidden = {},
  label,
  tone = 'primary',
  reason,
  children,
  className = '',
  confirm,
}: {
  action: Action;
  hidden?: Record<string, string>;
  label: string;
  tone?: 'primary' | 'secondary' | 'danger' | 'accent';
  reason?: { label: string; placeholder?: string };
  children?: ReactNode;
  className?: string;
  confirm?: string;
}) {
  const [state, setState] = useState<ActionState>(initial);
  const [pending, start] = useTransition();
  // One key per attempt, created on the client: repeats of the same attempt reuse it; a finished attempt rotates it.
  const keyRef = useRef<string | null>(null);
  const id = useId();
  // Submitting before hydration would bypass the action; keep the button disabled until then.
  const ready = useHydrated();
  const tones = {
    primary: 'bg-teal text-paper hover:bg-ink border-teal',
    accent: 'bg-clay text-white hover:bg-[#7d2f18] border-clay',
    secondary: 'bg-card text-ink hover:bg-paper-deep border-line',
    danger: 'bg-card text-danger hover:bg-danger-soft border-danger/40',
  };
  return (
    <form
      // Submitting through onSubmit (not the form action prop) keeps the user's input after a validation error.
      onSubmit={(e) => {
        e.preventDefault();
        if (confirm && !window.confirm(confirm)) return;
        const fd = new FormData(e.currentTarget);
        keyRef.current ??= crypto.randomUUID();
        fd.set('idempotencyKey', keyRef.current);
        start(async () => {
          const res = await action(state, fd);
          keyRef.current = null;
          setState(res);
          // The page may re-render this form away (e.g. new options); a toast keeps the outcome visible.
          if (!res.secret)
            toast({ ok: !!res.ok, message: res.message, ...(res.details ? { details: res.details } : {}) });
        });
      }}
      className={`flex flex-col gap-2 ${className}`}
    >
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {children}
      {reason && (
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-reason`} className="text-sm font-semibold">
            {reason.label} <span className="text-clay">(wajib)</span>
          </label>
          <input
            id={`${id}-reason`}
            name="reason"
            required
            minLength={5}
            maxLength={300}
            placeholder={reason.placeholder}
            className="min-h-11 rounded-lg border border-line bg-card px-3 py-2"
          />
        </div>
      )}
      <button
        disabled={pending || !ready}
        className={`inline-flex min-h-11 items-center justify-center rounded-full border px-5 py-2 font-semibold transition-colors disabled:opacity-60 ${tones[tone]}`}
      >
        {pending ? 'Memproses…' : label}
      </button>
      {/* Visual echo only; the page-level toaster is the live region, so screen readers hear it once. */}
      <div className="text-[0.95rem]">
        {state.message && (
          <div
            className={`rounded-lg px-3 py-2 ${state.ok ? 'bg-leaf-soft text-leaf' : 'bg-danger-soft text-danger'}`}
          >
            <p className="font-semibold">{state.message}</p>
            {state.details && state.details.length > 0 && (
              <ul className="mt-1 list-disc pl-5 text-ink">
                {state.details.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            )}
            {state.secret && (
              <p
                className="mt-2 break-all rounded bg-card p-2 font-mono text-sm text-ink"
                data-testid="secret"
              >
                {state.secret}
              </p>
            )}
          </div>
        )}
      </div>
    </form>
  );
}
