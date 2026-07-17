CREATE TABLE "agents_skills" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"source" text DEFAULT 'MACA',
	"purpose" text DEFAULT '',
	"input" text DEFAULT '',
	"output" text DEFAULT '',
	"when_to_use" text DEFAULT '',
	"when_not_to_use" text DEFAULT '',
	"command" text DEFAULT '',
	"relationships" jsonb DEFAULT '[]'::jsonb,
	"source_path" text DEFAULT '',
	"status" text DEFAULT 'activo',
	"scope" text DEFAULT 'maca',
	"file_modified" text
);
--> statement-breakpoint
CREATE TABLE "ai_tools" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"icon" text DEFAULT 'sparkles',
	"best_for" text DEFAULT '',
	"when_to_use" text DEFAULT '',
	"when_not_to_use" text DEFAULT '',
	"complexity" text DEFAULT 'baja',
	"needs_files" boolean DEFAULT false,
	"involves_code" boolean DEFAULT false,
	"expected_output" text DEFAULT '',
	"examples" jsonb DEFAULT '[]'::jsonb,
	"position" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "boards" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"title" text DEFAULT 'Tablero' NOT NULL,
	"prefs" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "cards" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '',
	"project_id" text,
	"board_id" text,
	"column_id" text,
	"position" integer DEFAULT 0 NOT NULL,
	"type" text DEFAULT 'tarea' NOT NULL,
	"priority" text DEFAULT 'media',
	"duration" text,
	"energy" text,
	"due_date" text,
	"start_time" text,
	"reminder" text,
	"next_action" text DEFAULT '',
	"blocked_reason" text DEFAULT '',
	"waiting_for" text DEFAULT '',
	"tags" jsonb DEFAULT '[]'::jsonb,
	"checklist" jsonb DEFAULT '[]'::jsonb,
	"links" jsonb DEFAULT '[]'::jsonb,
	"gcal_event_id" text,
	"is_starter" boolean DEFAULT false,
	"archived" boolean DEFAULT false,
	"completed_at" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "columns" (
	"id" text PRIMARY KEY NOT NULL,
	"board_id" text NOT NULL,
	"title" text NOT NULL,
	"kind" text DEFAULT 'custom' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"date" text NOT NULL,
	"project_id" text,
	"context" text DEFAULT '',
	"decision" text DEFAULT '',
	"reason" text DEFAULT '',
	"consequences" text DEFAULT '',
	"replaces" text DEFAULT '',
	"review_date" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"date" text NOT NULL,
	"start_time" text,
	"end_time" text,
	"type" text DEFAULT 'evento',
	"project_id" text,
	"notes" text DEFAULT '',
	"gcal_event_id" text,
	"is_starter" boolean DEFAULT false,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "focus_plants" (
	"id" text PRIMARY KEY NOT NULL,
	"species" text DEFAULT 'brote-comun' NOT NULL,
	"accumulated_minutes" integer DEFAULT 0 NOT NULL,
	"visual_seed" integer DEFAULT 0 NOT NULL,
	"renderer_version" integer DEFAULT 1 NOT NULL,
	"name" text,
	"note" text,
	"started_at" text NOT NULL,
	"completed_at" text
);
--> statement-breakpoint
CREATE TABLE "focus_session_plant_allocations" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"plant_id" text NOT NULL,
	"credited_minutes" integer NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "focus_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"card_id" text,
	"preset" text NOT NULL,
	"planned_focus_min" integer NOT NULL,
	"planned_break_min" integer DEFAULT 0 NOT NULL,
	"phase" text NOT NULL,
	"phase_started_at" text NOT NULL,
	"elapsed_focus_seconds" integer DEFAULT 0 NOT NULL,
	"elapsed_break_seconds" integer DEFAULT 0 NOT NULL,
	"date" text NOT NULL,
	"started_at" text NOT NULL,
	"finished_at" text,
	"outcome" text,
	"credited_minutes" integer DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ideas" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '',
	"category" text DEFAULT 'general',
	"status" text DEFAULT 'incubando' NOT NULL,
	"graduated_to" text,
	"is_starter" boolean DEFAULT false,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inbox_items" (
	"id" text PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"note" text DEFAULT '',
	"type_hint" text,
	"project_id" text,
	"date" text,
	"processed" boolean DEFAULT false,
	"converted_to" text,
	"is_starter" boolean DEFAULT false,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '',
	"date" text NOT NULL,
	"mood" text,
	"energy" text,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"project_id" text,
	"learning_id" text,
	"template_type" text DEFAULT 'libre',
	"favorite" boolean DEFAULT false,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_topics" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"motivation" text DEFAULT '',
	"outcome" text DEFAULT '',
	"depth" text DEFAULT 'exploracion',
	"status" text DEFAULT 'idea' NOT NULL,
	"key_questions" jsonb DEFAULT '[]'::jsonb,
	"sprint" jsonb DEFAULT '{}'::jsonb,
	"notes" text DEFAULT '',
	"exercises" jsonb DEFAULT '[]'::jsonb,
	"evidence_class" text DEFAULT 'sin-clasificar',
	"result" text DEFAULT '',
	"progress" integer DEFAULT 0,
	"review_date" text,
	"is_starter" boolean DEFAULT false,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '',
	"objective" text DEFAULT '',
	"area" text DEFAULT 'personal',
	"status" text DEFAULT 'activo' NOT NULL,
	"priority" text DEFAULT 'media',
	"health" text DEFAULT 'bien',
	"next_action" text DEFAULT '',
	"next_action_card_id" text,
	"resume_note" text DEFAULT '',
	"start_date" text,
	"target_date" text,
	"color" text DEFAULT 'sage',
	"icon" text DEFAULT 'folder',
	"links" jsonb DEFAULT '[]'::jsonb,
	"notes" text DEFAULT '',
	"is_starter" boolean DEFAULT false,
	"archived" boolean DEFAULT false,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompts" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"tool" text DEFAULT 'claude-code',
	"project_id" text,
	"category" text DEFAULT 'general',
	"purpose" text DEFAULT '',
	"required_files" text DEFAULT '',
	"expected_output" text DEFAULT '',
	"version" text DEFAULT '1.0',
	"notes" text DEFAULT '',
	"favorite" boolean DEFAULT false,
	"is_starter" boolean DEFAULT false,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recent_views" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"title" text NOT NULL,
	"href" text NOT NULL,
	"viewed_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"type" text DEFAULT 'articulo',
	"url" text DEFAULT '',
	"topic" text DEFAULT '',
	"project_id" text,
	"learning_id" text,
	"notes" text DEFAULT '',
	"status" text DEFAULT 'pendiente',
	"favorite" boolean DEFAULT false,
	"is_starter" boolean DEFAULT false,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"date" text NOT NULL,
	"started_at" text NOT NULL,
	"finished_at" text,
	"completed" boolean DEFAULT false,
	"step" integer DEFAULT 1 NOT NULL,
	"processed" integer DEFAULT 0 NOT NULL,
	"summary" text DEFAULT '',
	"meta" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "today_priorities" (
	"id" text PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"card_id" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "boards" ADD CONSTRAINT "boards_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_column_id_columns_id_fk" FOREIGN KEY ("column_id") REFERENCES "public"."columns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "columns" ADD CONSTRAINT "columns_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_items" ADD CONSTRAINT "inbox_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "today_priorities" ADD CONSTRAINT "today_priorities_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_fspa_session" ON "focus_session_plant_allocations" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_fspa_plant" ON "focus_session_plant_allocations" USING btree ("plant_id");