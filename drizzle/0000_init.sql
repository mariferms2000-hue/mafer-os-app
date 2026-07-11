CREATE TABLE `agents_skills` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`source` text DEFAULT 'MACA',
	`purpose` text DEFAULT '',
	`input` text DEFAULT '',
	`output` text DEFAULT '',
	`when_to_use` text DEFAULT '',
	`when_not_to_use` text DEFAULT '',
	`command` text DEFAULT '',
	`relationships` text DEFAULT '[]',
	`source_path` text DEFAULT '',
	`status` text DEFAULT 'activo'
);
--> statement-breakpoint
CREATE TABLE `ai_tools` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`icon` text DEFAULT 'sparkles',
	`best_for` text DEFAULT '',
	`when_to_use` text DEFAULT '',
	`when_not_to_use` text DEFAULT '',
	`complexity` text DEFAULT 'baja',
	`needs_files` integer DEFAULT false,
	`involves_code` integer DEFAULT false,
	`expected_output` text DEFAULT '',
	`examples` text DEFAULT '[]',
	`position` integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE `boards` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`title` text DEFAULT 'Tablero' NOT NULL,
	`prefs` text DEFAULT '{}',
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `cards` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '',
	`project_id` text,
	`board_id` text,
	`column_id` text,
	`position` integer DEFAULT 0 NOT NULL,
	`type` text DEFAULT 'tarea' NOT NULL,
	`priority` text DEFAULT 'media',
	`duration` text,
	`energy` text,
	`due_date` text,
	`start_time` text,
	`reminder` text,
	`next_action` text DEFAULT '',
	`blocked_reason` text DEFAULT '',
	`waiting_for` text DEFAULT '',
	`tags` text DEFAULT '[]',
	`checklist` text DEFAULT '[]',
	`links` text DEFAULT '[]',
	`gcal_event_id` text,
	`is_starter` integer DEFAULT false,
	`archived` integer DEFAULT false,
	`completed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`column_id`) REFERENCES `columns`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `columns` (
	`id` text PRIMARY KEY NOT NULL,
	`board_id` text NOT NULL,
	`title` text NOT NULL,
	`kind` text DEFAULT 'custom' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`date` text NOT NULL,
	`project_id` text,
	`context` text DEFAULT '',
	`decision` text DEFAULT '',
	`reason` text DEFAULT '',
	`consequences` text DEFAULT '',
	`replaces` text DEFAULT '',
	`review_date` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`date` text NOT NULL,
	`start_time` text,
	`end_time` text,
	`type` text DEFAULT 'evento',
	`project_id` text,
	`notes` text DEFAULT '',
	`gcal_event_id` text,
	`is_starter` integer DEFAULT false,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `ideas` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '',
	`category` text DEFAULT 'general',
	`status` text DEFAULT 'incubando' NOT NULL,
	`graduated_to` text,
	`is_starter` integer DEFAULT false,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `inbox_items` (
	`id` text PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`note` text DEFAULT '',
	`type_hint` text,
	`project_id` text,
	`date` text,
	`processed` integer DEFAULT false,
	`converted_to` text,
	`is_starter` integer DEFAULT false,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `journal_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`body` text DEFAULT '',
	`date` text NOT NULL,
	`mood` text,
	`energy` text,
	`tags` text DEFAULT '[]',
	`project_id` text,
	`learning_id` text,
	`template_type` text DEFAULT 'libre',
	`favorite` integer DEFAULT false,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `learning_topics` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`motivation` text DEFAULT '',
	`outcome` text DEFAULT '',
	`depth` text DEFAULT 'exploracion',
	`status` text DEFAULT 'idea' NOT NULL,
	`key_questions` text DEFAULT '[]',
	`sprint` text DEFAULT '{}',
	`notes` text DEFAULT '',
	`exercises` text DEFAULT '[]',
	`evidence_class` text DEFAULT 'sin-clasificar',
	`result` text DEFAULT '',
	`progress` integer DEFAULT 0,
	`review_date` text,
	`is_starter` integer DEFAULT false,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '',
	`objective` text DEFAULT '',
	`area` text DEFAULT 'personal',
	`status` text DEFAULT 'activo' NOT NULL,
	`priority` text DEFAULT 'media',
	`health` text DEFAULT 'bien',
	`next_action` text DEFAULT '',
	`start_date` text,
	`target_date` text,
	`color` text DEFAULT 'sage',
	`icon` text DEFAULT 'folder',
	`links` text DEFAULT '[]',
	`notes` text DEFAULT '',
	`is_starter` integer DEFAULT false,
	`archived` integer DEFAULT false,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `prompts` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`tool` text DEFAULT 'claude-code',
	`project_id` text,
	`category` text DEFAULT 'general',
	`purpose` text DEFAULT '',
	`required_files` text DEFAULT '',
	`expected_output` text DEFAULT '',
	`version` text DEFAULT '1.0',
	`notes` text DEFAULT '',
	`favorite` integer DEFAULT false,
	`is_starter` integer DEFAULT false,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `recent_views` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`title` text NOT NULL,
	`href` text NOT NULL,
	`viewed_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `resources` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`type` text DEFAULT 'articulo',
	`url` text DEFAULT '',
	`topic` text DEFAULT '',
	`project_id` text,
	`learning_id` text,
	`notes` text DEFAULT '',
	`status` text DEFAULT 'pendiente',
	`favorite` integer DEFAULT false,
	`is_starter` integer DEFAULT false,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `today_priorities` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`card_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE cascade
);
