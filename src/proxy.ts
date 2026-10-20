import { NextResponse, type NextRequest } from 'next/server';
import { safeReturnPath, siteRoutes } from '@/config/links';

const siteUrl = new URL(process.env.PUBLIC_SITE_URL ?? 'http://localhost:3000');
const appUrl = new URL(process.env.APP_URL ?? 'http://localhost:3000');
const splitHosts = siteUrl.host !== appUrl.host;
const marketingPaths = new Set<string>(Object.values(siteRoutes));
const isAppPath = (p: string) => /^\/(app|demo|p|masuk|keluar|api)(\/|$)/.test(p);

export function proxy(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // Two-domain deployments: send each path to the zone that owns it.
  if (splitHosts) {
    if (req.nextUrl.host === siteUrl.host && isAppPath(pathname)) {
      return NextResponse.redirect(new URL(pathname + req.nextUrl.search, appUrl));
    }
    if (req.nextUrl.host === appUrl.host && marketingPaths.has(pathname) && pathname !== '/') {
      return NextResponse.redirect(new URL(pathname, siteUrl));
    }
  }

  if (pathname.startsWith('/app') && !req.cookies.get('rs_session')) {
    const login = req.nextUrl.clone();
    login.pathname = '/masuk';
    login.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(login);
  }

  const correlationId = req.headers.get('x-correlation-id') ?? crypto.randomUUID();
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-correlation-id', correlationId);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set('x-correlation-id', correlationId);

  // Remember where a demo visitor came from so "Kembali ke situs" returns there (whitelisted paths only).
  const from = searchParams.get('from');
  if (pathname.startsWith('/demo') && from) {
    res.cookies.set('rs_demo_from', safeReturnPath(from), { path: '/demo', sameSite: 'lax', httpOnly: true });
  }
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|icon.svg|favicon.ico|robots.txt|sitemap.xml).*)'],
};
