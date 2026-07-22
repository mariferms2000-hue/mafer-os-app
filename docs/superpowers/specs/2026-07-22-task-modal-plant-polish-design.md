# Modal de tareas, planta interactiva y escala de crecimiento — diseño

## Problema

Un pase de pulido sobre el modal de detalle de tarea, la interacción con la
planta del Jardín de enfoque, y el ritmo de crecimiento de la planta. Son
siete cambios acotados dentro de código ya existente, sin infraestructura
nueva (a diferencia del editor de descripción enriquecido, que queda como un
spec aparte porque requiere agregar storage de archivos).

## Alcance

1. Quitar "Próxima acción concreta" del modal de tarea (se mantiene a nivel
   de proyecto).
2. Reordenar la columna izquierda del modal: Título → Checklist → Barra de
   progreso → Descripción → Enlaces.
3. Barra de progreso del checklist.
4. Planta interactiva (Hoy → Mi jardín; tarjetas de Mi jardín → popup de
   detalle).
5. "Marcar como completada/pendiente" en el menú de tres puntos de Proyectos.
6. Escala de crecimiento reducida a 150 minutos totales.

(La numeración original del pedido tenía 8 puntos; el punto 4 original —
editor de descripción enriquecido — se excluyó de este spec.)

**Fuera de alcance:** columna derecha del modal, layout general, modos
claro/oscuro, funcionamiento en computadora e iPhone, datos y tareas
existentes, editor de descripción enriquecido (spec aparte).

## 1. Quitar "Próxima acción concreta" del modal de tarea

`src/components/tasks/task-detail.tsx`: eliminar el bloque `cd-next`
(label + input) de la columna principal del formulario. El campo
`nextAction` deja de enviarse desde este form — el valor que ya tenga la
tarjeta en la base de datos no se toca ni se borra, simplemente deja de
editarse desde aquí. Se sigue editando a nivel de proyecto en
`src/components/projects/next-action.tsx`, que no cambia.

## 2 + 3. Reorganizar columna izquierda del modal + barra de progreso

Nuevo orden en la columna principal de `task-detail.tsx`: Título →
Checklist (con barra de progreso) → Descripción → Enlaces.

La barra de progreso es un componente pequeño derivado del estado
`checklist` que ya existe en `TaskDetailEditor` (no requiere ninguna
server action nueva):

- `% completado = doneCount / checklist.length`.
- Texto tipo "60% · 3 de 5 pasos".
- Se actualiza automáticamente porque lee el mismo estado `checklist` que
  ya reacciona a cada toggle/agregar/quitar ítem.
- Se oculta por completo cuando `checklist.length === 0`.
- Llegar a 100% es puramente visual: no dispara `completeCardAction` ni
  ninguna otra mutación.

## 4. Planta interactiva

**Hoy** (`src/components/hoy/focus-module.tsx`): en la tarjeta que se
muestra cuando no hay sesión activa, el `<FocusPlant>` se envuelve en un
enlace a `/explorar/jardin` (mismo destino que ya usa `GardenLink`, pero
aplicado también al dibujo de la planta, no solo al texto). El overlay de
sesión activa/pausada (`src/components/focus/focus-overlay.tsx`) **no se
toca** — ahí la planta se queda como está, para no invitar a salir de un
enfoque en curso con un tap accidental.

**Mi jardín** (`src/app/(app)/explorar/jardin/page.tsx`): tanto la tarjeta
de "Planta actual" como cada tarjeta del grid de plantas completadas se
vuelven clickeables (`role="button"`, con soporte de teclado) y abren un
modal cliente nuevo, `PlantDetailModal`. Muestra la misma información que
ya se calcula en esa página — especie, etapa o fecha de completado,
minutos acumulados, "la cuidas desde…" — en un layout centrado con el arte
de la planta más grande. No hace falta ruta nueva ni server action: los
datos ya vienen en `garden.current` / `garden.completed` desde el server
component y se pasan directo al modal client-side como props.

Campos `name` y `note` de `focus_plants` quedan fuera de este popup (ya
están marcados como fuera de la interfaz v1 en el schema).

## 5. Completar/reabrir tarea desde Proyectos

`src/components/board/board.tsx`, componente `CardMenu`: agregar un botón
"Marcar como completada" (o "Marcar como pendiente" si `card.completedAt`
ya tiene valor) arriba del separador que hoy solo tiene "Eliminar tarea".
Reusa `completeCardAction`, ya usada en `task-detail.tsx`, y el mismo
patrón de toast con botón "Deshacer" + enlace "Ver en terminadas". El botón
"Eliminar" se mantiene debajo, con su estilo `btn-danger` actual (ya lo
distingue visualmente del nuevo botón neutro).

`CardFace`/`BoardCard` necesitan exponer `completedAt` si aún no viaja en
ese tipo — se verifica al implementar.

## 6. Escala de crecimiento a 150 minutos

`src/lib/focus-logic.ts`:

- `STAGES`: los `minMinutes` cambian de `0 · 25 · 75 · 150 · 300` a
  `0 · 15 · 40 · 80 · 150`. Las etiquetas y `key` de cada etapa no cambian.
- `PLANT_COMPLETE_MINUTES` pasa de `300` a `150`.
- `applyMinutesToPlant` y `splitCreditedMinutes` no cambian de lógica —ya
  son genéricas sobre `PLANT_COMPLETE_MINUTES`—, así que el manejo de
  minutos acumulados y excedente (una planta se completa exactamente en el
  nuevo umbral y el resto pasa a la semilla siguiente) sigue intacto sin
  tocar código.
- Especie y apariencia de plantas existentes no cambian: el render depende
  de `species` + `visualSeed` + `STAGE_GROWTH` (factor por etapa, no
  tocado), no del umbral en minutos.
- Se actualizan los tests unitarios que asumen los umbrales viejos:
  `tests/focus-logic.test.ts`, `tests/plant-render.test.ts` (y los que
  toquen indirectamente esos números).

## Verificación

Gap conocido: `npm run test:e2e` corre contra la base Postgres real desde
la migración a Supabase (`playwright.config.ts` aísla `DB_PATH`/sqlite,
pero `src/lib/db/index.ts` solo lee `DATABASE_URL`), no contra una base
aislada — no se usará como señal de regresión para este trabajo. Se
verifica con:

- Suite unitaria (`vitest`) actualizada para los nuevos umbrales de
  `focus-logic.ts` y `plant-render.ts`.
- Pase manual en `npm run dev`: abrir el modal de tarea (checklist, barra
  de progreso, orden de campos, que "Próxima acción" ya no aparece),
  completar/reabrir una tarea desde Proyectos, tocar la planta en Hoy y en
  Mi jardín (tarjeta actual y completadas).
