import { ActionForm } from '@/components/ActionForm';
import { Badge, Notice } from '@/components/ui';
import { formatLocalDateTime } from '@/lib/time';
import { leadStatusAction } from '@/server/actions/admin';
import { requireUser } from '@/server/auth';
import { makeCtx } from '@/server/context';
import { listLeads } from '@/server/usecases/leads';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Permintaan demo/pilot' };

export default async function Leads() {
  const u = await requireUser('system_admin');
  const leads = await listLeads(makeCtx('app', { type: 'user', id: u.id, label: u.name, role: u.role }));
  return (
    <div className="container-page py-8">
      <p className="text-sm font-semibold tracking-wide text-clay uppercase">Admin sistem</p>
      <h1 className="text-3xl sm:text-4xl">Permintaan demo &amp; pilot</h1>
      <div className="mt-4 max-w-3xl">
        <Notice tone="teal">
          Data kontak calon mitra disimpan terpisah dari data operasional pasien dan hanya dipakai untuk
          tindak lanjut.
        </Notice>
      </div>
      {leads.length === 0 ? (
        <p className="mt-6 text-ink-soft">Belum ada permintaan.</p>
      ) : (
        <ul className="mt-6 grid gap-3">
          {leads.map((l) => (
            <li key={l.id} className="ticket grid gap-3 p-4 md:grid-cols-[1fr_auto]" data-testid="lead">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={l.status === 'baru' ? 'clay' : 'neutral'}>{l.status}</Badge>
                  <span className="text-sm text-muted">{formatLocalDateTime(l.createdAt.getTime())} WIB</span>
                </div>
                <p className="mt-1 font-display text-xl">{l.organization}</p>
                <p>
                  {l.name} · {l.role} · {l.contactChannel}: {l.contactValue}
                </p>
                <p className="mt-1 text-ink-soft">{l.need}</p>
                <p className="mt-1 text-sm text-muted">
                  Persetujuan dicatat {formatLocalDateTime(l.consentAt.getTime())} (teks{' '}
                  {l.consentTextVersion})
                </p>
              </div>
              <div className="flex flex-wrap items-start gap-2">
                {(['dihubungi', 'selesai', 'ditolak'] as const).map((s) => (
                  <ActionForm
                    key={s}
                    action={leadStatusAction}
                    hidden={{ leadId: l.id, status: s }}
                    label={`Tandai ${s}`}
                    tone="secondary"
                  />
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
