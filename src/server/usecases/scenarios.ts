import { and, asc, eq } from 'drizzle-orm';
import { SCENARIOS, type ScenarioId } from '@seed/scenarios';
import type { DemoStage } from '@/config/links';
import type { Ctx } from '../context';
import { document, seedMeta, tripPlan } from '../db/schema';
import { DomainError } from '../errors';
import {
  createEpisode,
  confirmEscortDays,
  issuePatientToken,
  uploadDocument,
  verifyDocument,
} from './episodes';
import { approvePlan, holdPlan } from './holds';
import { proposePlans } from './planning';

export async function seedStartDate(ctx: Ctx): Promise<string> {
  const [m] = await ctx.db.select().from(seedMeta).where(eq(seedMeta.id, 1));
  if (!m) throw new DomainError('NOT_SEEDED', 'Data contoh belum disiapkan.');
  return m.startDate;
}

const key = () => crypto.randomUUID();

/** Builds a fresh copy of a scenario and advances it to the requested stage using the real use-cases. */
export async function runScenario(ctx: Ctx, id: ScenarioId, stage: DemoStage, label: string) {
  const start = await seedStartDate(ctx);
  const { episodeId } = await createEpisode(ctx, SCENARIOS[id].build(start, label));
  const proposal = await proposePlans(ctx, episodeId);
  const best = proposal.planIds[0];
  if (stage !== 'susun' && best) {
    const held = await holdPlan(ctx, best, key());
    if (held.ok && (stage === 'konfirmasi' || stage === 'jalani')) {
      const docs = await ctx.db.select().from(document).where(eq(document.episodeId, episodeId));
      for (const d of docs.filter((d) => d.status !== 'verified')) {
        if (d.status !== 'uploaded') await uploadDocument(ctx, d.id, `${d.kind}-contoh.pdf`);
        await verifyDocument(ctx, d.id);
      }
      if (id === '3') await confirmEscortDays(ctx, episodeId);
      await approvePlan(ctx, best, key());
    }
  }
  const { token } = await issuePatientToken(ctx, episodeId);
  const [plan] = await ctx.db
    .select({ id: tripPlan.id, status: tripPlan.status })
    .from(tripPlan)
    .where(and(eq(tripPlan.episodeId, episodeId)))
    .orderBy(asc(tripPlan.rank));
  return { episodeId, token, planStatus: plan?.status ?? null };
}
