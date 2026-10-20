import { Badge, Notice } from '@/components/ui';
import { links, type DemoScenario } from '@/config/links';
import { SCENARIOS } from '@seed/scenarios';

export const metadata = { title: 'Mulai demo' };

export default async function DemoHome({ searchParams }: { searchParams: Promise<{ batas?: string }> }) {
  const { batas } = await searchParams;
  return (
    <div className="container-page py-10">
      <p className="text-sm font-semibold tracking-wide text-clay uppercase">Mode demo</p>
      <h1 className="max-w-3xl text-4xl sm:text-5xl">
        Coba sendiri: dari opsi jadwal sampai pasien tahu harus datang kapan
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-ink-soft">
        Tanpa akun, tanpa instalasi. Semua pasien dan jadwal di sini sintetis, jadi aman untuk menekan tombol
        apa pun.
      </p>
      <ol className="mt-6 grid max-w-4xl gap-3 sm:grid-cols-3">
        {[
          [
            'Pilih skenario',
            'Tiap kartu di bawah adalah satu situasi pasien. Belum tahu? Mulai dari Skenario 1.',
          ],
          [
            'Pilih sudut pandang',
            'Koordinator = petugas rumah sakit yang menyusun jadwal. Pasien = halaman yang diterima pasien.',
          ],
          [
            'Coba tombolnya',
            'Anda mendapat salinan sendiri. Ingin ulang? Kembali ke halaman ini dan pilih lagi.',
          ],
        ].map(([title, body], i) => (
          <li key={title} className="flex gap-3 rounded-xl border border-line bg-card p-4">
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-teal font-bold text-paper"
            >
              {i + 1}
            </span>
            <span>
              <span className="block font-semibold">{title}</span>
              <span className="block text-[0.95rem] text-ink-soft">{body}</span>
            </span>
          </li>
        ))}
      </ol>
      {batas && (
        <div className="mt-4 max-w-2xl">
          <Notice
            tone="clay"
            role="alert"
            title="Terlalu banyak skenario dibuat dari perangkat ini. Coba lagi beberapa menit lagi."
          />
        </div>
      )}
      <ul className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Object.values(SCENARIOS).map((s) => (
          <li key={s.id} className="ticket flex flex-col p-5">
            <div className="flex flex-wrap gap-2">
              <Badge tone="teal">Skenario {s.id}</Badge>
              {s.id === '1' && <Badge tone="leaf">Mulai di sini</Badge>}
            </div>
            <h2 className="mt-3 text-2xl">{s.title}</h2>
            <p className="mt-1 flex-1 text-ink-soft">{s.short}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={links.demo.start(s.id as DemoScenario, {
                  stage: s.id === '1' || s.id === '4' ? 'susun' : 'tahan',
                })}
                className="inline-flex min-h-11 items-center rounded-full bg-teal px-4 py-2 font-semibold text-paper hover:bg-ink"
              >
                Coba sebagai koordinator
              </a>
              <a
                href={links.demo.start(s.id as DemoScenario, { stage: 'tahan', view: 'pasien' })}
                className="inline-flex min-h-11 items-center rounded-full border border-line bg-card px-4 py-2 font-semibold hover:bg-paper-deep"
              >
                Lihat sebagai pasien
              </a>
            </div>
          </li>
        ))}
        <li className="flex flex-col rounded-[var(--radius-ticket)] border-2 border-dashed border-line p-5">
          <Badge tone="neutral" className="self-start">
            Jelajah bebas
          </Badge>
          <h2 className="mt-3 text-2xl">Antrean koordinator</h2>
          <p className="mt-1 flex-1 text-ink-soft">
            ±40 pasien sintetis dalam berbagai tahap. Cocok bila ingin melihat gambaran satu hari kerja.
          </p>
          <a
            href={links.demo.coordinator()}
            className="mt-4 inline-flex min-h-11 items-center self-start rounded-full border border-line bg-card px-4 py-2 font-semibold hover:bg-paper-deep"
          >
            Buka antrean →
          </a>
        </li>
      </ul>
    </div>
  );
}
