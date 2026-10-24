# Bloque 3 (avisos) — pasos en producción

Guía para publicar el PR #39 con los avisos **desactivados** y hacer después una
prueba controlada con un solo aviso real. Nada de esto migra, borra ni modifica
los recordatorios anteriores.

## Antes del merge

### 1. Respaldo

En https://mafer-os-app.vercel.app → **Ajustes → Respaldos y exportación →
«Descargar JSON»**. Deja el archivo en Descargas para que Claude lo verifique
(conteos de tareas y recordatorios; no se copia a ningún lado).

El JSON incluye todas las tareas con sus campos `reminder` y `gcal_event_id`.
No incluye `settings` (ahí están los permisos de Google), y la migración no la toca.

### 2. Cómo están guardados hoy los recordatorios (solo lectura)

En Supabase → proyecto de producción → **SQL Editor**, base `postgres`:

```sql
-- Solo lee. No cambia nada.
SELECT reminder,
       count(*)                                                   AS tareas,
       count(gcal_event_id)                                       AS con_evento_en_google,
       count(*) FILTER (WHERE completed_at IS NULL AND NOT archived) AS abiertas
FROM cards
GROUP BY reminder
ORDER BY reminder;
```

### 3. Migración 0002 (solo agrega una tabla)

```sql
-- Mafer OS · Bloque 3 · migración 0002
-- Solo CREA la tabla de avisos. No modifica ni borra ninguna tabla ni fila.
-- Se puede ejecutar dos veces sin efecto (IF NOT EXISTS).
CREATE TABLE IF NOT EXISTS "card_reminders" (
	"card_id" text PRIMARY KEY NOT NULL,
	"lead_minutes" integer DEFAULT 0 NOT NULL,
	"calendar_id" text,
	"gcal_event_id" text,
	"last_error" text,
	"last_synced_at" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
```

Verificación (debe mostrar 8 columnas y 0 filas):

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'card_reminders'
ORDER BY ordinal_position;

SELECT count(*) AS avisos FROM card_reminders;
```

Si algo saliera mal, la tabla nueva se quita sin afectar nada más con
`DROP TABLE card_reminders;` (está vacía y nada la usa mientras los avisos estén
desactivados).

## Qué pasa al desplegar

- `avisos_activos` no existe en producción → los avisos quedan **desactivados**.
- Los formularios siguen mostrando el selector «Recordatorio» de siempre y los
  recordatorios anteriores siguen funcionando exactamente igual.
- No hay migraciones automáticas, tareas programadas ni procesos al arrancar: el
  despliegue no escribe en la base ni llama a Google.
- Abrir Ajustes → Avisos no llama a Google mientras no se cree el calendario nuevo.

## Prueba controlada (después del merge)

1. Ajustes → Avisos → **«Enviar aviso de prueba»**. Crea el calendario
   «Mafer OS · Avisos» y un único evento («🔔 Prueba de avisos de Mafer OS») dentro
   de 5 minutos, con alerta a la hora. No toca tareas ni el calendario «Mafer OS».
   No requiere activar los avisos.
2. iPhone: en Safari, `calendar.google.com/calendar/syncselect` → marcar
   «Mafer OS · Avisos» → Guardar. App Calendario → Calendarios → comprobar que
   esté marcado. Con la app de Google Calendar: notificaciones activadas para ese
   calendario. Bloquear el iPhone, sin modo Concentración.
3. Alexa: es una preferencia. Mafer eligió (23 oct 2026) que Alexa SÍ lea sus avisos:
   «Mafer OS · Avisos» queda marcado en la app de Alexa → Calendario → Google. Para
   que no los lea, basta desmarcarlo ahí.
4. Ajustes → Avisos → **«Borrar aviso de prueba»**.

Activar los avisos de tareas es una decisión aparte, posterior a esta prueba.
