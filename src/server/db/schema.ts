import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgSchema,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { CandidatePlan } from '@/engine/types';

const ts = (name?: string) =>
  name
    ? timestamp(name, { withTimezone: true, mode: 'date' })
    : timestamp({ withTimezone: true, mode: 'date' });
const localDate = () => date({ mode: 'string' });
const id = () => uuid().primaryKey().defaultRandom();

export const slotStatus = pgEnum('slot_status', ['available', 'held', 'booked', 'blocked']);
export const planStatus = pgEnum('plan_status', [
  'DRAFT',
  'PROPOSED',
  'HELD',
  'CONFIRMED',
  'COMPLETED',
  'EXPIRED',
  'RELEASED',
  'CANCELLED',
  'REPLAN_REQUIRED',
]);
export const holdStatus = pgEnum('hold_status', ['pending', 'active', 'released', 'expired', 'converted']);
export const holdTier = pgEnum('hold_tier', ['singkat', 'standar', 'panjang']);
export const docStatus = pgEnum('doc_status', ['missing', 'uploaded', 'verified', 'expired']);
export const docKind = pgEnum('doc_kind', ['surat_rujukan', 'hasil_lama', 'kartu_identitas']);
export const userRole = pgEnum('user_role', ['coordinator', 'unit_admin', 'system_admin']);
export const priority = pgEnum('priority', ['rutin', 'segera']);
export const escortStatus = pgEnum('escort_status', ['proposed', 'confirmed', 'cancelled']);
export const dependencyType = pgEnum('dependency_type', [
  'PRECEDENCE',
  'DOCUMENT_READY',
  'ESCORT_AVAILABLE',
  'TRANSPORT_FEASIBLE',
]);

export interface HoldTtlMinutes {
  singkat: number;
  standar: number;
  panjang: number;
}

// ---- Reference & capacity ------------------------------------------------------------------

export const facility = pgTable('facility', {
  id: id(),
  code: text().notNull().unique(),
  name: text().notNull(),
  city: text().notNull(),
});

export const serviceType = pgTable('service_type', {
  id: id(),
  code: text().notNull().unique(),
  name: text().notNull(),
  shortName: text().notNull(),
  durationMin: integer().notNull(),
  fasting: boolean().notNull().default(false),
  latestStartLocal: text(),
  resultReadyMin: integer().notNull().default(0),
  prepNote: text(),
  holdTtlMinutes: jsonb().$type<HoldTtlMinutes>().notNull(),
  maxHoldRatio: doublePrecision().notNull().default(0.3),
  maxExtensions: integer().notNull().default(2),
  sortOrder: integer().notNull().default(0),
});

export const unit = pgTable('unit', {
  id: id(),
  facilityId: uuid()
    .notNull()
    .references(() => facility.id),
  serviceTypeId: uuid()
    .notNull()
    .references(() => serviceType.id),
  name: text().notNull(),
  /** Neutral place label used in notifications, e.g. "Gedung A, Lantai 1, Loket 3" (no specialty). */
  location: text().notNull(),
});

export const slot = pgTable(
  'slot',
  {
    id: id(),
    unitId: uuid()
      .notNull()
      .references(() => unit.id),
    serviceTypeId: uuid()
      .notNull()
      .references(() => serviceType.id),
    startsAt: ts().notNull(),
    endsAt: ts().notNull(),
    localDate: localDate().notNull(),
    status: slotStatus().notNull().default('available'),
    holdId: uuid(),
    bookedPlanId: uuid(),
    /** Booked by the hospital's own system (other patients); synthetic background load. */
    externalBooking: boolean().notNull().default(false),
  },
  (t) => [
    uniqueIndex('slot_unit_start_uq').on(t.unitId, t.startsAt),
    index('slot_service_day_idx').on(t.serviceTypeId, t.localDate, t.status),
    index('slot_hold_idx').on(t.holdId),
    check('slot_held_has_hold', sql`(${t.status} = 'held') = (${t.holdId} IS NOT NULL)`),
    check(
      'slot_booked_has_owner',
      sql`(${t.status} <> 'booked') OR (${t.bookedPlanId} IS NOT NULL OR ${t.externalBooking})`,
    ),
  ],
);

/** One row per service per day, locked FOR UPDATE to serialise the hold-ratio guard. */
export const capacityDay = pgTable(
  'capacity_day',
  {
    serviceTypeId: uuid()
      .notNull()
      .references(() => serviceType.id),
    localDate: localDate().notNull(),
  },
  (t) => [primaryKey({ columns: [t.serviceTypeId, t.localDate] })],
);

