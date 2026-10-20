'use client';

import { useActionState, useEffect, useId, useRef, type ReactNode } from 'react';
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
  const [state, formAction, pending] = useActionState(action, initial);
  // One key per attempt, created on the client: repeats of the same attempt reuse it; a finished attempt rotates it.
  const keyRef = useRef<string | null>(null);
  useEffect(() => {
    keyRef.current = null;
  }, [state]);
  const id = useId();
  const tones = {
    primary: 'bg-teal text-paper hover:bg-ink border-teal',
    accent: 'bg-clay text-white hover:bg-[#93391f] border-clay',
    secondary: 'bg-card text-ink hover:bg-paper-deep border-line',
    danger: 'bg-card text-danger hover:bg-danger-soft border-danger/40',
  };
  return (
    <form
      action={(fd) => {
        keyRef.current ??= crypto.randomUUID();
        fd.set('idempotencyKey', keyRef.current);
        formAction(fd);
      }}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
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
        disabled={pending}
        className={`inline-flex min-h-11 items-center justify-center rounded-full border px-5 py-2 font-semibold transition-colors disabled:opacity-60 ${tones[tone]}`}
      >
        {pending ? 'Memproses…' : label}
      </button>
      <div aria-live="polite" role="status" className="text-[0.95rem]">
        {state.message && (
          <div className={`rounded-lg px-3 py-2 ${state.ok ? 'bg-leaf-soft text-leaf' : 'bg-danger-soft text-danger'}`}>
            <p className="font-semibold">{state.message}</p>
            {state.details && state.details.length > 0 && (
              <ul className="mt-1 list-disc pl-5 text-ink">
                {state.details.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            )}
            {state.secret && (
              <p className="mt-2 break-all rounded bg-card p-2 font-mono text-sm text-ink" data-testid="secret">
                {state.secret}
              </p>
            )}
          </div>
        )}
      </div>
    </form>
  );
}
