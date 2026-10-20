import { ResultTiles, SimulationLabel, TtlTradeoff } from '@/components/SimulationResults';
import { Notice } from '@/components/ui';
import { links } from '@/config/links';
import { formatIdr } from '@/lib/time';
import type { OperationalMetrics } from '@/server/metrics';

const fmt = (v: number | null, f: (n: number) => string) => (v === null ? '—' : f(v));

export function MetricsView({ m, csvHref }: { m: OperationalMetrics; csvHref: string }) {
  const tiles = [
    {
      label: 'Hari kunjungan per episode selesai',
      value: fmt(m.tripsPerEpisode, (n) => n.toFixed(2)),
      sub: `${m.completedEpisodes} episode selesai`,
    },
    {
      label: 'Tingkat pembatalan setelah konfirmasi',
      value: fmt(m.cancellationRate, (n) => `${Math.round(n * 100)}%`),
      sub: `${m.cancellations} dari ${m.confirmations} konfirmasi`,
    },
    {
      label: 'Slot terbuang',
      value: String(m.wastedSlots),
      sub: 'kosong saat jam layanan setelah hold habis / batal',
    },
    {
      label: 'Hold-to-confirm',
      value: fmt(m.holdToConfirm, (n) => `${Math.round(n * 100)}%`),
      sub: `${m.holdsCreated} penahanan, ${m.holdsActive} aktif`,
    },
    {
      label: 'Rata-rata durasi penahanan',
      value: fmt(m.avgHoldHours, (n) => `${n.toFixed(1)} jam`),
      sub: 'dari dibuat sampai berakhir',
    },
    {
      label: 'Slot-jam tertahan',
      value: Math.round(m.blockedSlotHours).toLocaleString('id-ID'),
      sub: 'jam × slot',
    },
    { label: 'Displacement', value: String(m.displacement), sub: 'permintaan gagal saat ada slot ditahan' },
    {
      label: 'Estimasi biaya pasien',
      value: fmt(m.avgPatientCostIdr, formatIdr),
      sub: 'rata-rata rencana terkonfirmasi',
    },
  ];
  return (
    <div className="container-page py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold tracking-wide text-clay uppercase">Metrik</p>
          <h1 className="text-3xl sm:text-4xl">Perjalanan, pembatalan, dan slot terbuang</h1>
        </div>
        <a
          href={csvHref}
          className="rounded-full border border-line bg-card px-4 py-2 font-semibold hover:bg-paper-deep"
          download
        >
          Unduh CSV
        </a>
      </div>
      <div className="mt-4 max-w-3xl">
        <Notice tone="ochre">
          Semua angka berasal dari data sintetis. Definisi persis tiap metrik ada di dokumentasi
          (docs/METRIK.md).
        </Notice>
      </div>
      <h2 className="mt-8 text-2xl">Operasional saat ini</h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <li key={t.label} className="ticket p-4">
            <p className="text-sm font-semibold text-muted">{t.label}</p>
            <p className="mt-1 font-display text-3xl">{t.value}</p>
            <p className="text-sm text-ink-soft">{t.sub}</p>
          </li>
        ))}
      </ul>
      <div className="mt-10 flex flex-wrap items-center gap-3">
        <h2 className="text-2xl">Simulasi: pesan satu per satu vs perjalanan terkoordinasi</h2>
        <SimulationLabel />
      </div>
      <div className="mt-4">
        <ResultTiles />
      </div>
      <h2 className="mt-10 text-2xl">Eksperimen batas waktu penahanan (TTL)</h2>
      <p className="mt-1 max-w-3xl text-ink-soft">
        TTL lebih panjang membuat lebih banyak penahanan berakhir terkonfirmasi, tetapi menahan kapasitas
        lebih lama dan membuat pasien lain lebih sering gagal mendapat jadwal.{' '}
        <a href={links.site.hasilSimulasi()} className="text-teal underline">
          Metode dan batasannya
        </a>
        .
      </p>
      <div className="mt-4">
        <TtlTradeoff />
      </div>
    </div>
  );
}
