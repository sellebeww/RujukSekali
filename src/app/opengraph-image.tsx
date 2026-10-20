import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { brand } from '@/config/brand.config';

// Share preview for WhatsApp/LinkedIn/X: logo, name and tagline on the site's paper colour.
export const alt = `${brand.name} — ${brand.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpengraphImage() {
  const icon = await readFile(join(process.cwd(), 'public/icon.svg'));
  const iconSrc = `data:image/svg+xml;base64,${icon.toString('base64')}`;
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '0 96px',
        background: '#f4f8fb',
        color: '#0b2540',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
        <img src={iconSrc} width={132} height={132} alt="" />
        <div style={{ fontSize: 88, fontWeight: 800, color: '#1565c0', letterSpacing: -2 }}>{brand.name}</div>
      </div>
      <div style={{ marginTop: 44, fontSize: 52, fontWeight: 700, lineHeight: 1.15 }}>{brand.tagline}</div>
      <div style={{ marginTop: 20, fontSize: 30, color: '#34506b', maxWidth: 960 }}>
        Koordinasi jadwal lab, poli, dokumen, dan pendamping untuk pasien luar kota — dalam satu perjalanan.
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 14,
          background: 'linear-gradient(90deg, #1565c0, #0a9bb0 55%, #2fb77a)',
        }}
      />
    </div>,
    size,
  );
}
