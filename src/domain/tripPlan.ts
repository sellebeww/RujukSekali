// Explicit TripPlan state machine. Every status change in the system goes through `transition`.

export const PLAN_STATUSES = [
  'DRAFT',
  'PROPOSED',
  'HELD',
  'CONFIRMED',
  'COMPLETED',
  'EXPIRED',
  'RELEASED',
  'CANCELLED',
  'REPLAN_REQUIRED',
] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export type PlanEvent =
  'propose' | 'hold' | 'confirm' | 'complete' | 'expire' | 'release' | 'cancel' | 'replan';

const TABLE: Record<PlanStatus, Partial<Record<PlanEvent, PlanStatus>>> = {
  DRAFT: { propose: 'PROPOSED', replan: 'REPLAN_REQUIRED', release: 'RELEASED' },
  PROPOSED: { hold: 'HELD', replan: 'REPLAN_REQUIRED', release: 'RELEASED' },
  HELD: { confirm: 'CONFIRMED', expire: 'EXPIRED', release: 'RELEASED', replan: 'REPLAN_REQUIRED' },
  CONFIRMED: { complete: 'COMPLETED', cancel: 'CANCELLED', replan: 'REPLAN_REQUIRED' },
  COMPLETED: {},
  EXPIRED: {},
  RELEASED: {},
  CANCELLED: {},
  REPLAN_REQUIRED: {},
};

export const TERMINAL: ReadonlySet<PlanStatus> = new Set(
  PLAN_STATUSES.filter((s) => Object.keys(TABLE[s]).length === 0),
);
export const ACTIVE: ReadonlySet<PlanStatus> = new Set(['DRAFT', 'PROPOSED', 'HELD', 'CONFIRMED']);

export class InvalidTransitionError extends Error {
  constructor(
    readonly from: PlanStatus,
    readonly event: PlanEvent,
  ) {
    super(`Transisi tidak valid: ${from} --${event}-->`);
  }
}

export function canTransition(from: PlanStatus, event: PlanEvent): boolean {
  return TABLE[from][event] !== undefined;
}

export function transition(from: PlanStatus, event: PlanEvent): PlanStatus {
  const to = TABLE[from][event];
  if (!to) throw new InvalidTransitionError(from, event);
  return to;
}

export function allTransitions(): { from: PlanStatus; event: PlanEvent; to: PlanStatus }[] {
  return PLAN_STATUSES.flatMap((from) =>
    Object.entries(TABLE[from]).map(([event, to]) => ({ from, event: event as PlanEvent, to: to! })),
  );
}

export const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  DRAFT: 'Draf',
  PROPOSED: 'Opsi disusun',
  HELD: 'Jadwal ditahan sementara',
  CONFIRMED: 'Terkonfirmasi',
  COMPLETED: 'Selesai',
  EXPIRED: 'Penahanan berakhir',
  RELEASED: 'Dilepas',
  CANCELLED: 'Dibatalkan',
  REPLAN_REQUIRED: 'Perlu disusun ulang',
};

// ---- Confirmation guard -------------------------------------------------------------------

export type DocumentStatus = 'missing' | 'uploaded' | 'verified' | 'expired';

export interface ConfirmationContext {
  status: PlanStatus;
  holdExpiresAt: number | null;
  now: number;
  urgent: boolean;
  documents: { kind: string; label: string; status: DocumentStatus; validUntil: string | null }[];
  /** Local date of the last visit; documents must stay valid through it. */
  lastVisitDate: string;
  requiresEscort: boolean;
  escortConfirmedForAllDays: boolean;
  transportFeasible: boolean;
  approvedByCoordinator: boolean;
  /** Adapter returned an uncertain/failed state for any slot: never confirm. */
  externalUncertain: boolean;
}

export interface Blocker {
  code:
    | 'NOT_HELD'
    | 'HOLD_EXPIRED'
    | 'URGENT'
    | 'DOCUMENT_NOT_VERIFIED'
    | 'DOCUMENT_EXPIRES'
    | 'ESCORT_NOT_CONFIRMED'
    | 'TRANSPORT_INFEASIBLE'
    | 'NOT_APPROVED'
    | 'EXTERNAL_UNCERTAIN';
  message: string;
}

/** Returns why a plan cannot be confirmed yet. Empty = safe to confirm. Fails safe: anything unknown blocks. */
export function confirmationBlockers(c: ConfirmationContext): Blocker[] {
  const b: Blocker[] = [];
  if (c.status !== 'HELD')
    b.push({ code: 'NOT_HELD', message: 'Rencana tidak sedang dalam status jadwal ditahan.' });
  if (c.holdExpiresAt !== null && c.holdExpiresAt <= c.now) {
    b.push({ code: 'HOLD_EXPIRED', message: 'Waktu penahanan jadwal sudah habis.' });
  }
  if (c.urgent) b.push({ code: 'URGENT', message: 'Episode ditandai mendesak dan harus ditangani manual.' });
  for (const d of c.documents) {
    if (d.status !== 'verified') {
      b.push({ code: 'DOCUMENT_NOT_VERIFIED', message: `${d.label} belum diverifikasi.` });
    } else if (d.validUntil !== null && d.validUntil < c.lastVisitDate) {
      b.push({
        code: 'DOCUMENT_EXPIRES',
        message: `${d.label} habis berlaku sebelum hari kunjungan terakhir.`,
      });
    }
  }
  if (c.requiresEscort && !c.escortConfirmedForAllDays) {
    b.push({ code: 'ESCORT_NOT_CONFIRMED', message: 'Pendamping belum mengonfirmasi semua hari kunjungan.' });
  }
  if (!c.transportFeasible)
    b.push({ code: 'TRANSPORT_INFEASIBLE', message: 'Jadwal transportasi tidak lagi memungkinkan.' });
  if (!c.approvedByCoordinator)
    b.push({ code: 'NOT_APPROVED', message: 'Menunggu persetujuan koordinator.' });
  if (c.externalUncertain) {
    b.push({ code: 'EXTERNAL_UNCERTAIN', message: 'Status jadwal di sistem rumah sakit belum pasti.' });
  }
  return b;
}
