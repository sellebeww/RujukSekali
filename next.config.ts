import type { NextConfig } from 'next';

const dev = process.env.NODE_ENV !== 'production';
// shortcut: 'unsafe-inline' scripts are needed by Next's bootstrap without nonces; move to nonce-based CSP before production.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ');

const security = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const config: NextConfig = {
  poweredByHeader: false,
  env: {
    PUBLIC_SITE_URL: process.env.PUBLIC_SITE_URL ?? 'http://localhost:3000',
    APP_URL: process.env.APP_URL ?? 'http://localhost:3000',
  },
  async headers() {
    return [
      // Everything except patient pages: normal referrer policy.
      {
        source: '/((?!p$|p/|demo/pasien).*)',
        headers: [...security, { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }],
      },
      // Patient pages never leak their URL (or a token) through the Referer header.
      ...['/p', '/p/:path*', '/demo/pasien/:path*'].map((source) => ({
        source,
        headers: [...security, { key: 'Referrer-Policy', value: 'no-referrer' }, { key: 'Cache-Control', value: 'no-store' }],
      })),
    ];
  },
};

export default config;
