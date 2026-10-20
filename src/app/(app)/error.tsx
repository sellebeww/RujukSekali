'use client';

import { useEffect } from 'react';
import { links } from '@/config/links';

/** Shown instead of a bare 500 when the app or demo zone fails (e.g. the database is unreachable). */
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const digest = error instanceof Error && 'digest' in error ? String(error.digest) : null;

  return (
    <main id="isi" className="container-page flex-1 py-16">
      <p className="text-sm font-semibold tracking-wide text-clay uppercase">Layanan sedang terganggu</p>
      <h1 className="mt-2 text-4xl sm:text-5xl">Halaman ini belum bisa dimuat.</h1>
      <p className="mt-4 max-w-xl text-lg text-ink-soft">
        Sistem sedang tidak dapat menjangkau datanya. Coba lagi sebentar lagi. Bila Anda pasien dan butuh
        kepastian jadwal, hubungi petugas rumah sakit. Kondisi darurat: segera ke IGD atau hubungi 119.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          onClick={() => retry()}
          className="inline-flex min-h-11 items-center rounded-full bg-teal px-5 font-semibold text-paper hover:bg-ink"
        >
          Coba lagi
        </button>
        <a
          href={links.site.home()}
          className="inline-flex min-h-11 items-center rounded-full border border-line bg-card px-5 font-semibold hover:bg-paper-deep"
        >
          Kembali ke beranda
        </a>
      </div>
      {digest && <p className="mt-8 font-mono text-sm text-muted">Kode kejadian: {digest}</p>}
    </main>
  );
}
