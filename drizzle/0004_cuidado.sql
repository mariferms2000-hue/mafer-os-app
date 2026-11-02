-- Mafer OS · cuidado del Jardín (Agua y Fertilizante, F4) · migración 0004
-- Solo CREA una tabla y AGREGA una columna opcional. No modifica ni borra
-- ninguna tabla ni fila existente (focus_plants queda intacta). Se puede
-- ejecutar dos veces sin efecto.
CREATE TABLE IF NOT EXISTS "garden_plant_care" (
	"plant_id" text PRIMARY KEY NOT NULL,
	"thirsty_since" text,
	"watered_at" text,
	"fertilized_at" text,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "garden_rewards" ADD COLUMN IF NOT EXISTS "used_on" text;
