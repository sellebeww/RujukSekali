import type { Metadata } from 'next';
import { LeadForm } from '@/components/marketing/LeadForm';
import { PageHero } from '@/components/marketing/PageHero';
import { Placeholder } from '@/components/ui';
import { brand } from '@/config/brand.config';
import { links } from '@/config/links';
import { CONSENT_TEXT } from '@/server/usecases/leads';

export const metadata: Metadata = {
  title: 'Minta demo atau pilot',
  description: 'Ajukan demo atau pilot untuk rumah sakit atau jaringan layanan Anda.',
};

export default function MintaDemo() {
  return (
    <>
      <PageHero
        eyebrow="Minta demo atau pilot"
        title="Ceritakan kebutuhan rumah sakit Anda."
        lead="Kami akan menghubungi Anda untuk menjadwalkan demo atau membahas pilot satu rumah sakit dengan dua layanan."
      />
      <div className="container-page grid gap-10 py-12 lg:grid-cols-[1.4fr_1fr]">
        <section className="ticket relative p-6" aria-label="Formulir permintaan">
          <LeadForm consentText={CONSENT_TEXT} />
        </section>
        <aside className="space-y-6">
          <div className="ticket p-5">
            <h2 className="font-sans text-lg font-bold">Ingin lihat dulu?</h2>
            <p className="mt-1 text-ink-soft">
              Mode demo bisa dicoba sekarang tanpa akun, dengan data sintetis.
            </p>
            <a href={links.app.login()} className="mt-3 inline-block font-semibold text-teal underline">
              Buka demo →
            </a>
          </div>
          <div id="kontak" className="ticket p-5">
            <h2 className="font-sans text-lg font-bold">Kontak</h2>
            <dl className="mt-2 space-y-2">
              <div>
                <dt className="text-sm text-muted">Email</dt>
                <dd>
                  <Placeholder>{brand.contact.email}</Placeholder>
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted">WhatsApp</dt>
                <dd>
                  <Placeholder>{brand.contact.whatsapp}</Placeholder>
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Alamat</dt>
                <dd>
                  <Placeholder>{brand.contact.address}</Placeholder>
                </dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </>
  );
}
