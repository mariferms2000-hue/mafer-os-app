CREATE TABLE "trips" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"destination" text,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"notes" text DEFAULT '',
	"created_at" text NOT NULL
);
