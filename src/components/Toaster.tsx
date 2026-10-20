'use client';

import { useEffect, useState } from 'react';

export interface ToastDetail {
  ok: boolean;
  message: string;
  details?: string[];
}

/** Fire-and-forget: results stay visible even if the form that produced them re-renders away. */
export function toast(t: ToastDetail) {
  window.dispatchEvent(new CustomEvent<ToastDetail>('rs:toast', { detail: t }));
}

export function Toaster() {
  const [items, setItems] = useState<(ToastDetail & { id: number })[]>([]);
  useEffect(() => {
    let n = 0;
    const on = (e: Event) => {
      const id = ++n;
      setItems((xs) => [...xs.slice(-2), { ...(e as CustomEvent<ToastDetail>).detail, id }]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 10_000);
    };
    window.addEventListener('rs:toast', on);
    return () => window.removeEventListener('rs:toast', on);
  }, []);
  return (
    <div
      aria-live="polite"
      role="status"
      className="fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
      data-testid="toaster"
    >
      {items.map((t) => (
        <div
          key={t.id}
          className={`w-full max-w-lg rounded-xl border px-4 py-3 shadow-lg ${t.ok ? 'border-leaf/40 bg-leaf-soft' : 'border-danger/40 bg-danger-soft'}`}
        >
          <div className="flex items-start gap-3">
            <p className={`flex-1 font-semibold ${t.ok ? 'text-leaf' : 'text-danger'}`}>{t.message}</p>
            <button
              onClick={() => setItems((xs) => xs.filter((x) => x.id !== t.id))}
              className="-m-1 min-h-8 min-w-8 rounded-full text-ink hover:bg-card"
              aria-label="Tutup pesan"
            >
              ×
            </button>
          </div>
          {t.details && t.details.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-[0.95rem] text-ink">
              {t.details.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
