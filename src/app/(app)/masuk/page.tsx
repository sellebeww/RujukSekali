import type { Metadata } from 'next';
import { ActionForm } from '@/components/ActionForm';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { Field, inputClass } from '@/components/ui';
import { links } from '@/config/links';
import { loginAction } from '@/server/actions/auth';

export const metadata: Metadata = { title: 'Masuk', robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <>
      <SiteHeader variant="app" />
      <main id="isi" className="container-page grid max-w-5xl gap-10 py-12 md:grid-cols-2">
        <div>
          <p className="text-sm font-semibold tracking-wide text-clay uppercase">Zona kerja</p>
          <h1 className="text-4xl">Masuk untuk koordinator dan admin</h1>
          <p className="mt-3 text-lg text-ink-soft">Akun hanya untuk petugas rumah sakit. Pasien tidak perlu akun — mereka menerima tautan dari petugas.</p>
          <p className="mt-6">
            Ingin melihat dulu?{' '}
            <a href={links.demo.home()} className="font-semibold text-teal underline">
              Coba mode demo tanpa akun
            </a>
            .
          </p>
          <p className="mt-6 flex gap-4 text-sm">
            <a href={links.site.tentang()} className="underline">
              Tentang layanan ini
            </a>
            <a href={links.site.keamananPrivasi()} className="underline">
              Privasi
            </a>
          </p>
        </div>
        <div className="ticket p-6">
          <ActionForm action={loginAction} hidden={{ next: next ?? '' }} label="Masuk">
            <Field label="Email" htmlFor="email">
              <input id="email" name="email" type="email" autoComplete="username" required className={inputClass} />
            </Field>
            <Field label="Kata sandi" htmlFor="password">
              <input id="password" name="password" type="password" autoComplete="current-password" required className={inputClass} />
            </Field>
          </ActionForm>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