export const capacityDenial = pgTable('capacity_denial', {
  id: id(),
  serviceTypeId: uuid()
    .notNull()
    .references(() => serviceType.id),
  localDate: localDate().notNull(),
  at: ts().notNull(),
  reason: text().notNull(),
  episodeId: uuid(),
  heldSlotsThatDay: integer().notNull().default(0),
});

// ---- Patients & episodes -------------------------------------------------------------------

export const patient = pgTable('patient', {
  id: id(),
  pseudonym: text().notNull(),
  originRegency: text().notNull(),
  distanceKm: integer().notNull(),
  travelMinutes: integer().notNull(),
  mobilityNeeds: text()
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  /** HMAC-SHA256(NIK, pepper). The NIK itself is never stored. */
  nationalIdHmac: text().unique(),
  createdAt: ts().notNull().defaultNow(),
});

export const escort = pgTable('escort', {
  id: id(),
  patientId: uuid()
    .notNull()
    .references(() => patient.id),
  pseudonym: text().notNull(),
  relation: text().notNull(),
});

export const escortAvailability = pgTable('escort_availability', {
  id: id(),
  escortId: uuid()
    .notNull()
    .references(() => escort.id),
  localDate: localDate().notNull(),
  fromLocal: text().notNull(),
  toLocal: text().notNull(),
  status: escortStatus().notNull().default('proposed'),
});

export const episode = pgTable('episode', {
  id: id(),
  patientId: uuid()
    .notNull()
    .references(() => patient.id),
  title: text().notNull(),
  earliestDate: localDate().notNull(),
  latestDate: localDate().notNull(),
  desiredDate: localDate(),
  priority: priority().notNull().default('rutin'),
  urgent: boolean().notNull().default(false),
  requiresEscort: boolean().notNull().default(false),
  holdTier: holdTier().notNull().default('standar'),
  includeLostIncome: boolean().notNull().default(true),
  /** Demo/seed scenario this episode was built from, for labelling only. */
  scenario: text(),
  /** Last planner output shown to the coordinator: notes and rejection reasons. */
  planning: jsonb().$type<{
    at: string;
    status: string;
    notes: string[];
    rejections: { code: string; message: string }[];
  }>(),
  createdBy: uuid(),
  createdAt: ts().notNull().defaultNow(),
  closedAt: ts(),
});

export const episodeService = pgTable(
  'episode_service',
  {
    episodeId: uuid()
      .notNull()
      .references(() => episode.id),
    serviceTypeId: uuid()
      .notNull()
      .references(() => serviceType.id),
  },
  (t) => [primaryKey({ columns: [t.episodeId, t.serviceTypeId] })],
);

export const dependency = pgTable('dependency', {
  id: id(),
  episodeId: uuid()
    .notNull()
    .references(() => episode.id),
  type: dependencyType().notNull(),
  fromServiceTypeId: uuid().references(() => serviceType.id),
  toServiceTypeId: uuid().references(() => serviceType.id),
  minGapMin: integer(),
  params: jsonb().$type<Record<string, unknown>>(),
});

export const document = pgTable('document', {
  id: id(),
  episodeId: uuid()
    .notNull()
    .references(() => episode.id),
  kind: docKind().notNull(),
  label: text().notNull(),
  status: docStatus().notNull().default('missing'),
  validUntil: localDate(),
  /** Synthetic file name only; mock uploads store no content. */
  fileName: text(),
  uploadedAt: ts(),
  verifiedBy: uuid(),
  verifiedAt: ts(),
});

export const transportOption = pgTable('transport_option', {
  id: id(),
  originRegency: text().notNull(),
  mode: text().notNull(),
  label: text().notNull(),
  departLocal: text().notNull(),
  arriveLocal: text().notNull(),
  returnDepartLocal: text().notNull(),
  returnArriveLocal: text().notNull(),
  fareIdr: integer().notNull(),
  daysOfWeek: integer().array().notNull(),
});

// ---- Plans & holds -------------------------------------------------------------------------

export const tripPlan = pgTable(
  'trip_plan',
  {
    id: id(),
    episodeId: uuid()
      .notNull()
      .references(() => episode.id),
    status: planStatus().notNull().default('DRAFT'),
    rank: integer().notNull(),
    summary: text().notNull(),
    detail: jsonb().$type<CandidatePlan>().notNull(),
    visitDays: integer().notNull(),
    costIdr: integer().notNull(),
    approvedBy: uuid(),
    approvedAt: ts(),
    statusReason: text(),
    createdAt: ts().notNull().defaultNow(),
    updatedAt: ts().notNull().defaultNow(),
    endedAt: ts(),
  },
  (t) => [
    index('trip_plan_episode_idx').on(t.episodeId),
    uniqueIndex('trip_plan_one_active_per_episode')
      .on(t.episodeId)
      .where(sql`${t.status} IN ('HELD', 'CONFIRMED')`),
  ],
);

