CREATE TABLE "onboarding_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"experience" text NOT NULL,
	"background" text NOT NULL,
	"interests" text[] NOT NULL,
	"goal" text NOT NULL,
	"weekly_hours" integer NOT NULL,
	"work_preference" text NOT NULL,
	"completed_at" timestamp with time zone NOT NULL,
	"version" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "onboarding_profiles_experience_check" CHECK ("experience" in ('pemula', 'dasar', 'menengah', 'lanjut')),
	CONSTRAINT "onboarding_profiles_background_check" CHECK ("background" in ('pelajar', 'mahasiswa', 'career-switcher', 'fresh-graduate', 'profesional')),
	CONSTRAINT "onboarding_profiles_goal_check" CHECK ("goal" in ('dapat-kerja', 'naik-level', 'ganti-bidang', 'portfolio', 'sertifikasi')),
	CONSTRAINT "onboarding_profiles_work_preference_check" CHECK ("work_preference" in ('remote', 'hybrid', 'onsite', 'fleksibel')),
	CONSTRAINT "onboarding_profiles_weekly_hours_check" CHECK ("weekly_hours" in (3, 5, 8, 12, 20)),
	CONSTRAINT "onboarding_profiles_interests_check" CHECK (cardinality("interests") between 1 and 3 and "interests" <@ array['web-dev', 'data', 'ai', 'game-dev', 'cyber-sec', 'mobile']::text[])
);
--> statement-breakpoint
ALTER TABLE "onboarding_profiles" ADD CONSTRAINT "onboarding_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;