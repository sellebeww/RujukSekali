import {
  addDays,
  dayOfWeek,
  daysBetween,
  formatIdr,
  formatLocalDate,
  formatLocalTime,
  hhmmToMin,
  localMinuteOfDay,
  localToUtc,
  MINUTE,
} from '../lib/time';
import type {
  CandidatePlan,
  CostBreakdown,
  GapStrategy,
  PlannedTrip,
  PlannedVisit,
  PlanningInput,
  PlanningResult,
  PrecedenceRule,
  Rejection,
  RejectionCode,
  ServiceSpec,
  SlotSnapshot,
  TransportOption,
} from './types';

const DEFAULTS = {
  arrivalBufferMin: 30,
  departureBufferMin: 30,
  minLeadMin: 120,
  maxPlans: 3,
  maxNodes: 20_000,
  maxSpanDays: 14,
};

export class PlanningInputError extends Error {}

export function topoOrder(services: ServiceSpec[], precedence: PrecedenceRule[]): string[] {
  const codes = services.map((s) => s.code).sort();
  const indeg = new Map(codes.map((c) => [c, 0]));
  for (const r of precedence) {
    if (!indeg.has(r.before) || !indeg.has(r.after)) {
      throw new PlanningInputError(
        `Aturan urutan merujuk layanan yang tidak diminta: ${r.before} → ${r.after}`,
      );
    }
    indeg.set(r.after, indeg.get(r.after)! + 1);
  }
  const out: string[] = [];
  const ready = codes.filter((c) => indeg.get(c) === 0);
  while (ready.length) {
    ready.sort();
    const c = ready.shift()!;
    out.push(c);
    for (const r of precedence) {
      if (r.before !== c) continue;
      const n = indeg.get(r.after)! - 1;
      indeg.set(r.after, n);
      if (n === 0) ready.push(r.after);
    }
  }
  if (out.length !== codes.length) throw new PlanningInputError('Aturan urutan layanan membentuk siklus.');
  return out;
}

interface FilterStats {
  total: number;
  outsideWindow: number;
  tooSoon: number;
  fasting: number;
  holdCap: number;
  escort: number;
  kept: number;
  escortExcludedDates: Set<string>;
  holdCapDates: Set<string>;
}

const byStartThenId = (a: SlotSnapshot, b: SlotSnapshot) =>
  a.startsAt - b.startsAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

type Failure = { code: RejectionCode; date: string; service?: string };

interface Ctx {
  input: PlanningInput;
  opts: typeof DEFAULTS;
  order: string[];
  svc: Map<string, ServiceSpec>;
  preds: Map<string, PrecedenceRule[]>;
  /** service -> date -> slots sorted by start/id */
  slotsByDay: Map<string, Map<string, SlotSnapshot[]>>;
  travellers: number;
}

export function planTrips(input: PlanningInput): PlanningResult {
  return planInternal(input, true);
}

