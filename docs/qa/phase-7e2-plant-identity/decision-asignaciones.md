# Fase 7E.2 — Decisión técnica: asignaciones sesión → planta

**Fecha:** 2026-07-16 · **Estado:** decidido antes de implementar (aprobación general dada en el encargo de la fase).

## Problema

Una sesión de enfoque puede aportar minutos a **dos** plantas: si empieza cuando la planta
actual tiene 290 minutos y acredita 25, los primeros 10 completan esa planta y los 15
restantes pertenecen a la semilla nueva. Una sola columna `plant_id` en `focus_sessions`
haría ese historial incorrecto (¿a cuál de las dos apuntaría?).

## Decisión

**Tabla de asignaciones normalizada, sin `plant_id` en `focus_sessions`.**

```
focus_session_plant_allocations
  id               text PK
  session_id       text NOT NULL   -- referencia blanda a focus_sessions
  plant_id         text NOT NULL   -- referencia blanda a focus_plants
  credited_minutes integer NOT NULL
  created_at       text NOT NULL
```

- Una sesión normal produce **una** fila; una sesión que completa una planta produce
  **dos** (cierre de la planta anterior + excedente a la semilla nueva).
- **Invariante:** para toda sesión cerrada después de esta migración,
  `SUM(allocations.credited_minutes) == focus_sessions.credited_minutes`.
  Ningún minuto se pierde ni se duplica.
- No se añade `plant_id` a `focus_sessions`: duplicaría (y en el caso de dos plantas,
  contradiría) las asignaciones. La tabla de asignaciones es la única fuente de verdad
  de la relación sesión↔planta.
- Referencias blandas (sin FK), igual que `focus_sessions.card_id` y el resto del
  dominio focus; ni sesiones ni plantas se borran jamás, y se añaden índices por
  `session_id` y `plant_id` para las lecturas de 7E.3.
- Sesiones con 0 minutos acreditados (descartadas, terminadas en <1 min) no generan
  filas: la suma vacía (0) coincide con `credited_minutes = 0` y el invariante se sostiene.

## Sesiones anteriores a la migración

- **No se inventan asociaciones.** Las 3 sesiones cerradas antes de la migración quedan
  sin filas de asignación: en cualquier vista futura aparecerán honestamente como
  «sin planta asociada».
- La sesión **abierta** al momento de migrar no se toca; cuando se cierre, lo hará con el
  código nuevo y recibirá sus asignaciones reales en ese momento (eso no es inventar:
  la acreditación ocurre después de la migración).

## Identidad de plantas (backfill)

- `focus_plants` gana `visual_seed` (entero), `renderer_version` (entero), `name` y
  `note` (nullable, sin interfaz en v1).
- **Plantas nuevas:** al nacer, `newPlantIdentity(id)` (puro, en `src/lib/plant-render.ts`)
  deriva especie y `visual_seed` por hash FNV-1a del `id`; se **persisten** y nunca se
  recalculan. `renderer_version = 1` fijo al nacer.
- **Planta existente (backfill en SQL):** `visual_seed` estable derivado de los primeros
  7 caracteres hex de su UUID (determinista dentro del propio SQL de la migración);
  `renderer_version = 1`; `accumulated_minutes`, `started_at` y `completed_at` intactos.
  El valor del seed de backfill no necesita coincidir con el hash JS: el seed se guarda
  una sola vez y de ahí en adelante solo se lee.
- **Especie de la planta existente:** `brote-comun` fue el placeholder de 7B; como las
  cinco especies existen «desde la primera versión» y la planta actual sigue en etapa
  semilla (6 min, sin apariencia establecida en ninguna interfaz), se le asigna una de
  las cinco especies de forma determinista (`visual_seed % 5`). Documentado aquí para
  que no parezca un cambio silencioso.

## renderer_version

La especificación visual se genera con `plantRenderSpec({ species, visualSeed, stage,
rendererVersion })`. La versión 1 queda congelada con una prueba de oro (snapshot exacto
en las unitarias): si en el futuro existe un renderer v2, las plantas guardadas con
`renderer_version = 1` seguirán renderizándose por la ruta v1, byte a byte idéntica.
