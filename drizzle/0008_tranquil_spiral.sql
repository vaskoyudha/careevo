ALTER TABLE "integrity_violations" DROP CONSTRAINT "integrity_violations_expunged_shape_check";--> statement-breakpoint
ALTER TABLE "integrity_violations" DROP CONSTRAINT "integrity_violations_status_check";--> statement-breakpoint
ALTER TABLE "integrity_violations" ADD COLUMN "decided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "integrity_violations" ADD CONSTRAINT "integrity_violations_status_shape_check" CHECK ((
        ("status" = 'expunged' and "expunged_at" is not null)
        or ("status" <> 'expunged' and "expunged_at" is null)
      ) and (
        ("status" = 'proposed' and "reviewer_user_id" is null)
        or ("status" in ('active', 'dismissed') and "reviewer_user_id" is not null)
        or ("status" = 'expunged')
      ));--> statement-breakpoint
ALTER TABLE "integrity_violations" ADD CONSTRAINT "integrity_violations_status_check" CHECK ("status" in ('proposed', 'active', 'dismissed', 'expunged'));