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
            id={`ba-tab-${v}`}
            role="tab"
            aria-selected={view === v}
            aria-controls="ba-panel"
            tabIndex={view === v ? 0 : -1}
            onClick={() => setView(v)}
            onKeyDown={(e) => {
              // WAI-ARIA tabs: arrows move to the other tab, Home/End to the first/last.
              const other = v === 'before' ? 'after' : 'before';
              const next = { ArrowLeft: other, ArrowRight: other, Home: 'before', End: 'after' }[e.key] as
                typeof v | undefined;
              if (!next) return;
              e.preventDefault();
              setView(next);
              document.getElementById(`ba-tab-${next}`)?.focus();
            }}
            className={`min-h-11 rounded-full px-5 font-semibold transition-colors ${view === v ? 'bg-teal text-paper' : 'text-ink hover:bg-paper-deep'}`}
          >
            {v === 'before' ? 'Sebelum' : 'Sesudah'}
            <span className="hidden sm:inline">
              {v === 'before' ? ': pesan satu per satu' : ': satu perjalanan'}
            </span>
          </button>
        ))}
      </div>
      <div id="ba-panel" role="tabpanel" aria-labelledby={`ba-tab-${view}`}>
        <p className="mt-4 text-lg" aria-live="polite">
          <strong key={view} className="fade-up inline-block font-display text-3xl">
            {cur.days.length}
          </strong>{' '}
          kali datang ke rumah sakit · perkiraan biaya <strong>{formatIdr(cur.costIdr)}</strong>
        </p>
        <ol
          key={view}
          className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9"
          aria-label="Hari dalam jendela waktu"
        >
          {days.map((d, i) => {
            const day = byDate.get(d);
            return (
              <li
                key={d}
                style={{ animationDelay: `${i * 40}ms` }}
                className={`fade-up min-h-28 rounded-xl border p-2 text-sm ${day ? 'border-teal bg-teal-soft' : 'border-dashed border-line bg-paper/50'}`}
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
      </div>
      <p className="mt-4 text-sm text-muted">
        Contoh dari jadwal sintetis (seed {sample.seed}), dihitung dengan mesin penyusun yang sama dengan
        aplikasi. Bukan data pasien dan bukan hasil lapangan.
      </p>
    </div>
  );
}
