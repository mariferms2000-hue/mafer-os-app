-- Fase 5A: sesiones de revisión diaria y semanal (progreso guardado + historial simple).
CREATE TABLE `reviews` (
  `id` text PRIMARY KEY NOT NULL,
  `type` text NOT NULL,
  `date` text NOT NULL,
  `started_at` text NOT NULL,
  `finished_at` text,
  `completed` integer DEFAULT false,
  `step` integer DEFAULT 1 NOT NULL,
  `processed` integer DEFAULT 0 NOT NULL,
  `summary` text DEFAULT '',
  `meta` text DEFAULT '{}'
);