function planInternal(input: PlanningInput, allowRelax: boolean): PlanningResult {
  const opts: typeof DEFAULTS = {
    arrivalBufferMin: input.arrivalBufferMin ?? DEFAULTS.arrivalBufferMin,
    departureBufferMin: input.departureBufferMin ?? DEFAULTS.departureBufferMin,
    minLeadMin: input.minLeadMin ?? DEFAULTS.minLeadMin,
    maxPlans: input.maxPlans ?? DEFAULTS.maxPlans,
    maxNodes: input.maxNodes ?? DEFAULTS.maxNodes,
    maxSpanDays: input.maxSpanDays ?? DEFAULTS.maxSpanDays,
  };
  const empty = (status: PlanningResult['status'], rejections: Rejection[]): PlanningResult => ({
    status,
    plans: [],
    rejections,
    notes: [],
    truncated: false,
    nodesExplored: 0,
  });

  if (input.urgent) {
    return empty('manual', [
      {
        code: 'URGENT_MANUAL',
        message:
          'Episode ditandai mendesak. Sistem tidak menyusun jadwal otomatis; koordinator dan tenaga kesehatan menangani langsung di luar sistem.',
      },
    ]);
  }
  if (input.services.length === 0 || daysBetween(input.earliestDate, input.latestDate) < 0) {
    return empty('no_plan', [
      { code: 'INVALID_INPUT', message: 'Layanan atau jendela waktu episode tidak valid.' },
    ]);
  }

  let order: string[];
  try {
    order = topoOrder(input.services, input.precedence);
  } catch (e) {
    return empty('no_plan', [{ code: 'INVALID_INPUT', message: (e as Error).message }]);
  }

  const svc = new Map(input.services.map((s) => [s.code, s]));
  const preds = new Map<string, PrecedenceRule[]>(order.map((c) => [c, []]));
  for (const r of input.precedence) preds.get(r.after)!.push(r);

  const { slotsByDay, stats } = prefilter(input, opts, svc);
  const ctx: Ctx = {
    input,
    opts,
    order,
    svc,
    preds,
    slotsByDay,
    travellers: input.requiresEscort ? 2 : 1,
  };

  const candidates: CandidatePlan[] = [];
  const failures: Failure[] = [];
  let nodes = 0;
  let truncated = false;

  const assign = new Map<string, string>();
  const rec = (i: number) => {
    if (truncated) return;
    if (++nodes > opts.maxNodes) {
      truncated = true;
      return;
    }
    if (i === order.length) {
      evaluate(ctx, assign, candidates, failures);
      return;
    }
    const code = order[i]!;
    let minDay = input.earliestDate;
    for (const r of preds.get(code)!) {
      const d = assign.get(r.before)!;
      if (d > minDay) minDay = d;
    }
    const assigned = [...assign.values()];
    const lo = assigned.reduce((m, d) => (d < m ? d : m), '9999-12-31');
    const days = [...(slotsByDay.get(code)?.keys() ?? [])].sort();
    for (const day of days) {
      if (day < minDay) continue;
      const first = day < lo ? day : lo;
      const last = assigned.reduce((m, d) => (d > m ? d : m), day);
      if (daysBetween(first, last) > opts.maxSpanDays) continue;
      assign.set(code, day);
      rec(i + 1);
      assign.delete(code);
    }
  };
  rec(0);

  candidates.sort(compareScore);
  const plans = pickDiverse(candidates, opts.maxPlans);
  for (const p of plans) addComparison(p, candidates);

  const notes = buildNotes(ctx, stats, failures, plans);
  if (plans.length > 0) {
    return { status: 'ok', plans, rejections: [], notes, truncated, nodesExplored: nodes };
  }

  const rejections = buildRejections(ctx, stats, failures);
  if (allowRelax) {
    const relaxed = planInternal({ ...input, latestDate: addDays(input.latestDate, 21) }, false);
    const best = relaxed.plans[0];
    if (best) {
      rejections.push({
        code: 'NEAREST_OUTSIDE_WINDOW',
        message: `Opsi terdekat di luar jendela waktu klinis: ${best.summary}. Menggeser jendela memerlukan persetujuan tenaga kesehatan.`,
        localDate: best.visits[0]?.localDate,
      });
    }
  }
  return { status: 'no_plan', plans: [], rejections, notes, truncated, nodesExplored: nodes };
}

