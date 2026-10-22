CREATE TABLE IF NOT EXISTS "card_reminders" (
	"card_id" text PRIMARY KEY NOT NULL,
	"lead_minutes" integer DEFAULT 0 NOT NULL,
	"calendar_id" text,
	"gcal_event_id" text,
	"last_error" text,
	"last_synced_at" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
