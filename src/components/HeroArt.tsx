/** Hand-drawn route: home → lab (puasa) → hasil siap → poli → pulang, as one line. Decorative; text carries meaning. */
export function HeroArt() {
  const stops = [
    { x: 40, y: 250, label: 'Berangkat', sub: '04:30' },
    { x: 170, y: 120, label: 'Lab darah', sub: '07:30 · puasa' },
    { x: 310, y: 205, label: 'Hasil siap', sub: '10:45' },
    { x: 430, y: 85, label: 'Konsultasi', sub: '11:00' },
    { x: 560, y: 220, label: 'Pulang', sub: '16:00' },
  ];
  return (
    <svg viewBox="0 0 600 320" className="h-auto w-full" aria-hidden="true">
      <defs>
        <pattern id="grain" width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="0.8" fill="var(--color-line)" />
        </pattern>
      </defs>
      <rect x="0" y="0" width="600" height="320" rx="24" fill="url(#grain)" opacity="0.6" />
      <path
        className="draw-line"
        d="M40 250 C 90 170, 120 120, 170 120 S 260 215, 310 205 S 390 80, 430 85 S 520 230, 560 220"
        fill="none"
        stroke="var(--color-teal)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray="1200"
      />
      {stops.map((s, i) => (
        <g key={s.label} className="fade-up" style={{ animationDelay: `${0.4 + i * 0.35}s` }}>
          <circle
            cx={s.x}
            cy={s.y}
            r="11"
            fill={i === 2 ? 'var(--color-ochre-soft)' : 'var(--color-card)'}
            stroke="var(--color-teal)"
            strokeWidth="4"
          />
          <text
            x={s.x}
            y={s.y + (s.y > 150 ? 36 : -40)}
            textAnchor="middle"
            fontSize="17"
            fontWeight="700"
            fill="var(--color-ink)"
          >
            {s.label}
          </text>
          <text
            x={s.x}
            y={s.y + (s.y > 150 ? 56 : -20)}
            textAnchor="middle"
            fontSize="14"
            fill="var(--color-ink-soft)"
          >
            {s.sub}
          </text>
        </g>
      ))}
    </svg>
  );
}