function prefilter(input: PlanningInput, opts: typeof DEFAULTS, svc: Map<string, ServiceSpec>) {
  const escortByDate = new Map<string, { from: number; to: number }[]>();
  for (const w of input.escortWindows) {
    const list = escortByDate.get(w.localDate) ?? [];
    list.push({ from: hhmmToMin(w.fromLocal), to: hhmmToMin(w.toLocal) });
    escortByDate.set(w.localDate, list);
  }
  const capped = new Set(input.holdCapReached.map((h) => `${h.serviceCode}|${h.localDate}`));
  const minStart = input.nowMs + opts.minLeadMin * MINUTE;

  const stats = new Map<string, FilterStats>();
  const slotsByDay = new Map<string, Map<string, SlotSnapshot[]>>();
  for (const code of svc.keys()) {
    stats.set(code, {
      total: 0,
      outsideWindow: 0,
      tooSoon: 0,
      fasting: 0,
      holdCap: 0,
      escort: 0,
      kept: 0,
      escortExcludedDates: new Set(),
      holdCapDates: new Set(),
    });
    slotsByDay.set(code, new Map());
  }

  for (const slot of [...input.slots].sort(byStartThenId)) {
    const s = svc.get(slot.serviceCode);
    const st = stats.get(slot.serviceCode);
    if (!s || !st) continue;
    st.total++;
    if (slot.localDate < input.earliestDate || slot.localDate > input.latestDate) {
      st.outsideWindow++;
      continue;
    }
    if (slot.startsAt < minStart) {
      st.tooSoon++;
      continue;
    }
    if (s.fasting && s.latestStartLocal && localMinuteOfDay(slot.startsAt) > hhmmToMin(s.latestStartLocal)) {
      st.fasting++;
      continue;
    }
    if (capped.has(`${slot.serviceCode}|${slot.localDate}`)) {
      st.holdCap++;
      st.holdCapDates.add(slot.localDate);
      continue;
    }
    if (input.requiresEscort) {
      const startMin = localMinuteOfDay(slot.startsAt);
      const endMin = startMin + Math.round((slot.endsAt - slot.startsAt) / MINUTE);
      const ok = (escortByDate.get(slot.localDate) ?? []).some((w) => w.from <= startMin && endMin <= w.to);
      if (!ok) {
        st.escort++;
        st.escortExcludedDates.add(slot.localDate);
        continue;
      }
    }
    st.kept++;
    const days = slotsByDay.get(slot.serviceCode)!;
    const list = days.get(slot.localDate) ?? [];
    list.push(slot);
    days.set(slot.localDate, list);
  }
  return { slotsByDay, stats };
}

function evaluate(ctx: Ctx, assign: Map<string, string>, out: CandidatePlan[], failures: Failure[]) {
  const days = [...new Set(assign.values())].sort();
  const gaps = days.slice(1).map((d, i) => daysBetween(days[i]!, d));
  const strategies = enumerateStrategies(gaps, ctx.input.cost.maxLodgingNights);
  for (const strategy of strategies) {
    const res = schedule(ctx, assign, days, strategy);
    if ('failure' in res) {
      failures.push({ ...res.failure });
      continue;
    }
    out.push(buildCandidate(ctx, res.visits, res.trips, strategy));
  }
}

function enumerateStrategies(gaps: number[], maxLodging: number): GapStrategy[][] {
  let acc: GapStrategy[][] = [[]];
  for (const g of gaps) {
    const next: GapStrategy[][] = [];
    for (const s of acc) {
      if (g <= maxLodging) next.push([...s, 'menginap']);
      next.push([...s, 'pulang']);
    }
    acc = next;
  }
  return acc;
}

function schedule(
  ctx: Ctx,
  assign: Map<string, string>,
  days: string[],
  strategy: GapStrategy[],
): { visits: PlannedVisit[]; trips: PlannedTrip[] } | { failure: Failure } {
  const segments: string[][] = [[days[0]!]];
  strategy.forEach((s, i) => {
    if (s === 'menginap') segments[segments.length - 1]!.push(days[i + 1]!);
    else segments.push([days[i + 1]!]);
  });

  const scheduled = new Map<string, PlannedVisit>();
  const trips: PlannedTrip[] = [];
  for (const seg of segments) {
    const first = seg[0]!;
    const last = seg[seg.length - 1]!;
    const options = ctx.input.transport
      .filter((o) => o.daysOfWeek.includes(dayOfWeek(first)) && o.daysOfWeek.includes(dayOfWeek(last)))
      .sort((a, b) => a.fareIdr - b.fareIdr || (a.id < b.id ? -1 : 1));
    if (options.length === 0) return { failure: { code: 'TRANSPORT_UNAVAILABLE', date: first } };

    let lastFailure: Failure | undefined;
    let done = false;
    for (const opt of options) {
      const r = tryTrip(ctx, assign, seg, opt, scheduled);
      if ('failure' in r) {
        lastFailure = r.failure;
        continue;
      }
      for (const v of r.visits) scheduled.set(v.serviceCode, v);
      trips.push({
        startDate: first,
        endDate: last,
        transportId: opt.id,
        transportLabel: opt.label,
        departLocal: opt.departLocal,
        arriveLocal: opt.arriveLocal,
        returnDepartLocal: opt.returnDepartLocal,
        returnArriveLocal: opt.returnArriveLocal,
        lodgingNights: daysBetween(first, last),
      });
      done = true;
      break;
    }
    if (!done) return { failure: lastFailure! };
  }
  const visits = ctx.order.map((c) => scheduled.get(c)!);
  return { visits, trips };
}

