# Fase 7E.2 — Identidad de plantas, migración y motor determinista (sin interfaz)

**Fecha:** 2026-07-16 · **Base:** commit 9244a96 (7D cerrada, auditoría 7E.1 aprobada).
**Decisión técnica previa:** ver `decision-asignaciones.md` en esta carpeta.

## Qué se construyó

1. **Migración 0006** (`drizzle/0006_plant-identity.sql`), recuperable e idempotente:
   - `focus_plants` + `visual_seed` (entero, backfill estable), `renderer_version` (= 1),
     `name` y `note` (nullable, sin interfaz v1);
   - tabla nueva `focus_session_plant_allocations` (id, session_id, plant_id,
     credited_minutes, created_at) con índices por sesión y por planta;
   - backfill: seed estable derivado de los primeros 7 hex del UUID; especie real
     asignada determinísticamente (`seed % 5`) a las plantas con el placeholder
     `brote-comun`; `accumulated_minutes`, `started_at` y `completed_at` intactos;
   - **cero** filas de asignación inventadas: las sesiones previas quedan
     honestamente «sin planta asociada».

2. **Motor determinista** (`src/lib/plant-render.ts`, puro, sin componentes):
   - `newPlantIdentity(id)`: especie (5: helecho, monstera, suculenta, lavanda,
     olivo) + `visual_seed` (FNV-1a uint32) + `renderer_version = 1`, derivados del
     id UNA vez al nacer y persistidos — nunca se recalculan;
   - `plantRenderSpec({species, visualSeed, stage, rendererVersion})`: especificación
     testeable de tallo, ramas, hojas, orientación, altura, curvatura, densidad,
     proporciones y detalles botánicos permitidos por especie/etapa; PRNG con
     semilla (mulberry32), jamás `Math.random`; los rasgos de identidad no cambian
     entre etapas (la planta crece, no se convierte en otra); límites seguros
     exportados en `SPECIES_TRAITS` y verificados por pruebas; versión desconocida
     → error explícito; la ruta v1 queda congelada con un snapshot de oro.

3. **Motor de sesiones** (`src/lib/actions/focus.ts` + `splitCreditedMinutes` en
   `focus-logic.ts`): cada cierre con minutos > 0 escribe su asignación; una sesión
   que completa una planta escribe DOS (cierre + excedente a la semilla nueva, que
   nace con identidad propia). Invariante: la suma de asignaciones de una sesión ==
   `credited_minutes`, acotado incluso ante acumulados corruptos. Tareas, proyectos
   y decisiones de cierre intactos.

## Tratamiento exacto del excedente

Sesión de 25 min con la planta en 290: `splitCreditedMinutes(290, 25)` →
`toCurrent = 10` (la planta se guarda con 300 exactos y pasa al jardín) y
`toNext = 15` (la semilla nueva nace con 15 y su fila de asignación). Ningún
minuto se pierde ni se duplica; verificado en malla completa (unitarias) y
contra la base (E2E z14).

## Verificación

- **Unitarias:** 153 en verde (24 nuevas: 18 de plant-render + 6 de reparto).
- **Migración sobre copia fiel de la base real (WAL incluido):** conteos y filas
  de las 20 tablas intactos fila a fila; backfill correcto (planta actual →
  monstera, seed 68199866, renderer 1, name/note nulos); asignaciones vacías;
  segunda migración no-op.
- **E2E:** suite completa en verde, incluida la nueva z14 (5 pruebas: identidad al
  nacer + asignación simple; identidad estable tras recarga; sesión que completa
  una planta con 10+15; sesión legada sin asociación inventada; invariante global
  y conteos de tareas/proyectos/revisiones/ajustes intactos).
- **La app abre normalmente** con la base real migrada.

## Limitaciones conocidas

- El respaldo en JSON/Markdown (`scripts/lib-export.mjs`) aún no exporta las tablas
  de focus (la copia SQLite del respaldo sí las incluye completas). Pendiente para
  cuando se toque la exportación (fuera del alcance 7E.2, junto con Obsidian).
- Las 3 sesiones cerradas antes de la migración no tienen asignaciones (por diseño);
  la sesión que estaba abierta al migrar recibirá las suyas al cerrarse con el
  motor nuevo.
- La acreditación (planta + asignaciones + cierre de sesión) no corre dentro de una
  transacción SQLite (mismo patrón del resto de actions; app local monousuario).

## Sin interfaz nueva

Cero componentes, cero vistas, cero cambios visuales: sin pestaña Mi jardín, sin
galería, sin tarjetas, sin SVG finales, sin colores nuevos. Eso es 7E.3+.
