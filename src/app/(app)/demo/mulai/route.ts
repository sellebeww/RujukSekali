import { NextResponse, type NextRequest } from 'next/server';
import { links, safeReturnPath, type DemoStage } from '@/config/links';
import { policy } from '@/config/policy';
import type { ScenarioId } from '@seed/scenarios';
import { demoActor } from '@/server/actions/ctx';
import { makeCtx } from '@/server/context';
import { ensureDemoFresh } from '@/server/demo';
import { hitRateLimit } from '@/server/rateLimit';
import { runScenario } from '@/server/usecases/scenarios';

const SCENARIOS = new Set(['1', '2', '3', '4', '5']);
const STAGES = new Set(['susun', 'tahan', 'konfirmasi', 'jalani']);

/** Builds a fresh copy of a scenario inside the demo sandbox and redirects into it (coordinator or patient view). */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const scenario = (SCENARIOS.has(q.get('skenario') ?? '') ? q.get('skenario') : '1') as ScenarioId;
  const stage = (STAGES.has(q.get('tahap') ?? '') ? q.get('tahap') : 'susun') as DemoStage;
  const view = q.get('lihat') === 'pasien' ? 'pasien' : 'koordinator';
  await ensureDemoFresh();
  const ctx = makeCtx('demo', await demoActor());
  const ip = (req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'local').trim();
  const { limit, windowSec } = policy.rateLimits.demoStart;
  if (!(await hitRateLimit(ctx.db, `demo-start:${ip}`, limit, windowSec, Date.now()))) {
    return NextResponse.redirect(new URL(links.demo.home() + '?batas=1', req.url), 303);
  }
  const label = `Pasien Demo ${scenario}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const { episodeId, token } = await runScenario(ctx, scenario, stage, label);
  const target = new URL(view === 'pasien' ? links.demo.patient(token) : links.demo.episode(episodeId), req.url);
  const res = NextResponse.redirect(target, 303);
  const from = q.get('from');
  if (from) res.cookies.set('rs_demo_from', safeReturnPath(from), { path: '/demo', sameSite: 'lax', httpOnly: true });
  return res;
}
