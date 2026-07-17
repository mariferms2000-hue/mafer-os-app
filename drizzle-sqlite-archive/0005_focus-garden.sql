-- Fase 7B: Focus Garden — sesiones de enfoque y plantas (motor sin interfaz).
CREATE TABLE `focus_sessions` (
  `id` text PRIMARY KEY NOT NULL,
  `card_id` text,
  `preset` text NOT NULL,
  `planned_focus_min` integer NOT NULL,
  `planned_break_min` integer DEFAULT 0 NOT NULL,
  `phase` text NOT NULL,
  `phase_started_at` text NOT NULL,
  `elapsed_focus_seconds` integer DEFAULT 0 NOT NULL,
  `elapsed_break_seconds` integer DEFAULT 0 NOT NULL,
  `date` text NOT NULL,
  `started_at` text NOT NULL,
  `finished_at` text,
  `outcome` text,
  `credited_minutes` integer DEFAULT 0 NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `focus_plants` (
  `id` text PRIMARY KEY NOT NULL,
  `species` text DEFAULT 'brote-comun' NOT NULL,
  `accumulated_minutes` integer DEFAULT 0 NOT NULL,
  `started_at` text NOT NULL,
  `completed_at` text
);
