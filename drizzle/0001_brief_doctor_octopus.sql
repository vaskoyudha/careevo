CREATE TABLE "outbox_deliveries" (
	"event_id" uuid NOT NULL,
	"sink" text NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone,
	"result_code" text,
	CONSTRAINT "outbox_deliveries_event_id_sink_pk" PRIMARY KEY("event_id","sink"),
	CONSTRAINT "outbox_deliveries_status_check" CHECK ("status" in ('in_progress', 'succeeded', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"aggregate_type" text NOT NULL,
	"aggregate_id" text NOT NULL,
	"payload_redacted" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"lease_owner" text,
	"lease_expires_at" timestamp with time zone,
	"processed_at" timestamp with time zone,
	"last_error_code" text,
	"dead_lettered_at" timestamp with time zone,
	"idempotency_key" text NOT NULL,
	CONSTRAINT "outbox_events_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
ALTER TABLE "outbox_deliveries" ADD CONSTRAINT "outbox_deliveries_event_id_outbox_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."outbox_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "outbox_deliveries_sink_idx" ON "outbox_deliveries" USING btree ("sink");--> statement-breakpoint
CREATE INDEX "outbox_events_claim_idx" ON "outbox_events" USING btree ("available_at") WHERE "processed_at" is null and "dead_lettered_at" is null;--> statement-breakpoint
CREATE INDEX "outbox_events_aggregate_idx" ON "outbox_events" USING btree ("aggregate_type","aggregate_id");