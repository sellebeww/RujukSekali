import { cookies } from 'next/headers';
import { Notice } from '@/components/ui';
import { links } from '@/config/links';
import { PatientView } from '@/features/patient/PatientView';
import { PATIENT_COOKIE } from '@/server/actions/ctx';
import { SYSTEM_ACTOR, makeCtx } from '@/server/context';
import { loadEpisodeDetail } from '@/server/queries';
import { resolvePatientToken } from '@/server/usecases/episodes';
import { expireDueHolds } from '@/server/usecases/holds';

export const dynamic = 'force-dynamic';

export default async function PatientPage({ searchParams }: { searchParams: Promise<{ tautan?: string }> }) {
  const { tautan } = await searchParams;
  const token = (await cookies()).get(PATIENT_COOKIE)?.value;
  const ctx = makeCtx('app', SYSTEM_ACTOR);
  const episodeId = token ? await resolvePatientToken(ctx.db, token, ctx.clock.now()) : null;
  if (!episodeId) {
    return (
      <div className="container-page max-w-2xl py-12 text-lg">
        <h1 className="text-4xl">Tautan tidak bisa dibuka</h1>
        <div className="mt-4">
          <Notice tone="clay" role="alert">
            {tautan === 'terlalu-sering'
              ? 'Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.'
              : 'Tautan sudah tidak berlaku atau sudah dicabut. Minta tautan baru kepada petugas rumah sakit.'}
          </Notice>
        </div>
        <p className="mt-6">
          Ingin tahu cara kerja layanan ini?{' '}
          <a href={links.site.untukPasien()} rel="noopener noreferrer" className="text-teal underline">
            Baca penjelasan untuk pasien
          </a>
          .
        </p>
      </div>
    );
  }
  await expireDueHolds(ctx);
  const d = await loadEpisodeDetail(ctx.db, episodeId);
  if (!d) return null;
  return <PatientView d={d} zone="app" now={ctx.clock.now()} />;
}
