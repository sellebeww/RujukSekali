import type { Metadata } from 'next';
import { PageHero } from '@/components/marketing/PageHero';
import { generalFaq, patientFaq } from '@/content/faq';

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Pertanyaan yang sering diajukan oleh rumah sakit, koordinator, dan pasien.',
};

export default function Faq() {
  const groups = [
    { title: 'Umum & rumah sakit', items: generalFaq },
    { title: 'Untuk pasien', items: patientFaq },
  ];
  return (
    <>
      <PageHero eyebrow="FAQ" title="Pertanyaan yang sering muncul." />
      <div className="container-page grid gap-10 py-12 lg:grid-cols-2">
        {groups.map((g) => (
          <section key={g.title} aria-labelledby={g.title}>
            <h2 id={g.title} className="text-3xl">
              {g.title}
            </h2>
            <div className="mt-4 space-y-3">
              {g.items.map((f) => (
                <details key={f.id} id={f.id} className="ticket p-5">
                  <summary className="cursor-pointer text-lg font-semibold">{f.q}</summary>
                  <p className="mt-2 text-ink-soft">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
