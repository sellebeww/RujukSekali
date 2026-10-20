import { Badge, Notice } from '@/components/ui';
import { links, type DemoScenario } from '@/config/links';
import { SCENARIOS } from '@seed/scenarios';

export const metadata = { title: 'Mulai demo' };

export default async function DemoHome({ searchParams }: { searchParams: Promise<{ batas?: string }> }) {
  const { batas } = await searchParams;
  return (
    <div className="container-page py-10">
      <p className="text-sm font-semibold tracking-wide text-clay uppercase">Mode demo</p>
      <h1 className="max-w-3xl text-4xl sm:text-5xl">Coba sendiri: dari opsi jadwal sampai pasien tahu harus datang kapan</h1>
      <p className="mt-3 max-w-2xl text-lg text-ink-soft">
        Pilih skenario. Sistem membuat salinan baru khusus untuk Anda di sandbox demo (data sintetis, diperbarui berkala), lalu membuka
        tampilan koordinator atau pasien.
      </p>
      {batas && (
        <div className="mt-4 max-w-2xl">
          <Notice tone="clay" role="alert" title="Terlalu banyak skenario dibuat dari perangkat ini. Coba lagi beberapa menit lagi." />
        </div>
      )}
      <ul className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Object.values(SCENARIOS).map((s) => (
          <li key={s.id} className="ticket flex flex-col p-5">
            <Badge tone="teal">Skenario {s.id}</Badge>
            <h2 className="mt-3 text-2xl">{s.title}</h2>
            <p className="mt-1 flex-1 text-ink-soft">{s.short}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={links.demo.start(s.id as DemoScenario, { stage: s.id === '1' || s.id === '4' ? 'susun' : 'tahan' })}
                className="rounded-full bg-teal px-4 py-2 font-semibold text-paper hover:bg-ink"
              >
                Coba sebagai koordinator
              </a>
              <a
                href={links.demo.start(s.id as DemoScenario, { stage: 'tahan', view: 'pasien' })}
                className="rounded-full border border-line bg-card px-4 py-2 font-semibold hover:bg-paper-deep"
              >
                Lihat sebagai pasien
              </a>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-8">
        Atau buka{' '}
        <a href={links.demo.coordinator()} className="font-semibold text-teal underline">
          antrean koordinator demo
        </a>{' '}
        dengan ±40 pasien sintetis.
      </p>
    </div>
  );
}
