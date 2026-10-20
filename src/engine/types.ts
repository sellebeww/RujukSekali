// Pure planning types. Instants are UTC epoch ms; local dates are WIB "YYYY-MM-DD"; local times "HH:MM".

export interface ServiceSpec {
  code: string;
  name: string;
  durationMin: number;
  /** Patient must fast; the visit must start no later than `latestStartLocal`. */
  fasting: boolean;
  latestStartLocal: string | null;
  /** Minutes after the visit ends until its result is available (0 if none). */
  resultReadyMin: number;
  /** Plain-language preparation shown to patients (no clinical detail). */
  prepNote?: string;
}

export interface SlotSnapshot {
  id: string;
  serviceCode: string;
  startsAt: number;
  endsAt: number;
  localDate: string;
}

/** `after` may start only once `before` has ended, its result is ready, and `minGapMin` has passed. */
export interface PrecedenceRule {
  before: string;
  after: string;
  minGapMin: number;
}

export interface EscortWindow {
  localDate: string;
  fromLocal: string;
  toLocal: string;
}

export interface TransportOption {
  id: string;
  mode: string;
  label: string;
  departLocal: string;
  arriveLocal: string;
  returnDepartLocal: string;
  returnArriveLocal: string;
  /** One-way fare per traveller. */
  fareIdr: number;
  /** 0 = Sunday … 6 = Saturday. */
  daysOfWeek: number[];
}

export interface CostParams {
  lodgingPerNightIdr: number;
  lostIncomePerDayIdr: number;
  includeLostIncome: boolean;
  /** Longest stay (nights) the planner may propose between two visit days. */
  maxLodgingNights: number;
}

export interface PlanningInput {
  episodeId: string;
  earliestDate: string;
  latestDate: string;
  desiredDate?: string;
  requiresEscort: boolean;
  urgent: boolean;
  services: ServiceSpec[];
  precedence: PrecedenceRule[];
  slots: SlotSnapshot[];
  escortWindows: EscortWindow[];
  transport: TransportOption[];
  /** Service/day pairs where the hold-ratio guard is already at its limit. */
  holdCapReached: { serviceCode: string; localDate: string }[];
  cost: CostParams;
  nowMs: number;
  holdTtlMin: number;
  arrivalBufferMin?: number;
  departureBufferMin?: number;
  /** A slot must start at least this long after `nowMs`. */
  minLeadMin?: number;
  maxPlans?: number;
  maxNodes?: number;
  maxSpanDays?: number;
}

export interface PlannedVisit {
  slotId: string;
  serviceCode: string;
  serviceName: string;
  startsAt: number;
  endsAt: number;
  localDate: string;
  resultReadyAt: number;
  prepNote?: string;
}

export interface PlannedTrip {
  startDate: string;
  endDate: string;
  transportId: string;
  transportLabel: string;
  departLocal: string;
  arriveLocal: string;
  returnDepartLocal: string;
  returnArriveLocal: string;
  lodgingNights: number;
}

export interface CostBreakdown {
  transportIdr: number;
  lodgingIdr: number;
  lostIncomeIdr: number;
  totalIdr: number;
}

export type GapStrategy = 'menginap' | 'pulang';

export interface CandidatePlan {
  /** Stable identity: services@slot + gap strategy. */
  key: string;
  visits: PlannedVisit[];
  trips: PlannedTrip[];
  strategy: GapStrategy[];
  visitDays: number;
  cost: CostBreakdown;
  travellers: number;
  delayDays: number;
  heldSlotMinutes: number;
  /** Lexicographic score, lower is better. */
  score: (number | string)[];
  summary: string;
  explanation: string[];
}

export type RejectionCode =
  | 'URGENT_MANUAL'
  | 'NO_SLOTS_IN_WINDOW'
  | 'FASTING_TOO_LATE'
  | 'NO_ESCORT'
  | 'HOLD_CAP'
  | 'PRECEDENCE_UNSATISFIABLE'
  | 'TRANSPORT_UNAVAILABLE'
  | 'TRANSPORT_TIMING'
  | 'INVALID_INPUT'
  | 'NEAREST_OUTSIDE_WINDOW';

export interface Rejection {
  code: RejectionCode;
  message: string;
  serviceCode?: string;
  localDate?: string;
}

export interface PlanningResult {
  status: 'ok' | 'no_plan' | 'manual';
  plans: CandidatePlan[];
  rejections: Rejection[];
  /** Explanations that apply to the whole search (e.g. why the best day was skipped). */
  notes: string[];
  truncated: boolean;
  nodesExplored: number;
}
