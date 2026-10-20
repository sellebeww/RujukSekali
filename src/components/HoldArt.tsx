/** Looping picture of one hold: both slots lock at the same moment, the timer drains, then the plan is confirmed. Decorative; the prose beside it carries the meaning. */
export function HoldArt() {
  const slots = [
    { time: '07.30', label: 'Ambil darah', sub: 'Lab · puasa' },
    { time: '11.00', label: 'Konsultasi', sub: 'Poli Penyakit Dalam' },
  ];
  return (
    <figure className="my-6">
      <div className="ticket overflow-hidden" aria-hidden="true">
        <div className="flex items-center justify-between gap-3 px-4 pt-4">
          <p className="!m-0 text-sm font-semibold text-ink-soft">Rencana Pasien A · Selasa</p>
          <div className="grid text-sm font-semibold whitespace-nowrap">
            <span className="hold-idle rounded-full bg-paper-deep px-2.5 py-0.5 text-ink-soft [grid-area:1/1]">
              Belum ditahan
            </span>
            <span className="hold-held rounded-full bg-teal-soft px-2.5 py-0.5 text-center text-teal [grid-area:1/1]">
              Ditahan
            </span>
            <span className="hold-done rounded-full bg-leaf-soft px-2.5 py-0.5 text-center text-leaf [grid-area:1/1]">
              Pasti ✓
            </span>
          </div>
        </div>
        <div className="relative mt-3 space-y-2 px-4 pl-9">
          {/* Bracket: the two slots belong to one plan and move together. */}
          <span className="absolute top-5 bottom-5 left-4 w-2.5 rounded-l-md border-y-2 border-l-2 border-teal/40" />
          {slots.map((s) => (
            <div key={s.time} className="hold-slot flex items-center gap-3 rounded-xl border-2 px-3 py-2.5">
              <span className="font-mono text-lg font-bold text-ink">{s.time}</span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block font-semibold text-ink">{s.label}</span>
                <span className="block text-sm text-ink-soft">{s.sub}</span>
              </span>
              <svg viewBox="0 0 20 20" className="hold-lock size-6 shrink-0">
                <rect x="4" y="9" width="12" height="9" rx="2" fill="currentColor" />
                <path d="M7 9V6.5a3 3 0 0 1 6 0V9" fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
            </div>
          ))}
        </div>
        <div className="hold-timer p-4">
          <div className="flex justify-between gap-3 text-sm text-ink-soft">
            <span>Batas waktu tahan</span>
            <span>misalnya 24 jam</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-paper-deep">
            <div className="hold-bar h-full w-full origin-left rounded-full bg-teal" />
          </div>
        </div>
      </div>
      <figcaption className="mt-2 text-sm text-ink-soft">
        Dua jadwal ditahan dalam satu gerakan. Bila syarat siap sebelum waktu habis, rencana menjadi pasti.
      </figcaption>
    </figure>
  );
}