export const planVisit = pgTable(
  'plan_visit',
  {
    id: id(),
    tripPlanId: uuid()
      .notNull()
      .references(() => tripPlan.id),
    slotId: uuid()
      .notNull()
      .references(() => slot.id),
    serviceTypeId: uuid()
      .notNull()
      .references(() => serviceType.id),
    startsAt: ts().notNull(),
    endsAt: ts().notNull(),
    localDate: localDate().notNull(),
  },
  (t) => [index('plan_visit_plan_idx').on(t.tripPlanId)],
);

export const hold = pgTable(
  'hold',
  {
    id: id(),
    tripPlanId: uuid()
      .notNull()
      .unique()
      .references(() => tripPlan.id),
    status: holdStatus().notNull().default('pending'),
    tier: holdTier().notNull(),
    expiresAt: ts().notNull(),
    reason: text(),
    extensionsCount: integer().notNull().default(0),
    createdAt: ts().notNull(),
    endedAt: ts(),
  },
  (t) => [
    index('hold_active_expiry_idx')
      .on(t.expiresAt)
      .where(sql`${t.status} = 'active'`),
  ],
);

export const holdExtension = pgTable('hold_extension', {
  id: id(),
  holdId: uuid()
    .notNull()
    .references(() => hold.id),
  byUserId: uuid(),
  reason: text().notNull(),
  oldExpiresAt: ts().notNull(),
  newExpiresAt: ts().notNull(),
  at: ts().notNull(),
});

// ---- Cross-cutting -------------------------------------------------------------------------

export const auditLog = pgTable(
  'audit_log',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    at: ts().notNull(),
    actorType: text().notNull(),
    actorId: text(),
    actorLabel: text(),
    entity: text().notNull(),
    entityId: text().notNull(),
    action: text().notNull(),
    fromState: text(),
    toState: text(),
    reason: text(),
    correlationId: text(),
    data: jsonb().$type<Record<string, unknown>>(),
  },
  (t) => [index('audit_entity_idx').on(t.entity, t.entityId)],
);

export const idempotencyKey = pgTable(
  'idempotency_key',
  {
    scope: text().notNull(),
    key: text().notNull(),
    requestHash: text().notNull(),
    statusCode: integer(),
    response: jsonb(),
    createdAt: ts().notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.scope, t.key] })],
);

export const outbox = pgTable('outbox', {
  id: id(),
  channel: text().notNull(),
  recipientRef: text().notNull(),
  template: text().notNull(),
  subject: text().notNull(),
  body: text().notNull(),
  episodeId: uuid(),
  status: text().notNull().default('simulated'),
  createdAt: ts().notNull(),
});

export const appUser = pgTable('app_user', {
  id: id(),
  email: text().notNull().unique(),
  name: text().notNull(),
  role: userRole().notNull(),
  passwordHash: text().notNull(),
  createdAt: ts().notNull().defaultNow(),
});

export const session = pgTable('session', {
  idHash: text().primaryKey(),
  userId: uuid()
    .notNull()
    .references(() => appUser.id),
  expiresAt: ts().notNull(),
  createdAt: ts().notNull().defaultNow(),
});

export const patientAccessToken = pgTable('patient_access_token', {
  tokenHash: text().primaryKey(),
  episodeId: uuid()
    .notNull()
    .references(() => episode.id),
  expiresAt: ts().notNull(),
  revokedAt: ts(),
  createdAt: ts().notNull().defaultNow(),
});

export const patientRequest = pgTable('patient_request', {
  id: id(),
  episodeId: uuid()
    .notNull()
    .references(() => episode.id),
  kind: text().notNull(),
  message: text(),
  createdAt: ts().notNull(),
  resolvedAt: ts(),
});

export const rateLimit = pgTable(
  'rate_limit',
  {
    bucket: text().notNull(),
    windowStart: ts().notNull(),
    count: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.bucket, t.windowStart] })],
);

export const seedMeta = pgTable('seed_meta', {
  id: integer().primaryKey(),
  startDate: localDate().notNull(),
  seededAt: ts().notNull(),
  rngSeed: integer().notNull(),
});

// ---- Marketing (separate schema: never joined with patient data) ---------------------------

export const marketing = pgSchema('marketing');
export const leadStatus = marketing.enum('lead_status', ['baru', 'dihubungi', 'selesai', 'ditolak']);

export const lead = marketing.table('lead', {
  id: id(),
  name: text().notNull(),
  organization: text().notNull(),
  role: text().notNull(),
  contactChannel: text().notNull(),
  contactValue: text().notNull(),
  need: text().notNull(),
  consentAt: ts().notNull(),
  consentTextVersion: text().notNull(),
  status: leadStatus().notNull().default('baru'),
  createdAt: ts().notNull(),
});
