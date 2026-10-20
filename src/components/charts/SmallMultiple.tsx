'use client';

import { useState } from 'react';

export interface Point {
  x: string;
  y: number;
  sd?: number;
}

/**
 * One-series line chart for small multiples: a single hue, thin line, ringed markers, recessive grid,
 * hover/focus tooltip. The title names the series, so there is no legend.
 */
/** Round an axis maximum up to 1, 2 or 5 × 10^k so ticks read cleanly. */
function niceCeil(v: number) {
  const k = 10 ** Math.floor(Math.log10(v));
  return ([1, 2, 5, 10].find((m) => m * k >= v) ?? 10) * k;
}

const FORMATS = {
  pct: (n: number) => `${Math.round(n * 100)}%`,
  num: (n: number) =>
    n === 0 ? '0' : n >= 100 ? Math.round(n).toLocaleString('id-ID') : n.toFixed(n < 10 ? 1 : 0),
};

export function SmallMultiple({
  title,
  unit,
  points,
  format: fmt,
}: {
  title: string;
  unit: string;
  points: Point[];
  format: keyof typeof FORMATS;
}) {
  const format = FORMATS[fmt];
  const [active, setActive] = useState<number | null>(null);
  const W = 320;
  const H = 180;
  const pad = { l: 44, r: 26, t: 18, b: 30 };
  const raw = Math.max(...points.map((p) => p.y + (p.sd ?? 0))) || 1;
  const max = fmt === 'pct' ? 1 : niceCeil(raw);
  const x = (i: number) => pad.l + (i * (W - pad.l - pad.r)) / Math.max(1, points.length - 1);
  const y = (v: number) => H - pad.b - (v / max) * (H - pad.t - pad.b);
  const ticks = [0, max / 2, max].map((v) => ({ v, y: y(v) }));
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.y)}`).join(' ');
  const a = active !== null ? points[active] : null;

  return (
    <figure className="ticket relative p-4">
      <figcaption className="text-[0.95rem] font-semibold">{title}</figcaption>
      <p className="text-sm text-muted">{unit}</p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-2 w-full"
        role="group"
        aria-label={`${title}: ${points.map((p) => `${p.x} ${format(p.y)}`).join(', ')}`}
      >
        {ticks.map((t) => (
          <g key={t.v}>
            <line x1={pad.l} x2={W - pad.r} y1={t.y} y2={t.y} stroke="var(--color-line)" strokeWidth={1} />
            <text x={pad.l - 6} y={t.y + 4} textAnchor="end" fontSize={11} fill="var(--color-muted)">
              {format(t.v)}
            </text>
          </g>
        ))}
        {points.map((p, i) => (
          <text key={p.x} x={x(i)} y={H - 10} textAnchor="middle" fontSize={11} fill="var(--color-muted)">
            {p.x}
          </text>
        ))}
        {points.map((p, i) =>
          p.sd ? (
            <line
              key={`sd${i}`}
              x1={x(i)}
              x2={x(i)}
              y1={y(p.y - p.sd)}
              y2={y(p.y + p.sd)}
              stroke="var(--color-teal)"
              strokeOpacity={0.3}
              strokeWidth={6}
              strokeLinecap="round"
            />
          ) : null,
        )}
        <path d={path} fill="none" stroke="var(--color-teal)" strokeWidth={2} strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={`pt${i}`}>
            <circle
              cx={x(i)}
              cy={y(p.y)}
              r={active === i ? 6 : 4.5}
              fill="var(--color-teal)"
              stroke="var(--color-card)"
              strokeWidth={2}
            />
            <rect
              x={x(i) - 22}
              y={pad.t}
              width={44}
              height={H - pad.t - pad.b}
              fill="transparent"
              tabIndex={0}
              role="img"
              aria-label={`TTL ${p.x}: ${format(p.y)}`}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
            />
          </g>
        ))}
        {/* Selective direct labels: first and last point only. */}
        {[0, points.length - 1].map((i) => (
          <text
            key={`lbl${i}`}
            x={x(i)}
            y={y(points[i]!.y) - 10}
            textAnchor={i === 0 ? 'start' : 'end'}
            fontSize={12}
            fontWeight={600}
            fill="var(--color-ink)"
          >
            {format(points[i]!.y)}
          </text>
        ))}
      </svg>
      {a && active !== null && (
        <div
          className="pointer-events-none absolute rounded-lg border border-line bg-card px-3 py-2 text-sm shadow-lg"
          style={{ left: `${(x(active) / W) * 100}%`, top: 40, transform: 'translateX(-50%)' }}
          role="status"
        >
          <p className="font-semibold">TTL {a.x}</p>
          <p>
            {format(a.y)}
            {a.sd ? ` (±${format(a.sd)} antar-seed)` : ''}
          </p>
        </div>
      )}
    </figure>
  );
}
