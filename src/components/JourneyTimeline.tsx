import type { CandidatePlan } from '@/engine/types';
import { formatLocalDate, formatLocalTime } from '@/lib/time';

type Stop =
  | { kind: 'travel'; label: string; time: string; date: string }
  | { kind: 'visit'; label: string; time: string; date: string; note?: string; place?: string }
  | { kind: 'stay'; label: string; date: string };

/** One continuous route line through every stop of a plan — the product's core idea made visible. */
export function JourneyTimeline({
  plan,
  places = {},
  showPrep = true,
}: {
  plan: Pick<CandidatePlan, 'visits' | 'trips'>;
  places?: Record<string, string>;
  showPrep?: boolean;
}) {
  const stops: Stop[] = [];
  for (const t of plan.trips) {
    stops.push({
      kind: 'travel',
      label: `Berangkat · ${t.transportLabel}`,
      time: `${t.departLocal}–${t.arriveLocal}`,
      date: t.startDate,
    });
    const days = [
      ...new Set(
        plan.visits
          .filter((v) => v.localDate >= t.startDate && v.localDate <= t.endDate)
          .map((v) => v.localDate),
      ),
    ].sort();
    days.forEach((d, i) => {
      for (const v of plan.visits.filter((x) => x.localDate === d).sort((a, b) => a.startsAt - b.startsAt)) {
        stops.push({
          kind: 'visit',
          label: v.serviceName,
          time: formatLocalTime(v.startsAt),
          date: d,
          ...(showPrep && v.prepNote ? { note: v.prepNote } : {}),
          ...(places[v.slotId] ? { place: places[v.slotId] } : {}),
        });
      }
      if (i < days.length - 1 || t.lodgingNights > 0) {
        if (d !== t.endDate) stops.push({ kind: 'stay', label: 'Menginap di dekat rumah sakit', date: d });
      }
    });
    stops.push({
      kind: 'travel',
      label: 'Pulang',
      time: `${t.returnDepartLocal}–${t.returnArriveLocal}`,
      date: t.endDate,
    });
  }

  let lastDate = '';
  return (
    <ol
      className="relative ml-2 border-l-[3px] border-dashed border-teal/40 pl-6"
      aria-label="Linimasa perjalanan"
    >
      {stops.map((s, i) => {
        const showDate = s.date !== lastDate;
        lastDate = s.date;
        const dot =
          s.kind === 'visit'
            ? 'bg-teal border-teal'
            : s.kind === 'stay'
              ? 'bg-ochre-soft border-ochre'
              : 'bg-card border-teal';
        return (
          <li key={i} className="relative pb-4 last:pb-0">
            <span
              aria-hidden="true"
              className={`absolute top-1.5 -left-[33px] h-4 w-4 rounded-full border-[3px] ${dot}`}
            />
            {showDate && (
              <p className="text-sm font-bold tracking-wide text-clay uppercase">{formatLocalDate(s.date)}</p>
            )}
            <p className={s.kind === 'visit' ? 'font-semibold' : 'text-ink-soft'}>
              {'time' in s && <span className="mr-2 font-mono text-[0.95rem] tabular-nums">{s.time}</span>}
              {s.label}
            </p>
            {s.kind === 'visit' && s.place && <p className="text-sm text-muted">{s.place}</p>}
            {s.kind === 'visit' && s.note && <p className="text-sm text-ochre">Persiapan: {s.note}</p>}
          </li>
        );
      })}
    </ol>
  );
}
