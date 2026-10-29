-- Mafer OS · progreso por tareas completadas · migración 0003
-- Solo CREA dos tablas y un índice, y rellena la tabla nueva. No modifica ni
-- borra ninguna tabla ni fila existente. Se puede ejecutar dos veces sin efecto.
CREATE TABLE IF NOT EXISTS "garden_rewards" (
	"id" text PRIMARY KEY NOT NULL,
	"item" text NOT NULL,
	"earned_at" text NOT NULL,
	"used_at" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "progress_credits" (
	"card_id" text PRIMARY KEY NOT NULL,
	"kind" text DEFAULT 'tarea' NOT NULL,
	"reward_id" text,
	"credited_at" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_progress_credits_reward" ON "progress_credits" USING btree ("reward_id");
--> statement-breakpoint
-- Las tareas que ya estaban completadas al lanzar la función quedan como
-- 'previa': ocupan su llave y nunca cuentan, ni aunque se reabran y se vuelvan
-- a completar.
INSERT INTO "progress_credits" ("card_id", "kind", "reward_id", "credited_at")
SELECT "id", 'previa', NULL, "completed_at" FROM "cards" WHERE "completed_at" IS NOT NULL
ON CONFLICT ("card_id") DO NOTHING;
