# QA — Fase 2: duración estimada y energía requerida

Fecha: 2026-07-14 · Base de pruebas: temporal (`e2e/.test-db`), la BD real no se toca en pruebas.

## Modelo

Tres cosas separadas, como se pidió:

1. **Duración estimada de la tarea** — `cards.duration`: `under_10` (Menos de 10 min) · `ten_to_30` (10–30 min) · `thirty_to_60` (30–60 min) · `over_60` (Más de 60 min) · `NULL` (Sin estimar).
2. **Energía requerida por la tarea** — `cards.energy`: `low` (Baja) · `medium` (Media) · `high` (Alta) · `NULL` (Sin estimar).
3. **Energía del día de Mafer** — sin cambios: `settings.energy:YYYY-MM-DD` (baja|media|alta), por fecha, editable, no toca las 3 prioridades; lista para las recomendaciones de la siguiente fase.

## Migración (drizzle `0002_estimates.sql`, corre una sola vez al arrancar)

| Antes | Después | Razón |
| --- | --- | --- |
| `5m` | `under_10` | 5 min < 10 min |
| `15m` | `ten_to_30` | dentro del rango |
| `30m` | `ten_to_30` | la vista «≤30 min» ya lo incluía; se conserva ese comportamiento |
| `60m` | `thirty_to_60` | una hora = borde superior del rango 30–60 |
| `deep` | `over_60` | trabajo profundo = más de una hora |
| `baja/media/alta` | `low/medium/high` | tokens internos nuevos |
| vacío | `NULL` | sigue siendo «sin estimar»; nada se inventa |

Verificado sobre la BD real: 10 tarjetas antes y después; 3×`5m`→`under_10`, 2×`15m`→`ten_to_30`, 3×`baja`→`low`, 1×`media`→`medium`, los 5/6 sin estimar intactos. Idempotencia comprobada aplicando la migración por segunda vez a una copia (`sqlite3 .backup`): cero cambios. Además hay prueba unitaria de la migración sobre una base temporal con todos los tokens antiguos, y `normalizeDuration/normalizeEnergy` aceptan tokens viejos en runtime como defensa extra.

## Reglas de sugerencia (locales, transparentes, editables — `src/lib/estimates.ts`)

La primera regla cuya palabra aparezca al inicio de una palabra del título gana; sin coincidencia no se sugiere nada. Nunca se guardan solas: Mafer confirma, cambia u omite («Ahora no»).

| Palabras (inicio de palabra, sin distinguir acentos) | Duración | Energía |
| --- | --- | --- |
| enviar, mandar, confirmar, descargar, imprimir, pagar, avisar, responder, reenviar, firmar, reservar, cancelar, agendar, recoger, subir | Menos de 10 min | Baja |
| llamar, llamada, telefonear | 10–30 min | Baja |
| revisar, preparar, comparar, organizar, actualizar, leer, resumir, ordenar, documentar, cotizar, elegir | 30–60 min | Media |
| investigar, diseñar, redactar, desarrollar, estrategia, escribir, estudiar, analizar, planear, planificar, crear, construir, programar, migrar | Más de 60 min | Alta |

## Capturas

- `01-clasificacion-sugerida.png` — paso opcional tras crear, con sugerencia y su razón.
- `02-detalle-chips.png` — detalle de tarea con chips y bloque «Sugerido».
- `03-filtros-avanzados.png` — «Más filtros»: Sin duración / Sin energía / Sin estimar.
- `04-movil-clasificacion.png` — clasificación con chips en iPhone.

## Resultado de pruebas

Ver el resumen del commit: lint limpio, TypeScript limpio, build ok, 19/19 unitarias
(incluye reglas de sugerencia, normalización y migración) y suite E2E completa en verde
(Chrome, Safari/WebKit y viewport iPhone), más respaldo y sync con Obsidian ejecutados
contra la base real sin errores.
