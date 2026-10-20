CREATE SCHEMA "marketing";
--> statement-breakpoint
CREATE TYPE "public"."dependency_type" AS ENUM('PRECEDENCE', 'DOCUMENT_READY', 'ESCORT_AVAILABLE', 'TRANSPORT_FEASIBLE');--> statement-breakpoint
CREATE TYPE "public"."doc_kind" AS ENUM('surat_rujukan', 'hasil_lama', 'kartu_identitas');--> statement-breakpoint
CREATE TYPE "public"."doc_status" AS ENUM('missing', 'uploaded', 'verified', 'expired');--> statement-breakpoint
CREATE TYPE "public"."escort_status" AS ENUM('proposed', 'confirmed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."hold_status" AS ENUM('pending', 'active', 'released', 'expired', 'converted');--> statement-breakpoint
CREATE TYPE "public"."hold_tier" AS ENUM('singkat', 'standar', 'panjang');--> statement-breakpoint
CREATE TYPE "marketing"."lead_status" AS ENUM('baru', 'dihubungi', 'selesai', 'ditolak');--> statement-breakpoint
CREATE TYPE "public"."plan_status" AS ENUM('DRAFT', 'PROPOSED', 'HELD', 'CONFIRMED', 'COMPLETED', 'EXPIRED', 'RELEASED', 'CANCELLED', 'REPLAN_REQUIRED');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('rutin', 'segera');--> statement-breakpoint
CREATE TYPE "public"."slot_status" AS ENUM('available', 'held', 'booked', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('coordinator', 'unit_admin', 'system_admin');--> statement-breakpoint
CREATE TABLE "app_user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" "user_role" NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"at" timestamp with time zone NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text,
	"actor_label" text,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"from_state" text,
	"to_state" text,
	"reason" text,
	"correlation_id" text,
	"data" jsonb
);
--> statement-breakpoint
CREATE TABLE "capacity_day" (
	"service_type_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	CONSTRAINT "capacity_day_service_type_id_local_date_pk" PRIMARY KEY("service_type_id","local_date")
);
--> statement-breakpoint
CREATE TABLE "capacity_denial" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_type_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"reason" text NOT NULL,
	"episode_id" uuid,
	"held_slots_that_day" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dependency" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"episode_id" uuid NOT NULL,
	"type" "dependency_type" NOT NULL,
	"from_service_type_id" uuid,
	"to_service_type_id" uuid,
	"min_gap_min" integer,
	"params" jsonb
);
--> statement-breakpoint
CREATE TABLE "document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"episode_id" uuid NOT NULL,
	"kind" "doc_kind" NOT NULL,
	"label" text NOT NULL,
	"status" "doc_status" DEFAULT 'missing' NOT NULL,
	"valid_until" date,
	"file_name" text,
	"uploaded_at" timestamp with time zone,
	"verified_by" uuid,
	"verified_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "episode" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"title" text NOT NULL,
	"earliest_date" date NOT NULL,
	"latest_date" date NOT NULL,
	"desired_date" date,
	"priority" "priority" DEFAULT 'rutin' NOT NULL,
	"urgent" boolean DEFAULT false NOT NULL,
	"requires_escort" boolean DEFAULT false NOT NULL,
	"hold_tier" "hold_tier" DEFAULT 'standar' NOT NULL,
	"include_lost_income" boolean DEFAULT true NOT NULL,
	"scenario" text,
	"planning" jsonb,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "episode_service" (
	"episode_id" uuid NOT NULL,
	"service_type_id" uuid NOT NULL,
	CONSTRAINT "episode_service_episode_id_service_type_id_pk" PRIMARY KEY("episode_id","service_type_id")
);
--> statement-breakpoint
CREATE TABLE "escort" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"pseudonym" text NOT NULL,
	"relation" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "escort_availability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"escort_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"from_local" text NOT NULL,
	"to_local" text NOT NULL,
	"status" "escort_status" DEFAULT 'proposed' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facility" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"city" text NOT NULL,
	CONSTRAINT "facility_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "hold" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_plan_id" uuid NOT NULL,
	"status" "hold_status" DEFAULT 'pending' NOT NULL,
	"tier" "hold_tier" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"reason" text,
	"extensions_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	CONSTRAINT "hold_tripPlanId_unique" UNIQUE("trip_plan_id")
);
--> statement-breakpoint
CREATE TABLE "hold_extension" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hold_id" uuid NOT NULL,
	"by_user_id" uuid,
	"reason" text NOT NULL,
	"old_expires_at" timestamp with time zone NOT NULL,
	"new_expires_at" timestamp with time zone NOT NULL,
	"at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_key" (
	"scope" text NOT NULL,
	"key" text NOT NULL,
	"request_hash" text NOT NULL,
	"status_code" integer,
	"response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idempotency_key_scope_key_pk" PRIMARY KEY("scope","key")
);
--> statement-breakpoint
CREATE TABLE "marketing"."lead" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"organization" text NOT NULL,
	"role" text NOT NULL,
	"contact_channel" text NOT NULL,
	"contact_value" text NOT NULL,
	"need" text NOT NULL,
	"consent_at" timestamp with time zone NOT NULL,
	"consent_text_version" text NOT NULL,
	"status" "marketing"."lead_status" DEFAULT 'baru' NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel" text NOT NULL,
	"recipient_ref" text NOT NULL,
	"template" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"episode_id" uuid,
	"status" text DEFAULT 'simulated' NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patient" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pseudonym" text NOT NULL,
	"origin_regency" text NOT NULL,
	"distance_km" integer NOT NULL,
	"travel_minutes" integer NOT NULL,
	"mobility_needs" text[] DEFAULT '{}'::text[] NOT NULL,
	"national_id_hmac" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "patient_nationalIdHmac_unique" UNIQUE("national_id_hmac")
);
--> statement-breakpoint
CREATE TABLE "patient_access_token" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"episode_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patient_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"episode_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"message" text,
	"created_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "plan_visit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_plan_id" uuid NOT NULL,
	"slot_id" uuid NOT NULL,
	"service_type_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"local_date" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"bucket" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limit_bucket_window_start_pk" PRIMARY KEY("bucket","window_start")
);
--> statement-breakpoint
CREATE TABLE "seed_meta" (
	"id" integer PRIMARY KEY NOT NULL,
	"start_date" date NOT NULL,
	"seeded_at" timestamp with time zone NOT NULL,
	"rng_seed" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_type" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"short_name" text NOT NULL,
	"duration_min" integer NOT NULL,
	"fasting" boolean DEFAULT false NOT NULL,
	"latest_start_local" text,
	"result_ready_min" integer DEFAULT 0 NOT NULL,
	"prep_note" text,
	"hold_ttl_minutes" jsonb NOT NULL,
	"max_hold_ratio" double precision DEFAULT 0.3 NOT NULL,
	"max_extensions" integer DEFAULT 2 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "service_type_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid NOT NULL,
	"service_type_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"local_date" date NOT NULL,
	"status" "slot_status" DEFAULT 'available' NOT NULL,
	"hold_id" uuid,
	"booked_plan_id" uuid,
	"external_booking" boolean DEFAULT false NOT NULL,
	CONSTRAINT "slot_held_has_hold" CHECK (("slot"."status" = 'held') = ("slot"."hold_id" IS NOT NULL)),
	CONSTRAINT "slot_booked_has_owner" CHECK (("slot"."status" <> 'booked') OR ("slot"."booked_plan_id" IS NOT NULL OR "slot"."external_booking"))
);
--> statement-breakpoint
CREATE TABLE "transport_option" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"origin_regency" text NOT NULL,
	"mode" text NOT NULL,
	"label" text NOT NULL,
	"depart_local" text NOT NULL,
	"arrive_local" text NOT NULL,
	"return_depart_local" text NOT NULL,
	"return_arrive_local" text NOT NULL,
	"fare_idr" integer NOT NULL,
	"days_of_week" integer[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"episode_id" uuid NOT NULL,
	"status" "plan_status" DEFAULT 'DRAFT' NOT NULL,
	"rank" integer NOT NULL,
	"summary" text NOT NULL,
	"detail" jsonb NOT NULL,
	"visit_days" integer NOT NULL,
	"cost_idr" integer NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"status_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "unit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid NOT NULL,
	"service_type_id" uuid NOT NULL,
	"name" text NOT NULL,
	"location" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "capacity_day" ADD CONSTRAINT "capacity_day_service_type_id_service_type_id_fk" FOREIGN KEY ("service_type_id") REFERENCES "public"."service_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_denial" ADD CONSTRAINT "capacity_denial_service_type_id_service_type_id_fk" FOREIGN KEY ("service_type_id") REFERENCES "public"."service_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dependency" ADD CONSTRAINT "dependency_episode_id_episode_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episode"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dependency" ADD CONSTRAINT "dependency_from_service_type_id_service_type_id_fk" FOREIGN KEY ("from_service_type_id") REFERENCES "public"."service_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dependency" ADD CONSTRAINT "dependency_to_service_type_id_service_type_id_fk" FOREIGN KEY ("to_service_type_id") REFERENCES "public"."service_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_episode_id_episode_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episode"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episode" ADD CONSTRAINT "episode_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patient"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episode_service" ADD CONSTRAINT "episode_service_episode_id_episode_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episode"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episode_service" ADD CONSTRAINT "episode_service_service_type_id_service_type_id_fk" FOREIGN KEY ("service_type_id") REFERENCES "public"."service_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escort" ADD CONSTRAINT "escort_patient_id_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patient"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escort_availability" ADD CONSTRAINT "escort_availability_escort_id_escort_id_fk" FOREIGN KEY ("escort_id") REFERENCES "public"."escort"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hold" ADD CONSTRAINT "hold_trip_plan_id_trip_plan_id_fk" FOREIGN KEY ("trip_plan_id") REFERENCES "public"."trip_plan"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hold_extension" ADD CONSTRAINT "hold_extension_hold_id_hold_id_fk" FOREIGN KEY ("hold_id") REFERENCES "public"."hold"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_access_token" ADD CONSTRAINT "patient_access_token_episode_id_episode_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episode"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_request" ADD CONSTRAINT "patient_request_episode_id_episode_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episode"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_visit" ADD CONSTRAINT "plan_visit_trip_plan_id_trip_plan_id_fk" FOREIGN KEY ("trip_plan_id") REFERENCES "public"."trip_plan"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_visit" ADD CONSTRAINT "plan_visit_slot_id_slot_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."slot"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_visit" ADD CONSTRAINT "plan_visit_service_type_id_service_type_id_fk" FOREIGN KEY ("service_type_id") REFERENCES "public"."service_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slot" ADD CONSTRAINT "slot_unit_id_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."unit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slot" ADD CONSTRAINT "slot_service_type_id_service_type_id_fk" FOREIGN KEY ("service_type_id") REFERENCES "public"."service_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_plan" ADD CONSTRAINT "trip_plan_episode_id_episode_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episode"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit" ADD CONSTRAINT "unit_facility_id_facility_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facility"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit" ADD CONSTRAINT "unit_service_type_id_service_type_id_fk" FOREIGN KEY ("service_type_id") REFERENCES "public"."service_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_log" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "hold_active_expiry_idx" ON "hold" USING btree ("expires_at") WHERE "hold"."status" = 'active';--> statement-breakpoint
CREATE INDEX "plan_visit_plan_idx" ON "plan_visit" USING btree ("trip_plan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "slot_unit_start_uq" ON "slot" USING btree ("unit_id","starts_at");--> statement-breakpoint
CREATE INDEX "slot_service_day_idx" ON "slot" USING btree ("service_type_id","local_date","status");--> statement-breakpoint
CREATE INDEX "slot_hold_idx" ON "slot" USING btree ("hold_id");--> statement-breakpoint
CREATE INDEX "trip_plan_episode_idx" ON "trip_plan" USING btree ("episode_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trip_plan_one_active_per_episode" ON "trip_plan" USING btree ("episode_id") WHERE "trip_plan"."status" IN ('HELD', 'CONFIRMED');