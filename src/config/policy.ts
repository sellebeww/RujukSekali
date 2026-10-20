// Operational parameters. Values marked [PERLU DIVERIFIKASI] are assumptions to be confirmed by the hospital
// (see docs/COMPLIANCE-NOTES.md); none of them are hard-coded in the engine.
export const policy = {
  cost: {
    lodgingPerNightIdr: 250_000,
    lostIncomePerDayIdr: 150_000,
    maxLodgingNights: 2,
  },
  planner: {
    arrivalBufferMin: 30,
    departureBufferMin: 30,
    minLeadMin: 120,
    maxSpanDays: 14,
  },
  /** [PERLU DIVERIFIKASI] Validity of a referral letter, used when the coordinator verifies it. */
  referralValidityDays: 90,
  patientTokenTtlHours: 72,
  sessionTtlHours: 12,
  /** Holds stuck in `pending` (crash between saga steps) are compensated after this. */
  pendingHoldSweepMin: 5,
  /** A cancellation closer than this to the visit counts as "late" in metrics. */
  lateCancellationHours: 24,
  minReasonLength: 5,
  rateLimits: {
    lead: { limit: 5, windowSec: 3600 },
    patientToken: { limit: 30, windowSec: 600 },
    demoStart: { limit: 30, windowSec: 600 },
    demoWrite: { limit: 120, windowSec: 600 },
    login: { limit: 10, windowSec: 600 },
  },
  demo: {
    /** The shared demo sandbox is rebuilt when older than this. */
    maxAgeHours: 6,
  },
} as const;

/** Default ordering rules between services, applied when an episode includes both. [PERLU DIVERIFIKASI] */
export const defaultPrecedence = [{ before: 'LAB_DARAH', after: 'POLI_PD', minGapMin: 0 }] as const;
