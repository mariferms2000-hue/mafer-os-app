# Progreso por tareas — migración 0003 en producción

En producción las migraciones **no** se aplican solas: este SQL se pega a mano en
Supabase → proyecto de producción → **SQL Editor**, base `postgres`, **antes** del
merge. Si el código llegara a producción sin él, completar tareas sigue
funcionando, pero el progreso no puede guardarse y cada completado muestra un
aviso visible («No se pudo actualizar el progreso»); ver «Si el código llega
antes que la migración» al final.

Solo crea dos tablas y un índice, y rellena la tabla nueva con las tareas ya
completadas. No modifica ni borra ninguna tabla ni fila existente. Se puede
ejecutar dos veces sin efecto.

## Orden

1. Respaldo (abajo).
2. Consultas de «Antes» (solo lectura).
3. Migración 0003.
4. Consultas de «Después» (solo lectura).
5. Merge del PR → Vercel despliega producción. Pocos minutos después del paso 3:
   una tarea completada entre la migración y el despliegue no queda como
   'previa' y, si se reabre y se vuelve a completar, daría un punto.
6. Prueba en producción: completar una tarea → toast con «Progreso del jardín ·
   1 de 3»; Mi jardín → «Recompensas del jardín» en 1 de 3.

## Antes: respaldo

https://mafer-os-app.vercel.app → **Ajustes → Respaldos y exportación →
«Descargar JSON»**.

## Antes: comprobación (solo lectura)

```sql
-- Debe devolver 0 filas: las tablas todavía no existen
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('garden_rewards', 'progress_credits');

-- Anota este número: después debe coincidir con las tareas marcadas 'previa'
SELECT count(*) AS tareas_completadas FROM cards WHERE completed_at IS NOT NULL;
```

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

**Antes del merge** (nadie usa las tablas todavía), se quitan sin afectar nada más:

```sql
DROP TABLE progress_credits;
DROP TABLE garden_rewards;
DELETE FROM settings WHERE key = 'progress_reward_bag';
```

**Después del merge**, primero se revierte el código (rollback del despliegue en
Vercel o revert del PR) y solo después se borran las tablas: con el código nuevo
en producción y sin tablas, cada completado mostraría el aviso de progreso. Borrar
las tablas pierde los puntos y recompensas ganados; las tareas no se tocan.

## Si el código llega antes que la migración

No se pierde ni se rompe ningún dato, y las tareas se completan igual:

- cada completado muestra «… · No se pudo actualizar el progreso.» (en el Inbox,
  «✓ Hecho. No se pudo actualizar el progreso.») y no suma punto;
- Mi jardín no muestra «Recompensas del jardín» (el progreso no se puede leer);
- «Deshacer» de un ✓ Hecho responde «No se pudo deshacer» y la tarea queda
  completada (no se borra nada sin poder quitar su punto); reabrir una tarea
  normal funciona.

Se arregla aplicando la migración en cuanto se note: el relleno marca como
'previa' también las tareas completadas en ese intervalo, así que no cuentan.

## Nota sobre Drizzle

El SQL se aplica a mano, como la 0002, así que la tabla de control de Drizzle en
producción no registra la 0003. Si algún día se corre `npm run db:migrate` contra
producción, la 0003 se volvería a ejecutar sin efecto (`IF NOT EXISTS` y
`ON CONFLICT DO NOTHING`).

## Previews y E2E

- `npm run db:migrate:preview` (base `mafer_preview`)
- `npm run db:migrate:test` (base `mafer_e2e`)
