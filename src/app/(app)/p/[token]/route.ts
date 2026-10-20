import { NextResponse, type NextRequest } from 'next/server';
import { policy } from '@/config/policy';
import { PATIENT_COOKIE } from '@/server/actions/ctx';
import { getDb } from '@/server/db/client';
import { hitRateLimit } from '@/server/rateLimit';
import { resolvePatientToken } from '@/server/usecases/episodes';

/** Exchanges the one-time-visible link token for an HttpOnly cookie, then drops the token from the URL. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = getDb('app');
  const ip = (req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'local').trim();
  const { limit, windowSec } = policy.rateLimits.patientToken;
  const target = new URL('/p', req.url);
  if (!(await hitRateLimit(db, `patient-token:${ip}`, limit, windowSec, Date.now()))) {
    target.searchParams.set('tautan', 'terlalu-sering');
    return NextResponse.redirect(target, 303);
  }
  const episodeId = await resolvePatientToken(db, token, Date.now());
  if (!episodeId) {
    target.searchParams.set('tautan', 'tidak-berlaku');
    return NextResponse.redirect(target, 303);
  }
  const res = NextResponse.redirect(target, 303);
  res.headers.set('Referrer-Policy', 'no-referrer');
  res.cookies.set(PATIENT_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/p',
    maxAge: policy.patientTokenTtlHours * 3600,
  });
  return res;
}
