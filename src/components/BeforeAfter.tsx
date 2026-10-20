'use client';

import { useState } from 'react';
import { addDays, formatIdr, formatLocalDate } from '@/lib/time';
import type { sampleJourney } from '@/content/sampleJourney';

type Sample = typeof sampleJourney;

/** Interactive before/after: several separate trips vs one coordinated trip, on the same synthetic schedule. */
export function BeforeAfter({ sample }: { sample: Sample }) {
  const [view, setView] = useState<'before' | 'after'>('before');
  const cur = view === 'before' ? sample.before : sample.after;
  const days = Array.from({ length: sample.windowDays }, (_, i) => addDays(sample.windowStart, i));
  const byDate = new Map(cur.days.map((d) => [d.date, d]));
  return (
    <div className="ticket p-5">
      <div
        role="tablist"
        aria-label="Bandingkan"
        className="inline-flex rounded-full border border-line bg-paper p-1"
      >
        {(['before', 'after'] as const).map((v) => (
          <button
            key={v}
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={`min-h-11 rounded-full px-5 font-semibold transition-colors ${view === v ? 'bg-teal text-paper' : 'text-ink hover:bg-paper-deep'}`}
          >
            {v === 'before' ? 'Sebelum' : 'Sesudah'}
            <span className="hidden sm:inline">{v === 'before' ? ': pesan satu per satu' : ': satu perjalanan'}</span>
          </button>
        ))}
      </div>
      <p className="mt-4 text-lg" aria-live="polite">
        <strong className="font-display text-3xl">{cur.days.length}</strong> kali datang ke rumah sakit ·
        perkiraan biaya <strong>{formatIdr(cur.costIdr)}</strong>
      </p>
      <ol
        className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9"
        aria-label="Hari dalam jendela waktu"
      >
        {days.map((d) => {
          const day = byDate.get(d);
          return (
            <li
              key={d}
              className={`min-h-28 rounded-xl border p-2 text-sm transition-colors ${day ? 'border-teal bg-teal-soft' : 'border-dashed border-line bg-paper/50'}`}
            >
              <p className="font-semibold">{formatLocalDate(d)}</p>
              {day ? (
                <ul className="mt-1 space-y-1">
                  {day.visits.map((v) => (
                    <li key={v.time + v.label} className={v.wasted ? 'text-clay' : ''}>
                      <span className="font-mono">{v.time}</span> {v.label}
                      {v.wasted && (
                        <span className="block text-xs">hasil lab belum siap — harus kembali</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-muted">—</p>
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-4 text-sm text-muted">
        Contoh dari jadwal sintetis (seed {sample.seed}), dihitung dengan mesin penyusun yang sama dengan
        aplikasi. Bukan data pasien dan bukan hasil lapangan.
      </p>
    </div>
  );
}
