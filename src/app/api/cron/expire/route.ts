import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { SYSTEM_ACTOR, makeCtx } from '@/server/context';
import { expireDueHolds } from '@/server/usecases/holds';

/** Scheduled expiry (e.g. every minute from a cron). Lazy expiry on reads covers gaps between runs. */
export async function POST(req: NextRequest) {
  const given = Buffer.from(req.headers.get('authorization')?.replace(/^Bearer /, '') ?? '');
  const expected = Buffer.from(process.env.CRON_SECRET ?? '');
  if (expected.length < 16 || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const out: Record<string, unknown> = {};
  for (const zone of ['app', 'demo'] as const) out[zone] = await expireDueHolds(makeCtx(zone, SYSTEM_ACTOR));
  return NextResponse.json(out);
}
