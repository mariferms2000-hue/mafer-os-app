-- Fase 4B: la siguiente acción del proyecto como tarea real + nota «Contexto para retomar».
-- Sin FK a cards a propósito (SQLite + borrados): los ids colgantes se ignoran en código.
ALTER TABLE projects ADD COLUMN `next_action_card_id` text;--> statement-breakpoint
ALTER TABLE projects ADD COLUMN `resume_note` text DEFAULT '';
