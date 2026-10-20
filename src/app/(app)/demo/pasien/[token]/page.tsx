import { Notice } from '@/components/ui';
import { links } from '@/config/links';
import { PatientView } from '@/features/patient/PatientView';
import { SYSTEM_ACTOR, makeCtx } from '@/server/context';
import { loadEpisodeDetail } from '@/server/queries';
import { resolvePatientToken } from '@/server/usecases/episodes';
import { expireDueHolds } from '@/server/usecases/holds';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tampilan pasien', referrer: 'no-referrer' };

/** Demo-only: the synthetic demo token stays in the URL (it opens nothing outside the sandbox). */
export default async function DemoPatient({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ctx = makeCtx('demo', SYSTEM_ACTOR);
  const episodeId = await resolvePatientToken(ctx.db, token, ctx.clock.now());
  if (!episodeId) {
    return (
      <div className="container-page max-w-2xl py-12">
        <Notice
          tone="clay"
          role="alert"
          title="Tautan demo ini sudah tidak berlaku (sandbox diperbarui berkala)."
        >
          <a href={links.demo.start('1', { view: 'pasien', stage: 'tahan' })} className="text-teal underline">
            Buat contoh perjalanan pasien baru
          </a>
        </Notice>
      </div>
    );
  }
  await expireDueHolds(ctx);
  const d = await loadEpisodeDetail(ctx.db, episodeId);
  if (!d) return null;
  return (
    <>
      <div className="container-page max-w-3xl pt-6">
        <Notice tone="teal">
          Ini tampilan yang dilihat pasien/pendamping lewat tautan dari petugas.{' '}
          <a href={links.demo.episode(episodeId)} className="font-semibold underline">
            Lihat episode ini dari sisi koordinator
          </a>
          .
        </Notice>
      </div>
      <PatientView d={d} zone="demo" token={token} now={ctx.clock.now()} />
    </>
  );
}
