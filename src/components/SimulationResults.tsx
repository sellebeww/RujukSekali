import { headline, simulation, ttlLabel } from '@/content/simulation';
import { formatIdr } from '@/lib/time';
import { SmallMultiple } from './charts/SmallMultiple';

const pct = (n: number) => `${Math.round(n * 100)}%`;
const num = (n: number) => (n >= 100 ? Math.round(n).toLocaleString('id-ID') : n.toFixed(n < 10 ? 1 : 0));

export function SimulationLabel() {
  return (
    <p className="inline-flex items-center gap-2 rounded-full border-2 border-dashed border-ochre bg-ochre-soft px-4 py-1.5 text-sm font-bold text-ochre">
      <span aria-hidden="true">◆</span> {simulation.label}
    </p>
  );
}

/** Baseline vs coordinated, as KPI tiles: a handful of headline numbers is not a chart. */
export function ResultTiles() {
  const h = headline();
  const tiles = [
    {
      label: 'Hari kunjungan per episode',
      before: h.trips.baseline.toFixed(2),
      after: h.trips.coordinated.toFixed(2),
      note: `${h.trips.reductionPct}% lebih sedikit`,
    },
    {
      label: 'Perkiraan biaya pasien per episode',
      before: formatIdr(Math.round(h.cost.baseline / 1000) * 1000),
      after: formatIdr(Math.round(h.cost.coordinated / 1000) * 1000),
      note: `${h.cost.reductionPct}% lebih hemat`,
    },
    {
      label: 'Slot terbuang per simulasi 4 minggu',
      before: num(h.wasted.baseline),
      after: num(h.wasted.coordinated),
      note: `${h.wasted.reductionPct}% lebih sedikit`,
    },
    {
      label: 'Pembatalan setelah konfirmasi',
      before: pct(h.cancel.baseline),
      after: pct(h.cancel.coordinated),
      note: 'karena konfirmasi menunggu syarat lengkap',
    },
  ];
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((t) => (
        <li key={t.label} className="ticket p-4">
          <p className="text-sm font-semibold text-muted">{t.label}</p>
          <p className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-4xl text-ink">{t.after}</span>
            <span className="text-sm text-muted line-through" title="Pesan satu per satu">
              {t.before}
            </span>
          </p>
          <p className="mt-1 text-sm text-ink-soft">{t.note}</p>
        </li>
      ))}
    </ul>
  );
}

export function TtlTradeoff() {
  const rows = simulation.ttl;
  return (
    <div>
      <div className="grid gap-3 md:grid-cols-3">
        <SmallMultiple
          title="Penahanan yang berakhir terkonfirmasi"
          unit="hold-to-confirm, % (naik = baik)"
          points={rows.map((r) => ({ x: ttlLabel(r.ttlMin), y: r.holdToConfirm, sd: r.holdToConfirmSd }))}
          format="pct"
        />
        <SmallMultiple
          title="Slot-jam tertahan"
          unit="jam × slot yang tidak bisa dipakai pasien lain"
          points={rows.map((r) => ({
            x: ttlLabel(r.ttlMin),
            y: r.blockedSlotHours,
            sd: r.blockedSlotHoursSd,
          }))}
          format="num"
        />
        <SmallMultiple
          title="Pasien lain gagal dapat jadwal"
          unit="displacement, kejadian per simulasi"
          points={rows.map((r) => ({ x: ttlLabel(r.ttlMin), y: r.displaced, sd: r.displacedSd }))}
          format="num"
        />
      </div>
      <details className="mt-4">
        <summary className="cursor-pointer font-semibold text-teal">Lihat sebagai tabel</summary>
        <div className="ticket mt-2 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-[0.95rem]">
            <thead className="border-b border-line bg-paper-deep/60 text-sm">
              <tr>
                <th className="px-3 py-2">TTL</th>
                <th className="px-3 py-2">Hold-to-confirm</th>
                <th className="px-3 py-2">Slot-jam tertahan</th>
                <th className="px-3 py-2">Displacement</th>
                <th className="px-3 py-2">Slot terbuang</th>
                <th className="px-3 py-2">Hari kunjungan/episode</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.ttlMin} className="border-b border-line/60">
                  <td className="px-3 py-2">{ttlLabel(r.ttlMin)}</td>
                  <td className="px-3 py-2">{pct(r.holdToConfirm)}</td>
                  <td className="px-3 py-2">{num(r.blockedSlotHours)}</td>
                  <td className="px-3 py-2">{num(r.displaced)}</td>
                  <td className="px-3 py-2">{num(r.wastedTotal)}</td>
                  <td className="px-3 py-2">{r.tripsPerEpisode.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
