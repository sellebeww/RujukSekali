// The only place that knows URLs. Components never hard-code internal paths.
// When the profile and the app run on different origins (www vs app), links become absolute.

export const siteRoutes = {
  home: '/',
  caraKerja: '/cara-kerja',
  untukRumahSakit: '/untuk-rumah-sakit',
  untukPasien: '/untuk-pasien',
  keamananPrivasi: '/keamanan-privasi',
  tentang: '/tentang',
  hasilSimulasi: '/hasil-simulasi',
  mintaDemo: '/minta-demo',
  faq: '/faq',
  kebijakanPrivasi: '/kebijakan-privasi',
  syarat: '/syarat',
} as const;

export type SiteRoute = (typeof siteRoutes)[keyof typeof siteRoutes];

const siteOrigin = (process.env.PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const appOrigin = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const sameOrigin = siteOrigin === appOrigin;

const onSite = (path: string) => (sameOrigin ? path : siteOrigin + path);
const onApp = (path: string) => (sameOrigin ? path : appOrigin + path);
const anchor = (hash?: string) => (hash ? `#${hash}` : '');

export type DemoScenario = '1' | '2' | '3' | '4' | '5';
export type DemoStage = 'susun' | 'tahan' | 'konfirmasi' | 'jalani';

export const links = {
  site: {
    home: (hash?: string) => onSite(siteRoutes.home + anchor(hash)),
    caraKerja: (hash?: string) => onSite(siteRoutes.caraKerja + anchor(hash)),
    untukRumahSakit: () => onSite(siteRoutes.untukRumahSakit),
    untukPasien: (hash?: string) => onSite(siteRoutes.untukPasien + anchor(hash)),
    keamananPrivasi: () => onSite(siteRoutes.keamananPrivasi),
    tentang: () => onSite(siteRoutes.tentang),
    hasilSimulasi: () => onSite(siteRoutes.hasilSimulasi),
    mintaDemo: (hash?: string) => onSite(siteRoutes.mintaDemo + anchor(hash)),
    faq: (hash?: string) => onSite(siteRoutes.faq + anchor(hash)),
    kebijakanPrivasi: () => onSite(siteRoutes.kebijakanPrivasi),
    syarat: () => onSite(siteRoutes.syarat),
    sitemap: () => siteOrigin + '/sitemap.xml',
    absolute: (path: string) => siteOrigin + path,
  },
  app: {
    login: (next?: string) => onApp('/masuk' + (next ? `?next=${encodeURIComponent(next)}` : '')),
    logout: () => onApp('/keluar'),
    dashboard: () => onApp('/app'),
    episode: (id: string) => onApp(`/app/episode/${id}`),
    newEpisode: () => onApp('/app/episode/baru'),
    adminUnit: () => onApp('/app/admin/unit'),
    adminLeads: () => onApp('/app/admin/leads'),
    metrics: () => onApp('/app/metrik'),
    metricsCsv: () => onApp('/api/metrics.csv'),
    inbox: () => onApp('/app/dev/inbox'),
    audit: () => onApp('/app/audit'),
  },
  demo: {
    home: () => onApp('/demo'),
    coordinator: () => onApp('/demo/koordinator'),
    episode: (id: string) => onApp(`/demo/koordinator/episode/${id}`),
    newEpisode: () => onApp('/demo/koordinator/episode/baru'),
    audit: () => onApp('/demo/audit'),
    adminUnit: () => onApp('/demo/admin'),
    patient: (token: string) => onApp(`/demo/pasien/${token}`),
    inbox: () => onApp('/demo/inbox'),
    metrics: () => onApp('/demo/metrik'),
    /** Creates a fresh copy of a scenario in the demo sandbox and redirects into it. */
    start: (
      scenario: DemoScenario,
      opts: { stage?: DemoStage; view?: 'koordinator' | 'pasien'; from?: SiteRoute } = {},
    ) => {
      const q = new URLSearchParams({ skenario: scenario });
      if (opts.stage) q.set('tahap', opts.stage);
      if (opts.view) q.set('lihat', opts.view);
      if (opts.from) q.set('from', opts.from);
      return onApp(`/demo/mulai?${q.toString()}`);
    },
  },
  patient: {
    home: () => onApp('/p'),
    access: (token: string) => onApp(`/p/${token}`),
    absoluteAccess: (token: string) => appOrigin + `/p/${token}`,
  },
};

/** Adds `?from=` so "Kembali" can return to the profile page the visitor came from. */
export function withFrom(href: string, from: SiteRoute): string {
  return href + (href.includes('?') ? '&' : '?') + 'from=' + encodeURIComponent(from);
}

const allowedReturn = new Set<string>(Object.values(siteRoutes));

/**
 * Open-redirect guard: only exact internal profile paths (optionally with a simple #anchor) are accepted.
 * Anything else — absolute URLs, protocol-relative URLs, app paths, encoded tricks — falls back to home.
 */
export function safeReturnPath(from: string | null | undefined): SiteRoute {
  if (!from) return siteRoutes.home;
  const m = /^(\/[a-z-]*)(#[a-z0-9-]{1,40})?$/.exec(from);
  if (!m || !allowedReturn.has(m[1]!)) return siteRoutes.home;
  return from as SiteRoute;
}

export function returnHref(from: string | null | undefined): string {
  return onSite(safeReturnPath(from));
}
