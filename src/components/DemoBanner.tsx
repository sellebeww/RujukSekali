import { links, returnHref } from '@/config/links';

export function DemoBanner({ from }: { from?: string | null }) {
  return (
    <div role="region" aria-label="Mode demo" className="bg-ochre-soft text-ink">
      <div className="container-page flex flex-wrap items-center gap-x-4 gap-y-2 py-2 text-[0.95rem]">
        <p className="font-semibold">
          <span aria-hidden="true">◆ </span>Mode demo — data sintetis
        </p>
        <p className="hidden text-ink-soft md:block">
          Semua pasien, jadwal, dan angka di sini buatan. Aksi hanya mengubah sandbox demo.
        </p>
        <div className="ml-auto flex gap-2">
          <a
            href={returnHref(from)}
            className="rounded-full border border-ink/20 bg-card px-4 py-1.5 font-semibold hover:bg-paper"
          >
            Kembali ke situs
          </a>
          <a
            href={links.site.mintaDemo()}
            className="rounded-full bg-clay px-4 py-1.5 font-semibold text-white hover:bg-[#7d2f18]"
          >
            Minta Pilot
          </a>
        </div>
      </div>
    </div>
  );
}
