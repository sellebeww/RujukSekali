import type { ReactNode } from 'react';
import { Notice } from '@/components/ui';
import { PageHero } from './PageHero';

export function LegalDraft({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <PageHero eyebrow="Draf" title={title} />
      <div className="container-page max-w-3xl py-10">
        <Notice tone="ochre" role="note" title="Draf — perlu ditinjau hukum">
          Dokumen ini adalah draf awal untuk MVP dengan data sintetis dan belum ditinjau oleh penasihat hukum.
          Jangan dianggap final.
        </Notice>
        <div className="prose-rs mt-6">{children}</div>
      </div>
    </>
  );
}