function tryTrip(
  ctx: Ctx,
  assign: Map<string, string>,
  seg: string[],
  opt: TransportOption,
  earlier: Map<string, PlannedVisit>,
): { visits: PlannedVisit[] } | { failure: Failure } {
  const local = new Map(earlier);
  const visits: PlannedVisit[] = [];
  const { arrivalBufferMin, departureBufferMin } = ctx.opts;
  let lastEnd = 0;
  for (const day of seg) {
    const dayStart = localToUtc(day, '00:00');
    let cursor = day === seg[0] ? localToUtc(day, opt.arriveLocal) + arrivalBufferMin * MINUTE : dayStart;
    for (const code of ctx.order) {
      if (assign.get(code) !== day) continue;
      let bound = cursor;
      let precedenceBound = 0;
      for (const r of ctx.preds.get(code)!) {
        const v = local.get(r.before)!;
        const ready = v.endsAt + ctx.svc.get(r.before)!.resultReadyMin * MINUTE + r.minGapMin * MINUTE;
        precedenceBound = Math.max(precedenceBound, ready);
      }
      bound = Math.max(bound, precedenceBound);
      const slot = ctx.slotsByDay
        .get(code)!
        .get(day)!
        .find((s) => s.startsAt >= bound);
      if (!slot) {
        const code2: RejectionCode =
          precedenceBound > cursor
            ? 'PRECEDENCE_UNSATISFIABLE'
            : day === seg[0]
              ? 'TRANSPORT_TIMING'
              : 'NO_SLOTS_IN_WINDOW';
        return { failure: { code: code2, date: day, service: code } };
      }
      const s = ctx.svc.get(code)!;
      const v: PlannedVisit = {
        slotId: slot.id,
        serviceCode: code,
        serviceName: s.name,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        localDate: day,
        resultReadyAt: slot.endsAt + s.resultReadyMin * MINUTE,
        ...(s.prepNote ? { prepNote: s.prepNote } : {}),
      };
      visits.push(v);
      local.set(code, v);
      cursor = slot.endsAt;
      lastEnd = slot.endsAt;
    }
  }
  const lastDay = seg[seg.length - 1]!;
  if (lastEnd + departureBufferMin * MINUTE > localToUtc(lastDay, opt.returnDepartLocal)) {
    return { failure: { code: 'TRANSPORT_TIMING', date: lastDay } };
  }
  return { visits };
}

