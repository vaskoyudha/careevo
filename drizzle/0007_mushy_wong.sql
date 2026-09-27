CREATE TABLE "integrity_violations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"course_id" text NOT NULL,
	"enrollment_id" uuid,
	"kind" text NOT NULL,
	"penalty" integer NOT NULL,
	"reason" text NOT NULL,
	"reviewer_user_id" uuid,
	"evidence_redacted" jsonb,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expunged_at" timestamp with time zone,
	"expunged_reason" text,
	CONSTRAINT "integrity_violations_kind_check" CHECK ("kind" in ('meninggalkan_sesi', 'pola_salin_tempel', 'plagiarisme')),
	CONSTRAINT "integrity_violations_penalty_check" CHECK ("penalty" > 0),
	CONSTRAINT "integrity_violations_status_check" CHECK ("status" in ('active', 'expunged')),
	CONSTRAINT "integrity_violations_expunged_shape_check" CHECK (("status" = 'active' and "expunged_at" is null) or ("status" = 'expunged' and "expunged_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "integrity_violations" ADD CONSTRAINT "integrity_violations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrity_violations" ADD CONSTRAINT "integrity_violations_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrity_violations" ADD CONSTRAINT "integrity_violations_reviewer_user_id_users_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "integrity_violations_user_id_idx" ON "integrity_violations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "integrity_violations_course_idx" ON "integrity_violations" USING btree ("user_id","course_id");--> statement-breakpoint
CREATE INDEX "integrity_violations_status_idx" ON "integrity_violations" USING btree ("status");