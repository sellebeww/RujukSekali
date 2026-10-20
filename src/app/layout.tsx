import type { Metadata, Viewport } from 'next';
import { Fraunces, Plus_Jakarta_Sans } from 'next/font/google';
import { brand } from '@/config/brand.config';
import { links } from '@/config/links';
import { Toaster } from '@/components/Toaster';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta', display: 'swap' });
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  weight: ['500', '600'],
});

export const metadata: Metadata = {
  metadataBase: new URL(links.site.absolute('/')),
  title: { default: `${brand.name} — ${brand.tagline}`, template: `%s · ${brand.name}` },
  description: brand.description,
  applicationName: brand.name,
  openGraph: {
    type: 'website',
    locale: 'id_ID',
    siteName: brand.name,
    title: `${brand.name} — ${brand.tagline}`,
    description: brand.description,
  },
  twitter: { card: 'summary_large_image' },
  icons: { icon: '/icon.svg?v=2' },
};

export const viewport: Viewport = { themeColor: brand.themeColor, width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${jakarta.variable} ${fraunces.variable}`}>
      <body>
        <a href="#isi" className="skip-link">
          Langsung ke isi
        </a>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
