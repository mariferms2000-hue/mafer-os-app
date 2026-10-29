# Progreso por tareas — migración 0003 en producción

En producción las migraciones **no** se aplican solas: este SQL se pega a mano en
Supabase → proyecto de producción → **SQL Editor**, base `postgres`, **antes** del
merge. Si se despliega sin él, completar tareas sigue funcionando (el progreso
falla en silencio y se registra), pero no suma puntos.

Solo crea dos tablas y un índice, y rellena la tabla nueva con las tareas ya
completadas. No modifica ni borra ninguna tabla ni fila existente. Se puede
ejecutar dos veces sin efecto.

## Antes: respaldo

https://mafer-os-app.vercel.app → **Ajustes → Respaldos y exportación →
«Descargar JSON»**.

## Migración 0003

```sql
-- Mafer OS · progreso por tareas completadas · migración 0003
CREATE TABLE IF NOT EXISTS "garden_rewards" (
	"id" text PRIMARY KEY NOT NULL,
	"item" text NOT NULL,
	"earned_at" text NOT NULL,
	"used_at" text
);

CREATE TABLE IF NOT EXISTS "progress_credits" (
	"card_id" text PRIMARY KEY NOT NULL,
	"kind" text DEFAULT 'tarea' NOT NULL,
	"reward_id" text,
	"credited_at" text NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_progress_credits_reward" ON "progress_credits" USING btree ("reward_id");

-- Las tareas ya completadas quedan como 'previa': nunca cuentan.
INSERT INTO "progress_credits" ("card_id", "kind", "reward_id", "credited_at")
SELECT "id", 'previa', NULL, "completed_at" FROM "cards" WHERE "completed_at" IS NOT NULL
ON CONFLICT ("card_id") DO NOTHING;
```

## Verificación (solo lectura)

```sql
-- Debe mostrar: garden_rewards 4 columnas, progress_credits 4 columnas
SELECT table_name, count(*) AS columnas FROM information_schema.columns
WHERE table_schema = 'public' AND table_name IN ('garden_rewards', 'progress_credits')
GROUP BY table_name ORDER BY table_name;

-- Las dos cifras deben coincidir; recompensas debe ser 0
SELECT (SELECT count(*) FROM cards WHERE completed_at IS NOT NULL)       AS tareas_completadas,
       (SELECT count(*) FROM progress_credits WHERE kind = 'previa')     AS marcadas_previa,
       (SELECT count(*) FROM garden_rewards)                             AS recompensas;
```

## Reversión

Mientras nadie haya ganado puntos, se quitan sin afectar nada más:

```sql
DROP TABLE progress_credits;
DROP TABLE garden_rewards;
DELETE FROM settings WHERE key = 'progress_reward_bag';
```

## Previews y E2E

- `npm run db:migrate:preview` (base `mafer_preview`)
- `npm run db:migrate:test` (base `mafer_e2e`)
