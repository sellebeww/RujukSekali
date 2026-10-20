import Link from 'next/link';
import { Countdown } from '@/components/Countdown';
import { Badge, LinkButton, Notice } from '@/components/ui';
import { links } from '@/config/links';
import { formatLocalDate } from '@/lib/time';
import { QUEUE_LABEL, type QueueCategory, type QueueItem } from '@/server/queries';
import { zonePaths, type Zone } from './paths';

const TONE: Record<QueueCategory, 'danger' | 'clay' | 'ochre' | 'teal' | 'neutral' | 'leaf'> = {
  mendesak: 'danger',
  susun_ulang: 'clay',
  ditahan: 'ochre',
  permintaan: 'clay',
  pilih_opsi: 'teal',
  baru: 'neutral',
  terkonfirmasi: 'leaf',
  selesai: 'neutral',
};

export function QueueView({
  items,
  zone,
  now,
  filter,
}: {
  items: QueueItem[];
  zone: Zone;
  now: number;
  filter?: string;
}) {
  const paths = zonePaths(zone);
  const open = items.filter((i) => i.category !== 'selesai');
  const counts = Object.fromEntries(
    (Object.keys(QUEUE_LABEL) as QueueCategory[]).map((c) => [
      c,
      items.filter((i) => i.category === c).length,
    ]),
  ) as Record<QueueCategory, number>;
  const shown = filter && filter in QUEUE_LABEL ? items.filter((i) => i.category === filter) : open;
  const needAction = open.filter((i) => !['terkonfirmasi'].includes(i.category)).length;

  return (
    <div className="container-page py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold tracking-wide text-clay uppercase">Antrean tindakan</p>
          <h1 className="text-3xl sm:text-4xl">{needAction} perjalanan pasien butuh tindakan</h1>
          <p className="mt-1 text-ink-soft">
            Urutan: kasus mendesak, perlu disusun ulang, lalu jadwal ditahan yang paling cepat berakhir.
          </p>
        </div>
        <LinkButton href={paths.newEpisode}>+ Episode baru</LinkButton>
      </div>

      <div className="mt-5">
        <Notice tone="clay" title="Sistem ini mengoordinasikan jadwal, bukan keputusan klinis.">
          Prioritas klinis hanya diisi tenaga kesehatan. Kasus mendesak ditangani langsung di luar sistem.
        </Notice>
      </div>

      <nav aria-label="Saring antrean" className="mt-6 flex flex-wrap gap-2">
        <Link
          href={paths.queue}
          className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${!filter ? 'border-teal bg-teal text-paper' : 'border-line bg-card'}`}
        >
          Semua aktif ({open.length})
        </Link>
        {(Object.keys(QUEUE_LABEL) as QueueCategory[])
          .filter((c) => counts[c] > 0)
          .map((c) => (
            <Link
              key={c}
              href={`${paths.queue}?filter=${c}`}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${filter === c ? 'border-teal bg-teal text-paper' : 'border-line bg-card'}`}
            >
              {QUEUE_LABEL[c]} ({counts[c]})
            </Link>
          ))}
      </nav>

      {shown.length === 0 ? (
        <div className="ticket mt-6 p-8 text-center">
          <p className="font-display text-2xl">Belum ada episode di sini.</p>
          <p className="mt-2 text-ink-soft">
            Satu episode = satu kebutuhan layanan pasien, disusun menjadi satu perjalanan.{' '}
            <a className="text-teal underline" href={links.site.caraKerja()}>
              Pelajari cara kerjanya
            </a>{' '}
            atau{' '}
            <a className="text-teal underline" href={links.site.faq()}>
              baca FAQ
            </a>
            .
          </p>
        </div>
      ) : (
        <ul className="mt-6 grid gap-3">
          {shown.map((i) => (
            <li key={i.episodeId}>
              <Link
                href={paths.episode(i.episodeId)}
                className="ticket grid gap-3 p-4 transition-shadow hover:shadow-lg sm:grid-cols-[1fr_auto] sm:items-center"
                data-testid="queue-item"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={TONE[i.category]}>{QUEUE_LABEL[i.category]}</Badge>
                    {i.priority === 'segera' && <Badge tone="clay">Prioritas: segera</Badge>}
                    {i.pendingDocs > 0 && <Badge tone="danger">{i.pendingDocs} dokumen belum siap</Badge>}
                    {i.requiresEscort && <Badge>Dengan pendamping</Badge>}
                    {i.openRequests > 0 && <Badge tone="clay">Minta ubah jadwal</Badge>}
                  </div>
                  <p className="mt-2 font-display text-xl">
                    {i.patient}{' '}
                    <span className="font-sans text-base font-normal text-muted">
                      · {i.origin}, ±{i.distanceKm} km
                    </span>
                  </p>
                  <p className="text-ink-soft">{i.planSummary ?? i.title}</p>
                </div>
                <div className="text-sm sm:text-right">
                  {i.holdExpiresAt !== null && (
                    <p>
                      Ditahan, berakhir <Countdown until={i.holdExpiresAt} now={now} />
                    </p>
                  )}
                  {i.firstVisit && (
                    <p className="text-muted">Kunjungan pertama {formatLocalDate(i.firstVisit)}</p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
