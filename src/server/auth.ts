import 'server-only';
import { and, eq, gt } from 'drizzle-orm';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { policy } from '@/config/policy';
import { links } from '@/config/links';
import { HOUR } from '@/lib/time';
import type { Role } from './context';
import { randomToken, sha256, verifyPassword } from './crypto';
import { getDb } from './db/client';
import { appUser, session } from './db/schema';
import { hitRateLimit } from './rateLimit';

export const SESSION_COOKIE = 'rs_session';
export const SIGNED_IN_HINT = 'rs_signed_in';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get('x-forwarded-for')?.split(',')[0] ?? h.get('x-real-ip') ?? 'local').trim();
}

const cookieBase = () => ({
  path: '/',
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
});

export async function login(email: string, password: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = getDb('app');
  const now = Date.now();
  if (!(await hitRateLimit(db, `login:${await clientIp()}`, policy.rateLimits.login.limit, policy.rateLimits.login.windowSec, now))) {
    return { ok: false, message: 'Terlalu banyak percobaan. Coba lagi dalam beberapa menit.' };
  }
  const [u] = await db.select().from(appUser).where(eq(appUser.email, email.trim().toLowerCase()));
  if (!u || !(await verifyPassword(password, u.passwordHash))) return { ok: false, message: 'Email atau kata sandi salah.' };
  const token = randomToken();
  const expiresAt = new Date(now + policy.sessionTtlHours * HOUR);
  await db.insert(session).values({ idHash: sha256(token), userId: u.id, expiresAt });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, { ...cookieBase(), httpOnly: true, expires: expiresAt });
  // Non-secret hint so the static company profile can show "Buka Dashboard".
  jar.set(SIGNED_IN_HINT, '1', { ...cookieBase(), httpOnly: false, expires: expiresAt });
  return { ok: true };
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await getDb('app').delete(session).where(eq(session.idHash, sha256(token)));
  jar.delete({ name: SESSION_COOKIE, ...cookieBase() });
  jar.delete({ name: SIGNED_IN_HINT, ...cookieBase() });
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await getDb('app')
    .select({ id: appUser.id, name: appUser.name, email: appUser.email, role: appUser.role })
    .from(session)
    .innerJoin(appUser, eq(appUser.id, session.userId))
    .where(and(eq(session.idHash, sha256(token)), gt(session.expiresAt, new Date())));
  return row ?? null;
}

/** For server components/pages: redirects to login, or to the dashboard when the role does not fit. */
export async function requireUser(...roles: Role[]): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) redirect(links.app.login());
  if (roles.length && !roles.includes(u.role)) redirect(links.app.dashboard() + '?akses=ditolak');
  return u;
}