function buildCandidate(
  ctx: Ctx,
  visits: PlannedVisit[],
  trips: PlannedTrip[],
  strategy: GapStrategy[],
): CandidatePlan {
  const { input, travellers } = ctx;
  const fareById = new Map(input.transport.map((t) => [t.id, t.fareIdr]));
  const transportIdr = trips.reduce((sum, t) => sum + 2 * fareById.get(t.transportId)! * travellers, 0);
  const lodgingIdr = trips.reduce((sum, t) => sum + t.lodgingNights * input.cost.lodgingPerNightIdr, 0);
  const daysAway = trips.reduce((sum, t) => sum + t.lodgingNights + 1, 0);
  const lostIncomeIdr = input.cost.includeLostIncome
    ? daysAway * input.cost.lostIncomePerDayIdr * travellers
    : 0;
  const cost: CostBreakdown = {
    transportIdr,
    lodgingIdr,
    lostIncomeIdr,
    totalIdr: transportIdr + lodgingIdr + lostIncomeIdr,
  };

  const visitDays = new Set(visits.map((v) => v.localDate)).size;
  const lastDate = visits.reduce((m, v) => (v.localDate > m ? v.localDate : m), visits[0]!.localDate);
  const delayDays = Math.max(0, daysBetween(input.desiredDate ?? input.earliestDate, lastDate));
  const heldSlotMinutes = visits.reduce(
    (sum, v) =>
      sum + Math.max(0, Math.min(input.holdTtlMin, Math.round((v.startsAt - input.nowMs) / MINUTE))),
    0,
  );
  const firstStart = Math.min(...visits.map((v) => v.startsAt));
  const key = visits.map((v) => `${v.serviceCode}@${v.slotId}`).join('+') + '|' + strategy.join(',');

  const plan: CandidatePlan = {
    key,
    visits,
    trips,
    strategy,
    visitDays,
    cost,
    travellers,
    delayDays,
    heldSlotMinutes,
    score: [visitDays, cost.totalIdr, delayDays, heldSlotMinutes, firstStart, key],
    summary: '',
    explanation: [],
  };
  plan.summary = summarize(plan);
  plan.explanation = explain(ctx, plan);
  return plan;
}

