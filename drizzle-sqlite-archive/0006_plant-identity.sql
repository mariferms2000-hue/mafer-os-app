-- Fase 7E.2: identidad de plantas (especie, visual_seed, renderer_version) y
-- asignaciones sesión→planta. Ver docs/qa/phase-7e2-plant-identity/decision-asignaciones.md.
ALTER TABLE `focus_plants` ADD `visual_seed` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `focus_plants` ADD `renderer_version` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `focus_plants` ADD `name` text;
--> statement-breakpoint
ALTER TABLE `focus_plants` ADD `note` text;
--> statement-breakpoint
CREATE TABLE `focus_session_plant_allocations` (
  `id` text PRIMARY KEY NOT NULL,
  `session_id` text NOT NULL,
  `plant_id` text NOT NULL,
  `credited_minutes` integer NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_fspa_session` ON `focus_session_plant_allocations` (`session_id`);
--> statement-breakpoint
CREATE INDEX `idx_fspa_plant` ON `focus_session_plant_allocations` (`plant_id`);
--> statement-breakpoint
-- Backfill: visual_seed estable derivado de los primeros 7 caracteres hex del UUID
-- (28 bits, siempre < 2^31). Se calcula UNA vez y de aquí en adelante solo se lee.
UPDATE `focus_plants` SET `visual_seed` =
  (instr('0123456789abcdef', substr(lower(`id`), 1, 1)) - 1) * 16777216 +
  (instr('0123456789abcdef', substr(lower(`id`), 2, 1)) - 1) * 1048576 +
  (instr('0123456789abcdef', substr(lower(`id`), 3, 1)) - 1) * 65536 +
  (instr('0123456789abcdef', substr(lower(`id`), 4, 1)) - 1) * 4096 +
  (instr('0123456789abcdef', substr(lower(`id`), 5, 1)) - 1) * 256 +
  (instr('0123456789abcdef', substr(lower(`id`), 6, 1)) - 1) * 16 +
  (instr('0123456789abcdef', substr(lower(`id`), 7, 1)) - 1)
WHERE `visual_seed` = 0;
--> statement-breakpoint
-- Las plantas nacidas antes de 7E.2 llevaban el placeholder 'brote-comun' (7B).
-- Se les asigna una de las cinco especies reales de forma determinista y estable.
UPDATE `focus_plants` SET `species` = CASE `visual_seed` % 5
  WHEN 0 THEN 'helecho'
  WHEN 1 THEN 'monstera'
  WHEN 2 THEN 'suculenta'
  WHEN 3 THEN 'lavanda'
  ELSE 'olivo'
END WHERE `species` = 'brote-comun';
