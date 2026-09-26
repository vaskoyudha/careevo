CREATE TABLE "course_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"course_id" text NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completion_path" text NOT NULL,
	"policy_version" integer NOT NULL,
	CONSTRAINT "course_completions_enrollment_id_unique" UNIQUE("enrollment_id"),
	CONSTRAINT "course_completions_completion_path_check" CHECK ("completion_path" in ('terverifikasi', 'informal'))
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"course_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"completion_path" text,
	CONSTRAINT "enrollments_user_course_unique" UNIQUE("user_id","course_id"),
	CONSTRAINT "enrollments_status_check" CHECK ("status" in ('active', 'completed', 'dropped')),
	CONSTRAINT "enrollments_completion_path_check" CHECK ("completion_path" in ('terverifikasi', 'informal'))
);
--> statement-breakpoint
CREATE TABLE "learning_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learning_run_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"sequence" integer NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payload_redacted" jsonb,
	CONSTRAINT "learning_events_run_sequence_unique" UNIQUE("learning_run_id","sequence")
);
--> statement-breakpoint
CREATE TABLE "learning_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"course_id" text NOT NULL,
	"module_id" text,
	"state" text DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"integrity_version" integer DEFAULT 1 NOT NULL,
	"metadata_redacted" jsonb,
	CONSTRAINT "learning_runs_state_check" CHECK ("state" in ('active', 'completed', 'expired'))
);
--> statement-breakpoint
CREATE TABLE "module_progress" (
	"enrollment_id" uuid NOT NULL,
	"module_id" text NOT NULL,
	"state" text DEFAULT 'in_progress' NOT NULL,
	"completed_at" timestamp with time zone,
	"completion_path" text,
	"evidence_id" uuid,
	CONSTRAINT "module_progress_enrollment_id_module_id_pk" PRIMARY KEY("enrollment_id","module_id"),
	CONSTRAINT "module_progress_state_check" CHECK ("state" in ('in_progress', 'completed')),
	CONSTRAINT "module_progress_completion_path_check" CHECK ("completion_path" in ('terverifikasi', 'informal'))
);
--> statement-breakpoint
CREATE TABLE "quiz_attempt_answers" (
	"quiz_attempt_id" uuid NOT NULL,
	"question_id" text NOT NULL,
	"selected_option" integer NOT NULL,
	"is_correct" boolean,
	"question_snapshot_ref" text,
	CONSTRAINT "quiz_attempt_answers_quiz_attempt_id_question_id_pk" PRIMARY KEY("quiz_attempt_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "quiz_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"quiz_id" text,
	"assessment_definition_version" text NOT NULL,
	"assessment_snapshot" jsonb NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"score" integer,
	"grading_version" integer DEFAULT 1 NOT NULL,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "quiz_attempts_enrollment_quiz_attempt_unique" UNIQUE("enrollment_id","quiz_id","attempt_number"),
	CONSTRAINT "quiz_attempts_status_check" CHECK ("status" in ('in_progress', 'submitted'))
);
--> statement-breakpoint
ALTER TABLE "course_completions" ADD CONSTRAINT "course_completions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_completions" ADD CONSTRAINT "course_completions_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_events" ADD CONSTRAINT "learning_events_learning_run_id_learning_runs_id_fk" FOREIGN KEY ("learning_run_id") REFERENCES "public"."learning_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_runs" ADD CONSTRAINT "learning_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_runs" ADD CONSTRAINT "learning_runs_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_progress" ADD CONSTRAINT "module_progress_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempt_answers" ADD CONSTRAINT "quiz_attempt_answers_quiz_attempt_id_quiz_attempts_id_fk" FOREIGN KEY ("quiz_attempt_id") REFERENCES "public"."quiz_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "course_completions_user_id_idx" ON "course_completions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "enrollments_course_id_idx" ON "enrollments" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "learning_events_run_id_idx" ON "learning_events" USING btree ("learning_run_id");--> statement-breakpoint
CREATE INDEX "learning_runs_user_id_idx" ON "learning_runs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "learning_runs_course_id_idx" ON "learning_runs" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "learning_runs_state_idx" ON "learning_runs" USING btree ("state");--> statement-breakpoint
CREATE INDEX "learning_runs_expires_at_idx" ON "learning_runs" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "quiz_attempts_user_id_idx" ON "quiz_attempts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "quiz_attempts_enrollment_id_idx" ON "quiz_attempts" USING btree ("enrollment_id");