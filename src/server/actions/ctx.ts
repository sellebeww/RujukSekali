import 'server-only';
import { eq } from 'drizzle-orm';
import { cookies, headers } from 'next/headers';
import { policy } from '@/config/policy';
import { clientIp, getSessionUser } from '../auth';
import { makeCtx, type Actor, type Ctx } from '../context';
import { getDb } from '../db/client';
import { appUser } from '../db/schema';
import { DomainError, ForbiddenError } from '../errors';
import { hitRateLimit } from '../rateLimit';
import { resolvePatientToken } from '../usecases/episodes';

export type ZoneParam = 'app' | 'demo';

export function parseZone(v: FormDataEntryValue | null): ZoneParam {
  return v === 'demo' ? 'demo' : 'app';
}

async function correlationId() {
  return (await headers()).get('x-correlation-id') ?? crypto.randomUUID();
}

let demoActorCache: Actor | undefined;
export async function demoActor(): Promise<Actor> {
  if (demoActorCache) return demoActorCache;
  const [u] = await getDb('demo').select().from(appUser).where(eq(appUser.role, 'coordinator'));
  if (!u) throw new DomainError('NOT_SEEDED', 'Sandbox demo belum siap.');
  demoActorCache = { type: 'demo', id: u.id, label: 'Koordinator Demo', role: 'coordinator' };
  return demoActorCache;
}

/** Staff context for the real app (session required) or the rate-limited demo sandbox actor. */
export async function staffCtx(zone: ZoneParam): Promise<Ctx> {
  const cid = await correlationId();
  if (zone === 'demo') {
    const ok = await hitRateLimit(
      getDb('demo'),
      `demo-write:${await clientIp()}`,
      policy.rateLimits.demoWrite.limit,
      policy.rateLimits.demoWrite.windowSec,
      Date.now(),
    );
    if (!ok) throw new DomainError('RATE_LIMIT', 'Terlalu banyak aksi di demo. Tunggu beberapa menit.', 429);
    return makeCtx('demo', await demoActor(), cid);
  }
  const u = await getSessionUser();
  if (!u) throw new ForbiddenError('Sesi Anda berakhir. Silakan masuk lagi.');
  return makeCtx('app', { type: 'user', id: u.id, label: u.name, role: u.role }, cid);
}

export const PATIENT_COOKIE = 'rs_patient';

/** Patient context: the episode comes from the HttpOnly cookie (real) or the demo token in the form, never a raw id. */
export async function patientCtx(zone: ZoneParam, demoToken?: string | null): Promise<{ ctx: Ctx; episodeId: string }> {
  const cid = await correlationId();
  const token = zone === 'demo' ? demoToken : (await cookies()).get(PATIENT_COOKIE)?.value;
  if (!token) throw new ForbiddenError('Tautan tidak berlaku. Minta tautan baru ke petugas.');
  const db = getDb(zone);
  const episodeId = await resolvePatientToken(db, token, Date.now());
  if (!episodeId) throw new ForbiddenError('Tautan sudah tidak berlaku. Minta tautan baru ke petugas.');
  return {
    ctx: makeCtx(zone, { type: 'patient', id: episodeId, label: 'Pasien/pendamping', role: null }, cid),
    episodeId,
  };
}

export interface ActionState {
  ok: boolean | null;
  message: string;
  details?: string[];
  /** Shown once, e.g. a freshly issued patient link. */
  secret?: string;
}

export const initialState: ActionState = { ok: null, message: '' };

/** Wraps an action body: domain errors become friendly messages; anything else is logged and hidden. */
export async function run(body: () => Promise<ActionState>): Promise<ActionState> {
  try {
    return await body();
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, message: e.message };
    if (e && typeof e === 'object' && 'digest' in e) throw e; // Next.js redirect/notFound
    console.error(JSON.stringify({ level: 'error', event: 'action_failed', error: (e as Error).message }));
    return { ok: false, message: 'Terjadi kesalahan. Tidak ada perubahan yang disimpan sebagian; silakan coba lagi.' };
  }
}