export function compareScore(a: { score: (number | string)[] }, b: { score: (number | string)[] }): number {
  for (let i = 0; i < a.score.length; i++) {
    const x = a.score[i]!;
    const y = b.score[i]!;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}

function pickDiverse(sorted: CandidatePlan[], max: number): CandidatePlan[] {
  const out: CandidatePlan[] = [];
  const seen = new Set<string>();
  const perDays = new Map<string, number>();
  for (const c of sorted) {
    const days = [...new Set(c.visits.map((v) => v.localDate))].join(',');
    const sig = days + '|' + c.strategy.join(',');
    if (seen.has(sig) || (perDays.get(days) ?? 0) >= 2) continue;
    seen.add(sig);
    perDays.set(days, (perDays.get(days) ?? 0) + 1);
    out.push(c);
    if (out.length === max) break;
  }
  return out;
}

function summarize(p: CandidatePlan): string {
  const dates = [...new Set(p.visits.map((v) => v.localDate))].map(formatLocalDate).join(' & ');
  const nights = p.trips.reduce((s, t) => s + t.lodgingNights, 0);
  const tripTxt =
    p.trips.length > 1
      ? `, ${p.trips.length} kali perjalanan`
      : nights > 0
        ? `, menginap ${nights} malam`
        : '';
  return `${p.visitDays} hari kunjungan (${dates})${tripTxt} · perkiraan ${formatIdr(p.cost.totalIdr)}`;
}

function explain(ctx: Ctx, p: CandidatePlan): string[] {
  const lines: string[] = [];
  const nights = p.trips.reduce((s, t) => s + t.lodgingNights, 0);
  if (p.visitDays === 1) {
    lines.push(`Cukup 1 kali datang, pada ${formatLocalDate(p.visits[0]!.localDate)}.`);
  } else if (p.trips.length === 1) {
    lines.push(
      `${p.visitDays} hari kunjungan dalam 1 kali perjalanan, menginap ${nights} malam di dekat rumah sakit.`,
    );
  } else {
    lines.push(`${p.visitDays} hari kunjungan dalam ${p.trips.length} kali perjalanan pulang-pergi.`);
  }
  for (const v of p.visits) {
    const s = ctx.svc.get(v.serviceCode)!;
    const fast = s.fasting ? ' (datang dalam keadaan puasa)' : '';
    const result = s.resultReadyMin > 0 ? `, hasil siap sekitar ${formatLocalTime(v.resultReadyAt)}` : '';
    lines.push(
      `${formatLocalDate(v.localDate)} ${formatLocalTime(v.startsAt)}: ${v.serviceName}${fast}${result}.`,
    );
  }
  for (const r of ctx.input.precedence) {
    const a = p.visits.find((v) => v.serviceCode === r.before)!;
    const b = p.visits.find((v) => v.serviceCode === r.after)!;
    lines.push(
      `${b.serviceName} dijadwalkan setelah hasil ${a.serviceName} siap, jadi hasilnya bisa langsung dibahas.`,
    );
  }
  for (const t of p.trips) {
    lines.push(
      `Transportasi: ${t.transportLabel}, berangkat ${t.departLocal} tiba ${t.arriveLocal}` +
        (t.startDate === t.endDate ? '' : ` (${formatLocalDate(t.startDate)})`) +
        `; pulang ${t.returnDepartLocal} tiba ${t.returnArriveLocal}` +
        (t.startDate === t.endDate ? '' : ` (${formatLocalDate(t.endDate)})`) +
        '.',
    );
  }
  const parts = [`transportasi ${formatIdr(p.cost.transportIdr)}`];
  if (p.cost.lodgingIdr) parts.push(`penginapan ${formatIdr(p.cost.lodgingIdr)}`);
  if (p.cost.lostIncomeIdr)
    parts.push(`perkiraan penghasilan yang hilang ${formatIdr(p.cost.lostIncomeIdr)}`);
  const who = p.travellers > 1 ? ' untuk pasien dan 1 pendamping' : '';
  lines.push(`Perkiraan biaya${who}: ${formatIdr(p.cost.totalIdr)} (${parts.join(', ')}).`);
  if (p.delayDays > 0) lines.push(`Selesai ${p.delayDays} hari setelah tanggal yang diharapkan.`);
  return lines;
}

/** Scenario 4: compare a multi-day plan with the same visits under the other gap strategy. */
function addComparison(plan: CandidatePlan, all: CandidatePlan[]) {
  if (plan.strategy.length === 0) return;
  const days = plan.visits.map((v) => v.localDate).join(',');
  const other = all.find(
    (c) =>
      c !== plan &&
      c.visits.map((v) => v.localDate).join(',') === days &&
      c.strategy.join(',') !== plan.strategy.join(','),
  );
  if (!other) return;
  const diff = other.cost.totalIdr - plan.cost.totalIdr;
  const label = (s: GapStrategy[]) =>
    s.every((x) => x === 'pulang')
      ? `pulang-pergi ${s.length + 1} kali`
      : 'menginap di antara hari kunjungan';
  const verdict =
    diff > 0
      ? `lebih hemat ${formatIdr(diff)}`
      : diff < 0
        ? `lebih mahal ${formatIdr(-diff)}`
        : 'biayanya sama';
  plan.explanation.push(
    `Perbandingan: dibanding ${label(other.strategy)} (perkiraan ${formatIdr(other.cost.totalIdr)}), rencana ini ${verdict}.`,
  );
}

function serviceName(ctx: Ctx, code?: string) {
  return (code && ctx.svc.get(code)?.name) || 'layanan';
}

function buildNotes(
  ctx: Ctx,
  stats: Map<string, FilterStats>,
  failures: Failure[],
  plans: CandidatePlan[],
): string[] {
  const notes: string[] = [];
  const best = plans[0];
  if (!best) return notes;
  const bestFirst = best.visits.map((v) => v.localDate).sort()[0]!;

  if (best.visitDays > 1 && ctx.order.length > 1) {
    const commonDays = [...ctx.slotsByDay.get(ctx.order[0]!)!.keys()].filter((d) =>
      ctx.order.every((c) => ctx.slotsByDay.get(c)!.has(d)),
    );
    if (commonDays.length === 0) {
      notes.push(
        `Tidak ada hari dalam jendela waktu yang punya jadwal kosong untuk semua layanan sekaligus.`,
      );
    } else {
      const sameDay = failures.filter((f) => commonDays.includes(f.date));
      const prec = sameDay.find((f) => f.code === 'PRECEDENCE_UNSATISFIABLE');
      const rule = ctx.input.precedence.find((r) => r.after === prec?.service);
      if (prec && rule) {
        notes.push(
          `Belum bisa selesai dalam 1 hari: tidak ada jadwal ${serviceName(ctx, rule.after)} yang kosong setelah hasil ${serviceName(ctx, rule.before)} siap di hari yang sama.`,
        );
      } else if (sameDay.some((f) => f.code.startsWith('TRANSPORT'))) {
        notes.push(
          'Belum bisa selesai dalam 1 hari: jadwal transportasi tidak cukup untuk tiba dan pulang tepat waktu.',
        );
      }
    }
  }

  const escortSkipped = [...new Set([...stats.values()].flatMap((st) => [...st.escortExcludedDates]))]
    .filter((d) => d < bestFirst)
    .sort();
  if (escortSkipped.length) {
    notes.push(
      `Pendamping belum tersedia pada ${escortSkipped.slice(0, 3).map(formatLocalDate).join(', ')}${escortSkipped.length > 3 ? ' dan hari lain' : ''}, jadi kunjungan dijadwalkan pada hari pendamping bisa ikut.`,
    );
  }
  for (const [code, st] of stats) {
    const capped = [...st.holdCapDates].filter((d) => d < bestFirst).sort();
    if (capped.length) {
      notes.push(
        `Kuota penahanan jadwal ${serviceName(ctx, code)} pada ${capped.map(formatLocalDate).join(', ')} sudah mencapai batas agar pasien lain tetap kebagian, jadi tanggal itu dilewati.`,
      );
    }
  }
  return [...new Set(notes)];
}

function buildRejections(ctx: Ctx, stats: Map<string, FilterStats>, failures: Failure[]): Rejection[] {
  const out: Rejection[] = [];
  for (const code of ctx.order) {
    const st = stats.get(code)!;
    if (st.kept > 0) continue;
    const name = serviceName(ctx, code);
    const inWindow = st.total - st.outsideWindow - st.tooSoon;
    if (inWindow <= 0) {
      out.push({
        code: 'NO_SLOTS_IN_WINDOW',
        serviceCode: code,
        message: `Tidak ada jadwal ${name} yang kosong dalam jendela waktu episode.`,
      });
    } else {
      // Report the filter that removed the most candidate slots.
      const dominant = (
        [
          ['FASTING_TOO_LATE', st.fasting],
          ['NO_ESCORT', st.escort],
          ['HOLD_CAP', st.holdCap],
        ] as const
      ).reduce((a, b) => (b[1] > a[1] ? b : a));
      const message = {
        FASTING_TOO_LATE: `Jadwal ${name} yang kosong terlalu siang untuk pasien yang harus puasa.`,
        NO_ESCORT: `Pendamping tidak tersedia pada jam-jam yang masih punya jadwal ${name}.`,
        HOLD_CAP: `Kuota penahanan jadwal ${name} sudah mencapai batas pada hari yang tersedia, agar pasien lain tetap kebagian.`,
      }[dominant[0]];
      out.push({ code: dominant[0], serviceCode: code, message });
    }
  }
  if (out.length) return out;

  const seen = new Set<RejectionCode>();
  for (const f of failures) {
    if (seen.has(f.code)) continue;
    seen.add(f.code);
    const rule = ctx.input.precedence.find((r) => r.after === f.service);
    const message =
      f.code === 'PRECEDENCE_UNSATISFIABLE' && rule
        ? `Tidak ada jadwal ${serviceName(ctx, rule.after)} setelah hasil ${serviceName(ctx, rule.before)} siap dalam jendela waktu.`
        : f.code === 'TRANSPORT_UNAVAILABLE'
          ? 'Tidak ada transportasi dari daerah asal pasien pada hari-hari yang masih punya jadwal.'
          : 'Jadwal transportasi tidak memungkinkan tiba dan pulang tepat waktu untuk jadwal yang tersedia.';
    out.push({ code: f.code, message, localDate: f.date, ...(f.service ? { serviceCode: f.service } : {}) });
  }
  if (out.length === 0)
    out.push({
      code: 'NO_SLOTS_IN_WINDOW',
      message: 'Tidak ada kombinasi jadwal yang memenuhi semua syarat.',
    });
  return out;
}
