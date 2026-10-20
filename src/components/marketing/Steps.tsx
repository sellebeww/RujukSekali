import { links, siteRoutes, type DemoStage, type SiteRoute } from '@/config/links';

export const STEPS: { stage: DemoStage; title: string; body: string; demo: string }[] = [
  {
    stage: 'susun',
    title: 'Susun',
    body: 'Sistem melihat urutan layanan, aturan puasa, waktu hasil lab, jadwal pendamping, dan jam bus atau kereta — lalu menyusun hingga 3 rencana dengan alasan yang mudah dibaca.',
    demo: 'Lihat opsi yang disusun',
  },
  {
    stage: 'tahan',
    title: 'Tahan',
    body: 'Semua jadwal dalam rencana ditahan sementara sekaligus — semuanya atau tidak sama sekali — dengan batas waktu yang jelas, supaya tidak ada yang tertinggal setengah jalan.',
    demo: 'Lihat jadwal yang ditahan',
  },
  {
    stage: 'konfirmasi',
    title: 'Konfirmasi',
    body: 'Jadwal baru menjadi pasti ketika syarat penting siap: dokumen terverifikasi, pendamping bisa ikut, transportasi memungkinkan, dan koordinator setuju.',
    demo: 'Lihat rencana terkonfirmasi',
  },
  {
    stage: 'jalani',
    title: 'Jalani',
    body: 'Pasien menerima satu ringkasan: kapan berangkat, ke mana, urutan layanan, dan apa yang perlu dibawa. Tanpa aplikasi, tanpa akun.',
    demo: 'Lihat dari sisi pasien',
  },
];

export function Steps({
  from = siteRoutes.home,
  detailed = false,
}: {
  from?: SiteRoute;
  detailed?: boolean;
}) {
  return (
    <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {STEPS.map((s, i) => (
        <li key={s.stage} id={`langkah-${s.stage}`} className="ticket relative flex flex-col p-5">
          <span className="font-display text-5xl text-teal/25" aria-hidden="true">
            {i + 1}
          </span>
          <h3 className="mt-1 text-2xl">{s.title}</h3>
          <p className="mt-2 flex-1 text-ink-soft">{s.body}</p>
          {detailed && (
            <a
              href={links.demo.start(s.stage === 'konfirmasi' ? '2' : '1', {
                stage: s.stage,
                view: s.stage === 'jalani' ? 'pasien' : 'koordinator',
                from,
              })}
              className="mt-4 font-semibold text-teal underline"
            >
              {s.demo} di demo →
            </a>
          )}
        </li>
      ))}
    </ol>
  );
}
