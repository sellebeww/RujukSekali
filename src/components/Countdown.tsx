'use client';

import { useEffect, useState } from 'react';

function fmt(ms: number) {
  if (ms <= 0) return 'sudah berakhir';
  const min = Math.floor(ms / 60000);
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  if (d > 0) return `${d} hari ${h} jam lagi`;
  if (h > 0) return `${h} jam ${m} menit lagi`;
  return `${m} menit lagi`;
}

/** "Penahanan berakhir dalam …" — rendered on the server, refreshed every 30 s on the client. */
export function Countdown({ until, now }: { until: number; now: number }) {
  const [t, setT] = useState(now);
  useEffect(() => {
    const id = setInterval(() => setT(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const left = until - t;
  const tone = left <= 0 ? 'text-danger' : left < 3 * 3600_000 ? 'text-clay' : 'text-ochre';
  return (
    <span className={`font-semibold tabular-nums ${tone}`} data-testid="countdown">
      {fmt(left)}
    </span>
  );
}
