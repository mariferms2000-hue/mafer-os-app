# Modal de tareas, planta interactiva y escala de crecimiento — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar los 7 cambios acordados en `docs/superpowers/specs/2026-07-22-task-modal-plant-polish-design.md`: reorganizar el modal de tarea (quitar "Próxima acción", reordenar columna izquierda, barra de progreso del checklist), hacer la planta del Jardín de enfoque interactiva (Hoy → Mi jardín; popup de detalle en Mi jardín), completar/reabrir tareas desde el menú de tres puntos de Proyectos, reducir la escala de crecimiento a 150 minutos, y suavizar la apertura del modal de tarea con skeleton + animación.

**Architecture:** Cambios acotados sobre componentes ya existentes de Next.js (App Router) + un componente cliente nuevo y reutilizable (`PlantCardTrigger`) para el popup de detalle de planta. Sin infraestructura nueva, sin dependencias nuevas.

**Tech Stack:** Next.js (App Router, Server Actions), React (Server + Client Components), Tailwind CSS v4, Drizzle ORM/Postgres, vitest (pruebas unitarias de lógica pura), lucide-react (iconos).

## Global Constraints

- Todo el copy de UI va en español, con el mismo tono ya usado en el resto de la app (directo, cálido, sin tecnicismos).
- No agregar dependencias nuevas (`package.json` no cambia).
- Este proyecto **no tiene arnés de pruebas de componentes React** (sin React Testing Library ni jsdom) — solo `vitest` para lógica pura en `src/lib/*.ts` (ver `tests/*.test.ts`, corridos con `npm run test:unit`). Las tareas que solo tocan JSX/componentes se verifican manualmente en `npm run dev`, no con tests automatizados nuevos — seguir ese mismo patrón, no inventar un harness nuevo.
- **No usar `npm run test:e2e` como señal de regresión**: corre contra la base Postgres real desde la migración a Supabase, no una aislada (gap documentado en el spec). Ignorarlo para este trabajo.
- Cualquier animación/transición nueva debe respetar el guard global de `prefers-reduced-motion` que ya existe en `src/app/globals.css` (no hace falta código adicional para esto — ya cubre `animation-duration`/`transition-duration` de forma global).
- No tocar: columna derecha del modal de tarea, layout general de ninguna página, modos claro/oscuro, comportamiento en computadora vs. iPhone, datos y tareas ya existentes en la base.
- Cada tarea termina con un `git commit` propio.

---

## File Structure

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/components/tasks/task-detail.tsx` | Modificar (Tareas 1 y 6) | Quitar "Próxima acción", reordenar columna izquierda, agregar barra de progreso, agregar skeleton + animación de apertura |
| `src/components/hoy/focus-module.tsx` | Modificar (Tarea 2) | La planta de la tarjeta de Hoy enlaza a Mi jardín |
| `src/components/explore/plant-detail-modal.tsx` | Crear (Tarea 3) | Popup de detalle de una planta (especie, etapa, minutos, fechas) |
| `src/components/explore/plant-card-trigger.tsx` | Crear (Tarea 3) | Wrapper cliente reutilizable: hace clickeable cualquier tarjeta de planta y monta `PlantDetailModal` |
| `src/app/(app)/explorar/jardin/page.tsx` | Modificar (Tarea 3) | Usa `PlantCardTrigger` en la tarjeta de "Planta actual" y en cada tarjeta del grid de completadas |
| `src/components/board/board.tsx` | Modificar (Tarea 4) | Agrega "Marcar como completada/pendiente" al menú de tres puntos de `CardMenu` |
| `src/lib/focus-logic.ts` | Modificar (Tarea 5) | Nuevos umbrales de etapa (0/15/40/80/150) |
| `tests/focus-logic.test.ts` | Modificar (Tarea 5) | Actualiza aserciones a los nuevos umbrales |
| `tests/plant-render.test.ts` | Modificar (Tarea 5) | Actualiza aserciones a los nuevos umbrales |
| `src/app/globals.css` | Modificar (Tarea 6) | `@keyframes` + clase `.task-modal-enter` para la animación de apertura del modal de tarea |

---

### Task 1: Reorganizar el modal de tarea — quitar "Próxima acción", reordenar columna izquierda, agregar barra de progreso del checklist

**Files:**
- Modify: `src/components/tasks/task-detail.tsx`

**Interfaces:**
- Consumes: nada nuevo — usa el estado `checklist: ChecklistItem[]` que ya existe en `TaskDetailEditor`.
- Produces: componente `ChecklistProgress({ checklist }: { checklist: ChecklistItem[] })`, definido en este mismo archivo, no usado por ninguna otra tarea.

- [ ] **Step 1: Agregar el componente `ChecklistProgress`**

Justo después de `type ColumnOption = { id: string; title: string; kind: string };` (línea 23 actual) y antes de `export function TaskDetailModal`, agregar:

```tsx
/** Progreso de la checklist: porcentaje + conteo, oculto si no hay ítems.
 *  Llegar a 100% es puramente visual — no completa la tarea. */
function ChecklistProgress({ checklist }: { checklist: ChecklistItem[] }) {
  if (checklist.length === 0) return null;
  const done = checklist.filter((i) => i.done).length;
  const pct = Math.round((done / checklist.length) * 100);
  return (
    <div className="flex items-center gap-2.5 mb-2" data-testid="checklist-progress">
      <div
        className="progress-track flex-1"
        role="progressbar"
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={checklist.length}
        aria-label="Pasos completados de la checklist"
      >
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-stone tabular-nums shrink-0">
        {pct}% · {done} de {checklist.length}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Reordenar la columna izquierda y quitar "Próxima acción concreta"**

Reemplazar todo el bloque que va desde `{/* Columna principal: lo que la tarea ES */}` hasta el cierre de esa columna (justo antes de `{/* Columna lateral: dónde vive y cómo se organiza */}`) — hoy es:

```tsx
            {/* Columna principal: lo que la tarea ES */}
            <div className="flex flex-col gap-4 min-w-0">
              <div>
                <label className="label" htmlFor="cd-title">Título</label>
                <input id="cd-title" name="title" className="input font-medium" defaultValue={card.title} required data-testid="card-title-input" />
              </div>
              <div>
                <label className="label" htmlFor="cd-desc">Descripción</label>
                <textarea id="cd-desc" name="description" className="textarea" rows={4} defaultValue={card.description ?? ""} data-testid="card-desc-input" placeholder="Notas, contexto, lo que haga falta…" />
              </div>
              <div>
                <label className="label" htmlFor="cd-next">Próxima acción concreta</label>
                <input id="cd-next" name="nextAction" className="input" defaultValue={card.nextAction ?? ""} placeholder="¿Cuál es el siguiente paso físico y visible?" />
              </div>

              {/* Checklist: se guarda sola, no marca el formulario como sucio */}
              <div onChange={(e) => e.stopPropagation()}>
                <p className="label">Checklist</p>
                {checklist.length > 0 && (
                  <ul className="flex flex-col gap-1.5 mb-2" data-testid="checklist">
                    {checklist.map((item) => (
                      <li key={item.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          aria-label={`Marcar «${item.text}»`}
                          checked={item.done}
                          onChange={() =>
                            saveChecklist(checklist.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)))
                          }
                          className="h-4 w-4 shrink-0"
                        />
                        <input
                          className={`text-sm flex-1 bg-transparent border-0 focus:outline-none focus:bg-beige/60 rounded px-1 -mx-1 ${item.done ? "line-through text-stone-soft" : ""}`}
                          defaultValue={item.text}
                          aria-label={`Editar «${item.text}»`}
                          onBlur={(e) => {
                            const text = e.target.value.trim();
                            if (text && text !== item.text) {
                              saveChecklist(checklist.map((i) => (i.id === item.id ? { ...i, text } : i)));
                            } else {
                              e.target.value = item.text;
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                        />
                        <button
                          type="button"
                          aria-label={`Eliminar «${item.text}»`}
                          className="text-stone-soft hover:text-blocked shrink-0"
                          onClick={() => saveChecklist(checklist.filter((i) => i.id !== item.id))}
                        >
                          <X size={14} aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-2">
                  <input
                    className="input !min-h-9 text-sm"
                    placeholder="Nuevo paso…"
                    value={newItem}
                    data-testid="checklist-add-input"
                    onChange={(e) => setNewItem(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newItem.trim()) {
                        e.preventDefault();
                        saveChecklist([...checklist, { id: crypto.randomUUID(), text: newItem.trim(), done: false }]);
                        setNewItem("");
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary !min-h-9"
                    aria-label="Añadir paso a la checklist"
                    disabled={!newItem.trim()}
                    data-testid="checklist-add"
                    onClick={() => {
                      saveChecklist([...checklist, { id: crypto.randomUUID(), text: newItem.trim(), done: false }]);
                      setNewItem("");
                    }}
                  >
                    <Plus size={15} aria-hidden />
                  </button>
                </div>
              </div>

              {/* Enlaces / referencias */}
              <div>
                <p className="label flex items-center gap-1.5"><Link2 size={13} aria-hidden /> Enlaces</p>
                {links.length > 0 && (
                  <ul className="flex flex-col gap-1.5 mb-2">
                    {links.map((l, i) => (
                      <li key={i} className="flex gap-2 items-center">
                        <input
                          className="input !min-h-9 text-sm !w-36 shrink-0"
                          placeholder="Nombre"
                          value={l.label}
                          aria-label={`Nombre del enlace ${i + 1}`}
                          onChange={(e) => {
                            setDirty(true);
                            setLinks(links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)));
                          }}
                        />
                        <input
                          className="input !min-h-9 text-sm flex-1"
                          placeholder="https://"
                          value={l.url}
                          aria-label={`URL del enlace ${i + 1}`}
                          onChange={(e) => {
                            setDirty(true);
                            setLinks(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)));
                          }}
                        />
                        <button
                          type="button"
                          aria-label={`Eliminar enlace ${i + 1}`}
                          className="text-stone-soft hover:text-blocked shrink-0"
                          onClick={() => {
                            setDirty(true);
                            setLinks(links.filter((_, j) => j !== i));
                          }}
                        >
                          <X size={14} aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  className="btn btn-ghost !py-1 text-xs"
                  data-testid="add-link"
                  onClick={() => {
                    setDirty(true);
                    setLinks([...links, { label: "", url: "" }]);
                  }}
                >
                  <Plus size={13} aria-hidden /> Añadir enlace
                </button>
              </div>
            </div>
```

Reemplazar por (mismo contenido, orden Título → Checklist con barra de progreso → Descripción → Enlaces, sin el campo "Próxima acción concreta"):

```tsx
            {/* Columna principal: lo que la tarea ES */}
            <div className="flex flex-col gap-4 min-w-0">
              <div>
                <label className="label" htmlFor="cd-title">Título</label>
                <input id="cd-title" name="title" className="input font-medium" defaultValue={card.title} required data-testid="card-title-input" />
              </div>

              {/* Checklist: se guarda sola, no marca el formulario como sucio */}
              <div onChange={(e) => e.stopPropagation()}>
                <p className="label">Checklist</p>
                <ChecklistProgress checklist={checklist} />
                {checklist.length > 0 && (
                  <ul className="flex flex-col gap-1.5 mb-2" data-testid="checklist">
                    {checklist.map((item) => (
                      <li key={item.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          aria-label={`Marcar «${item.text}»`}
                          checked={item.done}
                          onChange={() =>
                            saveChecklist(checklist.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)))
                          }
                          className="h-4 w-4 shrink-0"
                        />
                        <input
                          className={`text-sm flex-1 bg-transparent border-0 focus:outline-none focus:bg-beige/60 rounded px-1 -mx-1 ${item.done ? "line-through text-stone-soft" : ""}`}
                          defaultValue={item.text}
                          aria-label={`Editar «${item.text}»`}
                          onBlur={(e) => {
                            const text = e.target.value.trim();
                            if (text && text !== item.text) {
                              saveChecklist(checklist.map((i) => (i.id === item.id ? { ...i, text } : i)));
                            } else {
                              e.target.value = item.text;
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                        />
                        <button
                          type="button"
                          aria-label={`Eliminar «${item.text}»`}
                          className="text-stone-soft hover:text-blocked shrink-0"
                          onClick={() => saveChecklist(checklist.filter((i) => i.id !== item.id))}
                        >
                          <X size={14} aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-2">
                  <input
                    className="input !min-h-9 text-sm"
                    placeholder="Nuevo paso…"
                    value={newItem}
                    data-testid="checklist-add-input"
                    onChange={(e) => setNewItem(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newItem.trim()) {
                        e.preventDefault();
                        saveChecklist([...checklist, { id: crypto.randomUUID(), text: newItem.trim(), done: false }]);
                        setNewItem("");
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary !min-h-9"
                    aria-label="Añadir paso a la checklist"
                    disabled={!newItem.trim()}
                    data-testid="checklist-add"
                    onClick={() => {
                      saveChecklist([...checklist, { id: crypto.randomUUID(), text: newItem.trim(), done: false }]);
                      setNewItem("");
                    }}
                  >
                    <Plus size={15} aria-hidden />
                  </button>
                </div>
              </div>

              <div>
                <label className="label" htmlFor="cd-desc">Descripción</label>
                <textarea id="cd-desc" name="description" className="textarea" rows={4} defaultValue={card.description ?? ""} data-testid="card-desc-input" placeholder="Notas, contexto, lo que haga falta…" />
              </div>

              {/* Enlaces / referencias */}
              <div>
                <p className="label flex items-center gap-1.5"><Link2 size={13} aria-hidden /> Enlaces</p>
                {links.length > 0 && (
                  <ul className="flex flex-col gap-1.5 mb-2">
                    {links.map((l, i) => (
                      <li key={i} className="flex gap-2 items-center">
                        <input
                          className="input !min-h-9 text-sm !w-36 shrink-0"
                          placeholder="Nombre"
                          value={l.label}
                          aria-label={`Nombre del enlace ${i + 1}`}
                          onChange={(e) => {
                            setDirty(true);
                            setLinks(links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)));
                          }}
                        />
                        <input
                          className="input !min-h-9 text-sm flex-1"
                          placeholder="https://"
                          value={l.url}
                          aria-label={`URL del enlace ${i + 1}`}
                          onChange={(e) => {
                            setDirty(true);
                            setLinks(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)));
                          }}
                        />
                        <button
                          type="button"
                          aria-label={`Eliminar enlace ${i + 1}`}
                          className="text-stone-soft hover:text-blocked shrink-0"
                          onClick={() => {
                            setDirty(true);
                            setLinks(links.filter((_, j) => j !== i));
                          }}
                        >
                          <X size={14} aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  className="btn btn-ghost !py-1 text-xs"
                  data-testid="add-link"
                  onClick={() => {
                    setDirty(true);
                    setLinks([...links, { label: "", url: "" }]);
                  }}
                >
                  <Plus size={13} aria-hidden /> Añadir enlace
                </button>
              </div>
            </div>
```

- [ ] **Step 3: Verificación manual**

Run: `npm run dev`, abrir cualquier tarea con checklist (o crear una y agregar 2-3 pasos).

Expected:
- El campo "Próxima acción concreta" ya no aparece en el modal.
- Orden de arriba a abajo: Título, Checklist (con la barra de progreso arriba de la lista), Descripción, Enlaces.
- Marcar/desmarcar un paso actualiza el porcentaje y el conteo ("X% · Y de Z") al instante.
- Con checklist vacía, la barra no se muestra.
- Marcar todos los pasos (100%) no completa la tarea ni cambia el botón "Completar".

- [ ] **Step 4: Commit**

```bash
git add src/components/tasks/task-detail.tsx
git commit -m "feat(tareas): quita próxima acción del modal, reordena columna y agrega barra de progreso de checklist"
```

---

### Task 2: Planta interactiva en Hoy — enlaza a Mi jardín

**Files:**
- Modify: `src/components/hoy/focus-module.tsx`

**Interfaces:**
- Consumes: `Link` de `next/link` (ya importado en el archivo).
- Produces: nada consumido por otras tareas.

- [ ] **Step 1: Envolver la planta en un enlace**

En la rama sin sesión activa de `FocusModule` (después del `return` que arma `plant`/`stage`/`acc`/`next`), reemplazar:

```tsx
      <div className="flex items-center gap-3">
        <FocusPlant stage={stage} className="h-14 w-14 shrink-0 text-sage-deep" />
        <div className="min-w-0 flex-1">
```

por:

```tsx
      <div className="flex items-center gap-3">
        <Link href="/explorar/jardin" aria-label="Ver mi jardín" data-testid="focus-module-plant-link">
          <FocusPlant stage={stage} className="h-14 w-14 shrink-0 text-sage-deep" />
        </Link>
        <div className="min-w-0 flex-1">
```

- [ ] **Step 2: Verificación manual**

Run: `npm run dev`, ir a Hoy sin tener una sesión de enfoque activa.

Expected: al tocar el dibujo de la planta (no solo el texto "ver mi jardín"), navega a `/explorar/jardin`. El overlay de una sesión activa/pausada no cambia (no se tocó `focus-overlay.tsx`).

- [ ] **Step 3: Commit**

```bash
git add src/components/hoy/focus-module.tsx
git commit -m "feat(hoy): la planta del jardín de enfoque enlaza a Mi jardín"
```

---

### Task 3: Popup de detalle de planta en Mi jardín

**Files:**
- Create: `src/components/explore/plant-detail-modal.tsx`
- Create: `src/components/explore/plant-card-trigger.tsx`
- Modify: `src/app/(app)/explorar/jardin/page.tsx`

**Interfaces:**
- Consumes: `GardenPlant` y `StageKey` de `@/lib/queries/focus` / `@/lib/focus-logic`; `PlantArt` de `@/components/focus/plant-art`; `SPECIES_LABEL` de `@/lib/plant-svg`; `PlantSpecies` de `@/lib/plant-render`.
- Produces:
  - `PlantDetailData` (tipo, en `plant-detail-modal.tsx`) = `GardenPlant & { stage: StageKey; next: { key: StageKey; missingMinutes: number } | null }`.
  - `PlantDetailModal({ plant: PlantDetailData; onClose: () => void })`.
  - `PlantCardTrigger({ plant: PlantDetailData; label: string; className?: string; testid?: string; as?: "div" | "li"; children: React.ReactNode })`.

- [ ] **Step 1: Crear `plant-detail-modal.tsx`**

```tsx
"use client";

import { X } from "lucide-react";
import { PlantArt } from "@/components/focus/plant-art";
import { SPECIES_LABEL } from "@/lib/plant-svg";
import { STAGES, type StageKey } from "@/lib/focus-logic";
import type { PlantSpecies } from "@/lib/plant-render";
import type { GardenPlant } from "@/lib/queries/focus";

/* Popup de detalle de una planta del Jardín de enfoque — abre desde Mi jardín
   al tocar la tarjeta de la planta actual o cualquiera del grid de completadas.
   Solo lectura: la misma información que ya se calcula en esa página, en un
   layout centrado con el arte de la planta más grande. name/note de
   focus_plants quedan fuera (fuera de la interfaz v1 en el schema). */

export type PlantDetailData = GardenPlant & {
  stage: StageKey;
  next: { key: StageKey; missingMinutes: number } | null;
};

const STAGE_LABEL: Record<StageKey, string> = Object.fromEntries(STAGES.map((s) => [s.key, s.label])) as Record<
  StageKey,
  string
>;

function asSpecies(s: string): PlantSpecies {
  return (s in SPECIES_LABEL ? s : "helecho") as PlantSpecies;
}

function fecha(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

export function PlantDetailModal({ plant, onClose }: { plant: PlantDetailData; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[55] overlay-screen flex items-end md:items-center justify-center p-0 md:p-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Detalle de tu ${SPECIES_LABEL[plant.species] ?? plant.species}`}
        className="card card-raised w-full md:max-w-md max-h-[90dvh] overflow-y-auto rounded-b-none md:rounded-b-[18px] p-6 pb-safe"
        data-testid="plant-detail-modal"
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <p className="section-eyebrow">{plant.completedAt ? "Planta completada" : "Planta actual"}</p>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="btn btn-ghost !p-2">
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="flex flex-col items-center text-center">
          <PlantArt
            species={asSpecies(plant.species)}
            visualSeed={plant.visualSeed}
            stage={plant.stage}
            rendererVersion={plant.rendererVersion}
            className="h-40 w-40 text-sage-deep"
          />
          <h2 className="text-2xl font-display text-forest-deep mt-2">
            {SPECIES_LABEL[plant.species] ?? plant.species}
          </h2>
          <p className="text-sm text-stone mt-0.5">{STAGE_LABEL[plant.stage]}</p>
          <p className="text-sm text-stone mt-2">
            {plant.next
              ? `${plant.accumulatedMinutes} de ${plant.accumulatedMinutes + plant.next.missingMinutes} min para ${STAGE_LABEL[plant.next.key].toLowerCase()}`
              : "Planta completa"}
          </p>
          <p className="text-xs text-stone-soft mt-1">
            {plant.completedAt
              ? `Completada el ${fecha(plant.completedAt)} · ${plant.accumulatedMinutes} min de enfoque`
              : `La cuidas desde el ${fecha(plant.startedAt)} · ${plant.accumulatedMinutes} min de enfoque`}
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Crear `plant-card-trigger.tsx`**

```tsx
"use client";

import { useState } from "react";
import { PlantDetailModal, type PlantDetailData } from "./plant-detail-modal";

/** Hace clickeable cualquier tarjeta de planta (la actual o una completada) y
 *  monta el popup de detalle al abrirse. `as` deja renderizar como `li` para
 *  no romper la semántica de lista del grid de completadas. Si la tarjeta
 *  tiene otro elemento interactivo adentro (p. ej. un botón), ese elemento
 *  debe detener la propagación del clic para no abrir el popup por error. */
export function PlantCardTrigger({
  plant,
  label,
  className,
  testid,
  as: As = "div",
  children,
}: {
  plant: PlantDetailData;
  label: string;
  className?: string;
  testid?: string;
  as?: "div" | "li";
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <As
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        aria-label={label}
        className={className}
        data-testid={testid}
      >
        {children}
      </As>
      {open && <PlantDetailModal plant={plant} onClose={() => setOpen(false)} />}
    </>
  );
}
```

- [ ] **Step 3: Usar `PlantCardTrigger` en `jardin/page.tsx`**

Agregar el import (junto a los demás imports de componentes):

```tsx
import { PlantCardTrigger } from "@/components/explore/plant-card-trigger";
```

Reemplazar la sección `{/* Planta actual: la protagonista de la pantalla */}` completa — hoy:

```tsx
      <section
        aria-labelledby="planta-actual"
        className="card p-5 md:p-7 mb-10 !border-border-focus/40"
        data-testid="garden-current"
      >
        <div className="flex flex-col sm:flex-row items-center gap-5 md:gap-9">
          {c ? (
            <PlantArt
              species={asSpecies(c.species)}
              visualSeed={c.visualSeed}
              stage={c.stage}
              rendererVersion={c.rendererVersion}
              className="h-40 w-40 md:h-48 md:w-48 shrink-0 text-sage-deep"
            />
          ) : (
            <PlantArt
              species="helecho"
              visualSeed={0}
              stage="semilla"
              rendererVersion={1}
              className="h-40 w-40 md:h-48 md:w-48 shrink-0 text-sage-deep"
            />
          )}
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p id="planta-actual" className="section-eyebrow">
              Planta actual
            </p>
            <h2 className="text-2xl md:text-3xl text-forest-deep mt-1" data-testid="garden-current-species">
              {c ? SPECIES_LABEL[c.species] ?? c.species : "Semilla nueva"}
            </h2>
            <p className="text-sm text-stone mt-0.5" data-testid="garden-current-stage">
              {c ? STAGE_LABEL[c.stage] : STAGE_LABEL.semilla}
            </p>
            <p className="text-sm text-stone mt-2" data-testid="garden-current-progress">
              {c
                ? c.next
                  ? `${c.accumulatedMinutes} de ${c.accumulatedMinutes + c.next.missingMinutes} min para ${STAGE_LABEL[c.next.key].toLowerCase()}`
                  : "Tu planta está completa"
                : "Tu primera sesión de enfoque la hará nacer"}
            </p>
            {c && (
              <p className="text-xs text-stone-soft mt-1">
                La cuidas desde el {fecha(c.startedAt)} · {c.accumulatedMinutes} min de enfoque
              </p>
            )}
            <div className="mt-4 flex justify-center sm:justify-start">
              <GardenFocusButton testid="garden-focus" />
            </div>
          </div>
        </div>
      </section>
```

por (agrega `PlantCardTrigger` solo cuando `c` existe; el placeholder de "sin planta" queda igual que hoy, sin interacción):

```tsx
      <section
        aria-labelledby="planta-actual"
        className="card p-5 md:p-7 mb-10 !border-border-focus/40"
        data-testid="garden-current"
      >
        {c ? (
          <PlantCardTrigger
            plant={c}
            label={`Ver detalle de tu ${SPECIES_LABEL[c.species] ?? c.species}`}
            testid="garden-current-open"
            className="flex flex-col sm:flex-row items-center gap-5 md:gap-9 cursor-pointer"
          >
            <PlantArt
              species={asSpecies(c.species)}
              visualSeed={c.visualSeed}
              stage={c.stage}
              rendererVersion={c.rendererVersion}
              className="h-40 w-40 md:h-48 md:w-48 shrink-0 text-sage-deep"
            />
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <p id="planta-actual" className="section-eyebrow">
                Planta actual
              </p>
              <h2 className="text-2xl md:text-3xl text-forest-deep mt-1" data-testid="garden-current-species">
                {SPECIES_LABEL[c.species] ?? c.species}
              </h2>
              <p className="text-sm text-stone mt-0.5" data-testid="garden-current-stage">
                {STAGE_LABEL[c.stage]}
              </p>
              <p className="text-sm text-stone mt-2" data-testid="garden-current-progress">
                {c.next
                  ? `${c.accumulatedMinutes} de ${c.accumulatedMinutes + c.next.missingMinutes} min para ${STAGE_LABEL[c.next.key].toLowerCase()}`
                  : "Tu planta está completa"}
              </p>
              <p className="text-xs text-stone-soft mt-1">
                La cuidas desde el {fecha(c.startedAt)} · {c.accumulatedMinutes} min de enfoque
              </p>
              <div
                className="mt-4 flex justify-center sm:justify-start"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <GardenFocusButton testid="garden-focus" />
              </div>
            </div>
          </PlantCardTrigger>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-5 md:gap-9">
            <PlantArt
              species="helecho"
              visualSeed={0}
              stage="semilla"
              rendererVersion={1}
              className="h-40 w-40 md:h-48 md:w-48 shrink-0 text-sage-deep"
            />
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <p id="planta-actual" className="section-eyebrow">
                Planta actual
              </p>
              <h2 className="text-2xl md:text-3xl text-forest-deep mt-1" data-testid="garden-current-species">
                Semilla nueva
              </h2>
              <p className="text-sm text-stone mt-0.5" data-testid="garden-current-stage">
                {STAGE_LABEL.semilla}
              </p>
              <p className="text-sm text-stone mt-2" data-testid="garden-current-progress">
                Tu primera sesión de enfoque la hará nacer
              </p>
              <div className="mt-4 flex justify-center sm:justify-start">
                <GardenFocusButton testid="garden-focus" />
              </div>
            </div>
          </div>
        )}
      </section>
```

Nota importante: el bloque `onClick`/`onPointerDown` con `stopPropagation()` alrededor de `<GardenFocusButton />` es necesario porque ese botón queda anidado dentro del `role="button"` de `PlantCardTrigger` — sin eso, tocar "Enfocarme" también abriría el popup de detalle (mismo patrón ya usado en `board.tsx`'s `CardMenu` para evitar que su menú de tres puntos dispare el clic de la tarjeta completa).

Reemplazar el grid de plantas completadas — hoy:

```tsx
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="garden-grid">
              {garden.completed.map((p) => (
                <li key={p.id} className="card p-4 flex flex-col items-center text-center" data-testid="garden-plant">
                  <PlantArt
                    species={asSpecies(p.species)}
                    visualSeed={p.visualSeed}
                    stage="planta-completa"
                    rendererVersion={p.rendererVersion}
                    className="h-32 w-32 text-sage-deep"
                  />
                  <p className="font-display text-lg text-forest-deep mt-2">{SPECIES_LABEL[p.species] ?? p.species}</p>
                  <p className="text-xs text-stone mt-0.5">Completada el {fecha(p.completedAt)}</p>
                  <p className="text-xs text-stone-soft">{p.accumulatedMinutes} min de enfoque</p>
                </li>
              ))}
            </ul>
```

por:

```tsx
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="garden-grid">
              {garden.completed.map((p) => (
                <PlantCardTrigger
                  key={p.id}
                  as="li"
                  plant={{ ...p, stage: "planta-completa", next: null }}
                  label={`Ver detalle de tu ${SPECIES_LABEL[p.species] ?? p.species} completada`}
                  testid="garden-plant"
                  className="card p-4 flex flex-col items-center text-center cursor-pointer"
                >
                  <PlantArt
                    species={asSpecies(p.species)}
                    visualSeed={p.visualSeed}
                    stage="planta-completa"
                    rendererVersion={p.rendererVersion}
                    className="h-32 w-32 text-sage-deep"
                  />
                  <p className="font-display text-lg text-forest-deep mt-2">{SPECIES_LABEL[p.species] ?? p.species}</p>
                  <p className="text-xs text-stone mt-0.5">Completada el {fecha(p.completedAt)}</p>
                  <p className="text-xs text-stone-soft">{p.accumulatedMinutes} min de enfoque</p>
                </PlantCardTrigger>
              ))}
            </ul>
```

- [ ] **Step 4: Verificación manual**

Run: `npm run dev`, ir a `/explorar/jardin` (con al menos una planta actual y, si es posible, alguna completada — usar datos de demostración desde Ajustes si hace falta).

Expected:
- Tocar la tarjeta de "Planta actual" (imagen o texto, no el botón "Enfocarme") abre un popup con especie, etapa, minutos acumulados y "la cuidas desde…".
- Tocar "Enfocarme" dentro de esa misma tarjeta NO abre el popup — hace lo de siempre.
- Tocar cualquier tarjeta del grid de plantas completadas abre el popup con "Completada el…" en vez de "la cuidas desde…".
- El popup cierra con el botón X o tocando fuera de él.
- Con teclado: la tarjeta es alcanzable con Tab y Enter/Espacio la abre.
- Si no hay planta actual (`c` es null), la tarjeta de "Semilla nueva" no es clickeable (sin cambios ahí).

- [ ] **Step 5: Commit**

```bash
git add src/components/explore/plant-detail-modal.tsx src/components/explore/plant-card-trigger.tsx "src/app/(app)/explorar/jardin/page.tsx"
git commit -m "feat(jardin): popup de detalle al tocar la tarjeta de una planta"
```

---

### Task 4: Completar/reabrir tarea desde el menú de tres puntos en Proyectos

**Files:**
- Modify: `src/components/board/board.tsx`

**Interfaces:**
- Consumes: `completeCardAction(id: string, complete: boolean, restorePriorityAt?: number | null): Promise<{ freedPriorityAt: number | null }>` de `@/lib/actions/cards` (ya existe, usada hoy en `task-detail.tsx`). `card.completedAt` ya existe en el tipo `BoardCard`.
- Produces: nada consumido por otras tareas.

- [ ] **Step 1: Importar `completeCardAction` y el ícono `CheckCircle2`**

Reemplazar:

```tsx
import { Plus, Clock, Ban, Hourglass, CalendarClock, ListChecks, MoreHorizontal, Trash2 } from "lucide-react";
import { moveCardAction, createCardInColumnAction, deleteCardAction } from "@/lib/actions/cards";
```

por:

```tsx
import { Plus, Clock, Ban, Hourglass, CalendarClock, ListChecks, MoreHorizontal, Trash2, CheckCircle2 } from "lucide-react";
import { moveCardAction, createCardInColumnAction, deleteCardAction, completeCardAction } from "@/lib/actions/cards";
```

- [ ] **Step 2: Pasar `completed` a `CardMenu` desde `CardFace`**

Reemplazar:

```tsx
        <CardMenu cardId={card.id} title={card.title} />
```

por:

```tsx
        <CardMenu cardId={card.id} title={card.title} completed={Boolean(card.completedAt)} />
```

- [ ] **Step 3: Agregar la acción de completar/reabrir a `CardMenu`**

Reemplazar toda la función `CardMenu` — hoy:

```tsx
function CardMenu({ cardId, title }: { cardId: string; title: string }) {
  const [menu, setMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();

  return (
    <div className="relative shrink-0" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-label={`Menú de «${title}»`}
        className="btn btn-ghost !p-1 -mt-0.5 -mr-0.5"
        onClick={() => {
          setMenu((m) => !m);
          setConfirmDelete(false);
        }}
        data-testid={`card-menu-${cardId}`}
      >
        <MoreHorizontal size={14} aria-hidden />
      </button>
      {menu && (
        <div className="absolute right-0 z-20 mt-1 card p-1.5 flex flex-col min-w-40 text-sm">
          {confirmDelete ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5">
              <span className="text-xs text-stone">¿Eliminar?</span>
              <button
                type="button"
                disabled={pending}
                className="btn btn-danger !py-1 !px-2 text-xs"
                data-testid={`card-menu-delete-confirm-${cardId}`}
                onClick={() =>
                  start(async () => {
                    await deleteCardAction(cardId);
                    setMenu(false);
                    toast.show({ tone: "info", message: "Tarea eliminada." });
                  })
                }
              >
                Sí, eliminar
              </button>
              <button type="button" className="btn btn-ghost !py-1 !px-2 text-xs" onClick={() => setConfirmDelete(false)}>
                No
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={pending}
              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-blocked hover:bg-blocked-soft"
              data-testid={`card-menu-delete-${cardId}`}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={14} aria-hidden /> Eliminar tarea
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

por:

```tsx
function CardMenu({ cardId, title, completed }: { cardId: string; title: string; completed: boolean }) {
  const [menu, setMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();

  function toggleComplete() {
    start(async () => {
      let freedAt: number | null = null;
      try {
        const res = await completeCardAction(cardId, !completed);
        freedAt = res.freedPriorityAt;
      } catch {
        toast.show({ tone: "error", message: "No se pudo guardar el cambio. La tarea quedó como estaba." });
        return;
      }
      setMenu(false);
      if (!completed) {
        toast.show({
          message: "Tarea completada ✓",
          action: {
            label: "Deshacer",
            onClick: async () => {
              try {
                await completeCardAction(cardId, false, freedAt);
              } catch {
                toast.show({ tone: "error", message: "No se pudo deshacer. Puedes reabrirla desde Terminadas." });
              }
            },
          },
          link: { label: "Ver en terminadas", href: "/tareas?v=terminadas" },
          duration: 8000,
        });
      } else {
        toast.show({ tone: "info", message: "Tarea reabierta — volvió a Próximo." });
      }
    });
  }

  return (
    <div className="relative shrink-0" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-label={`Menú de «${title}»`}
        className="btn btn-ghost !p-1 -mt-0.5 -mr-0.5"
        onClick={() => {
          setMenu((m) => !m);
          setConfirmDelete(false);
        }}
        data-testid={`card-menu-${cardId}`}
      >
        <MoreHorizontal size={14} aria-hidden />
      </button>
      {menu && (
        <div className="absolute right-0 z-20 mt-1 card p-1.5 flex flex-col min-w-40 text-sm">
          <button
            type="button"
            disabled={pending}
            className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-sand"
            data-testid={`card-menu-complete-${cardId}`}
            onClick={toggleComplete}
          >
            <CheckCircle2 size={14} aria-hidden /> {completed ? "Marcar como pendiente" : "Marcar como completada"}
          </button>
          <div className="my-1 border-t border-beige" />
          {confirmDelete ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5">
              <span className="text-xs text-stone">¿Eliminar?</span>
              <button
                type="button"
                disabled={pending}
                className="btn btn-danger !py-1 !px-2 text-xs"
                data-testid={`card-menu-delete-confirm-${cardId}`}
                onClick={() =>
                  start(async () => {
                    await deleteCardAction(cardId);
                    setMenu(false);
                    toast.show({ tone: "info", message: "Tarea eliminada." });
                  })
                }
              >
                Sí, eliminar
              </button>
              <button type="button" className="btn btn-ghost !py-1 !px-2 text-xs" onClick={() => setConfirmDelete(false)}>
                No
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={pending}
              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-blocked hover:bg-blocked-soft"
              data-testid={`card-menu-delete-${cardId}`}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={14} aria-hidden /> Eliminar tarea
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verificación manual**

Run: `npm run dev`, ir a un proyecto con tareas en su tablero.

Expected:
- El menú de tres puntos de una tarjeta pendiente muestra "Marcar como completada" arriba, separador, y "Eliminar tarea" abajo (con su estilo rojo de siempre).
- Al completarla: toast "Tarea completada ✓" con botón "Deshacer" y enlace "Ver en terminadas"; la tarjeta se mueve a la columna de terminados del tablero.
- El botón "Deshacer" del toast la reabre.
- En una tarjeta ya completada, el menú muestra "Marcar como pendiente"; al usarlo, toast "Tarea reabierta — volvió a Próximo." y la tarjeta vuelve a la columna de próximo.
- Eliminar sigue funcionando igual que antes.

- [ ] **Step 5: Commit**

```bash
git add src/components/board/board.tsx
git commit -m "feat(proyectos): agrega marcar como completada/pendiente al menú de tres puntos del tablero"
```

---

### Task 5: Escala de crecimiento a 150 minutos

**Files:**
- Modify: `src/lib/focus-logic.ts`
- Test: `tests/focus-logic.test.ts`
- Test: `tests/plant-render.test.ts`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `STAGES` y `PLANT_COMPLETE_MINUTES` con los nuevos valores — ya son consumidos por `plant-render.ts`, `focus-module.tsx`, `jardin/page.tsx` y `plant-detail-modal.tsx` (Tarea 3) sin cambios de firma, solo cambia el dato.

- [ ] **Step 1: Actualizar `tests/focus-logic.test.ts` a los nuevos umbrales (test falla primero)**

En el bloque `describe("crecimiento de la planta", ...)`, reemplazar:

```ts
describe("crecimiento de la planta", () => {
  it("las cinco etapas aprobadas: 0/25/75/150/300", () => {
    expect(STAGES.map((s) => s.minMinutes)).toEqual([0, 25, 75, 150, 300]);
    expect(plantStage(0)).toBe("semilla");
    expect(plantStage(24)).toBe("semilla");
    expect(plantStage(25)).toBe("brote");
    expect(plantStage(75)).toBe("hojas");
    expect(plantStage(149)).toBe("hojas");
    expect(plantStage(150)).toBe("planta-joven");
    expect(plantStage(300)).toBe("planta-completa");
    expect(plantStage(9999)).toBe("planta-completa");
  });

  it("explica con transparencia cuánto falta para la siguiente etapa", () => {
    expect(nextStageInfo(0)).toEqual({ key: "brote", missingMinutes: 25 });
    expect(nextStageInfo(110)).toEqual({ key: "planta-joven", missingMinutes: 40 });
    expect(nextStageInfo(300)).toBeNull();
  });

  it("acumula sin reiniciar: el progreso nunca retrocede ni caduca", () => {
    let acc = 0;
    for (const add of [10, 0, 40, 5]) acc = applyMinutesToPlant(acc, add).accumulated;
    expect(acc).toBe(55);
    expect(plantStage(acc)).toBe("brote");
  });

  it("los minutos negativos o fraccionales no corrompen la planta", () => {
    expect(applyMinutesToPlant(50, -10).accumulated).toBe(50);
    expect(applyMinutesToPlant(50, 9.9).accumulated).toBe(59);
  });
});
```

por:

```ts
describe("crecimiento de la planta", () => {
  it("las cinco etapas aprobadas: 0/15/40/80/150", () => {
    expect(STAGES.map((s) => s.minMinutes)).toEqual([0, 15, 40, 80, 150]);
    expect(plantStage(0)).toBe("semilla");
    expect(plantStage(14)).toBe("semilla");
    expect(plantStage(15)).toBe("brote");
    expect(plantStage(40)).toBe("hojas");
    expect(plantStage(79)).toBe("hojas");
    expect(plantStage(80)).toBe("planta-joven");
    expect(plantStage(150)).toBe("planta-completa");
    expect(plantStage(9999)).toBe("planta-completa");
  });

  it("explica con transparencia cuánto falta para la siguiente etapa", () => {
    expect(nextStageInfo(0)).toEqual({ key: "brote", missingMinutes: 15 });
    expect(nextStageInfo(60)).toEqual({ key: "planta-joven", missingMinutes: 20 });
    expect(nextStageInfo(150)).toBeNull();
  });

  it("acumula sin reiniciar: el progreso nunca retrocede ni caduca", () => {
    let acc = 0;
    for (const add of [10, 0, 40, 5]) acc = applyMinutesToPlant(acc, add).accumulated;
    expect(acc).toBe(55);
    expect(plantStage(acc)).toBe("hojas");
  });

  it("los minutos negativos o fraccionales no corrompen la planta", () => {
    expect(applyMinutesToPlant(50, -10).accumulated).toBe(50);
    expect(applyMinutesToPlant(50, 9.9).accumulated).toBe(59);
  });
});
```

En el bloque `describe("planta completa y semilla nueva", ...)`, reemplazar:

```ts
describe("planta completa y semilla nueva", () => {
  it("al llegar a 300 se completa y nace una semilla con el excedente", () => {
    const res = applyMinutesToPlant(290, 25);
    expect(res.completed).toBe(true);
    expect(res.accumulated).toBe(PLANT_COMPLETE_MINUTES); // se guarda con exactamente 300
    expect(res.overflow).toBe(15); // ningún minuto se pierde: pasa a la nueva
  });

  it("llegar exacto a 300 completa con excedente cero", () => {
    const res = applyMinutesToPlant(275, 25);
    expect(res.completed).toBe(true);
    expect(res.overflow).toBe(0);
  });

  it("por debajo del umbral no se completa", () => {
    const res = applyMinutesToPlant(200, 99);
    expect(res.completed).toBe(false);
    expect(res.accumulated).toBe(299);
  });
});
```

por:

```ts
describe("planta completa y semilla nueva", () => {
  it("al llegar a 150 se completa y nace una semilla con el excedente", () => {
    const res = applyMinutesToPlant(140, 25);
    expect(res.completed).toBe(true);
    expect(res.accumulated).toBe(PLANT_COMPLETE_MINUTES); // se guarda con exactamente 150
    expect(res.overflow).toBe(15); // ningún minuto se pierde: pasa a la nueva
  });

  it("llegar exacto a 150 completa con excedente cero", () => {
    const res = applyMinutesToPlant(125, 25);
    expect(res.completed).toBe(true);
    expect(res.overflow).toBe(0);
  });

  it("por debajo del umbral no se completa", () => {
    const res = applyMinutesToPlant(100, 49);
    expect(res.completed).toBe(false);
    expect(res.accumulated).toBe(149);
  });
});
```

En el bloque `describe("reparto sesión→planta (splitCreditedMinutes, 7E.2)", ...)`, reemplazar:

```ts
  it("el ejemplo canónico: 25 min con la planta en 290 → 10 cierran, 15 a la semilla", () => {
    const res = splitCreditedMinutes(290, 25);
    expect(res.completed).toBe(true);
    expect(res.accumulated).toBe(300);
    expect(res.toCurrent).toBe(10);
    expect(res.toNext).toBe(15);
    expect(res.overflow).toBe(15);
  });
```

por:

```ts
  it("el ejemplo canónico: 25 min con la planta en 140 → 10 cierran, 15 a la semilla", () => {
    const res = splitCreditedMinutes(140, 25);
    expect(res.completed).toBe(true);
    expect(res.accumulated).toBe(150);
    expect(res.toCurrent).toBe(10);
    expect(res.toNext).toBe(15);
    expect(res.overflow).toBe(15);
  });
```

y, en el mismo bloque, reemplazar:

```ts
  it("cierre exacto: completa sin excedente (la semilla nueva nace en cero)", () => {
    const res = splitCreditedMinutes(275, 25);
    expect(res.completed).toBe(true);
    expect(res.toCurrent).toBe(25);
    expect(res.toNext).toBe(0);
  });

  it("invariante: toCurrent + toNext == minutos abonados, en toda la malla", () => {
    for (let acc = 0; acc <= 300; acc += 10) {
      for (let add = 0; add <= 90; add += 7) {
        const res = splitCreditedMinutes(acc, add);
        expect(res.toCurrent + res.toNext).toBe(add);
        expect(res.toCurrent).toBeGreaterThanOrEqual(0);
        expect(res.toNext).toBeGreaterThanOrEqual(0);
        // ningún minuto se pierde ni se duplica: lo abonado crece exactamente add
        const grown = res.accumulated - Math.min(acc, 300) + (res.completed ? res.overflow : 0);
        expect(grown).toBe(add);
      }
    }
  });

  it("entradas corruptas no inventan minutos: acumulado > 300 no acredita de más", () => {
    const res = splitCreditedMinutes(305, 10);
    expect(res.toCurrent + res.toNext).toBe(10);
    expect(res.toCurrent).toBe(0);
    expect(res.toNext).toBe(10);
  });
```

por:

```ts
  it("cierre exacto: completa sin excedente (la semilla nueva nace en cero)", () => {
    const res = splitCreditedMinutes(125, 25);
    expect(res.completed).toBe(true);
    expect(res.toCurrent).toBe(25);
    expect(res.toNext).toBe(0);
  });

  it("invariante: toCurrent + toNext == minutos abonados, en toda la malla", () => {
    for (let acc = 0; acc <= PLANT_COMPLETE_MINUTES; acc += 10) {
      for (let add = 0; add <= 90; add += 7) {
        const res = splitCreditedMinutes(acc, add);
        expect(res.toCurrent + res.toNext).toBe(add);
        expect(res.toCurrent).toBeGreaterThanOrEqual(0);
        expect(res.toNext).toBeGreaterThanOrEqual(0);
        // ningún minuto se pierde ni se duplica: lo abonado crece exactamente add
        const grown = res.accumulated - Math.min(acc, PLANT_COMPLETE_MINUTES) + (res.completed ? res.overflow : 0);
        expect(grown).toBe(add);
      }
    }
  });

  it("entradas corruptas no inventan minutos: acumulado > 150 no acredita de más", () => {
    const res = splitCreditedMinutes(155, 10);
    expect(res.toCurrent + res.toNext).toBe(10);
    expect(res.toCurrent).toBe(0);
    expect(res.toNext).toBe(10);
  });
```

- [ ] **Step 2: Correr los tests y confirmar que fallan**

Run: `npm run test:unit -- tests/focus-logic.test.ts`
Expected: FAIL — los `expect` de arriba no coinciden con el comportamiento actual (`STAGES` sigue en `[0,25,75,150,300]`).

- [ ] **Step 3: Actualizar `tests/plant-render.test.ts` a los nuevos umbrales**

Reemplazar:

```ts
  it("las cinco etapas se derivan de los minutos con los umbrales aprobados", () => {
    expect(plantStage(0)).toBe("semilla");
    expect(plantStage(24)).toBe("semilla");
    expect(plantStage(25)).toBe("brote");
    expect(plantStage(75)).toBe("hojas");
    expect(plantStage(150)).toBe("planta-joven");
    expect(plantStage(299)).toBe("planta-joven");
    expect(plantStage(300)).toBe("planta-completa");
    expect(Object.keys(STAGE_GROWTH).sort()).toEqual([...ALL_STAGES].sort());
  });
```

por:

```ts
  it("las cinco etapas se derivan de los minutos con los umbrales aprobados", () => {
    expect(plantStage(0)).toBe("semilla");
    expect(plantStage(14)).toBe("semilla");
    expect(plantStage(15)).toBe("brote");
    expect(plantStage(40)).toBe("hojas");
    expect(plantStage(80)).toBe("planta-joven");
    expect(plantStage(149)).toBe("planta-joven");
    expect(plantStage(150)).toBe("planta-completa");
    expect(Object.keys(STAGE_GROWTH).sort()).toEqual([...ALL_STAGES].sort());
  });
```

- [ ] **Step 4: Cambiar los umbrales en `src/lib/focus-logic.ts`**

Reemplazar:

```ts
/** Umbrales aprobados: 0 · 25 · 75 · 150 · 300 minutos de enfoque real. */
export const STAGES: { key: StageKey; minMinutes: number; label: string }[] = [
  { key: "semilla", minMinutes: 0, label: "Semilla" },
  { key: "brote", minMinutes: 25, label: "Brote" },
  { key: "hojas", minMinutes: 75, label: "Hojas" },
  { key: "planta-joven", minMinutes: 150, label: "Planta joven" },
  { key: "planta-completa", minMinutes: 300, label: "Planta completa" },
];

export const PLANT_COMPLETE_MINUTES = 300;
```

por:

```ts
/** Umbrales aprobados: 0 · 15 · 40 · 80 · 150 minutos de enfoque real. */
export const STAGES: { key: StageKey; minMinutes: number; label: string }[] = [
  { key: "semilla", minMinutes: 0, label: "Semilla" },
  { key: "brote", minMinutes: 15, label: "Brote" },
  { key: "hojas", minMinutes: 40, label: "Hojas" },
  { key: "planta-joven", minMinutes: 80, label: "Planta joven" },
  { key: "planta-completa", minMinutes: 150, label: "Planta completa" },
];

export const PLANT_COMPLETE_MINUTES = 150;
```

- [ ] **Step 5: Correr los tests y confirmar que pasan**

Run: `npm run test:unit -- tests/focus-logic.test.ts tests/plant-render.test.ts`
Expected: PASS — todos los tests en verde.

- [ ] **Step 6: Correr la suite unitaria completa**

Run: `npm run test:unit`
Expected: PASS — ningún otro test depende de estos umbrales (confirmado por búsqueda de `300`/`STAGES`/`PLANT_COMPLETE` fuera de estos dos archivos antes de escribir este plan).

- [ ] **Step 7: Commit**

```bash
git add src/lib/focus-logic.ts tests/focus-logic.test.ts tests/plant-render.test.ts
git commit -m "feat(jardin): reduce la escala de crecimiento de la planta a 150 minutos totales"
```

---

### Task 6: Transición de apertura del modal de tarea (skeleton + animación)

**Files:**
- Modify: `src/components/tasks/task-detail.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: nada nuevo. Se apoya en el archivo ya modificado por la Tarea 1 (mismo componente `TaskDetailModal`/`TaskDetailEditor`).
- Produces: clase CSS `.task-modal-enter`, usada únicamente aquí (el popup de planta de la Tarea 3 no la usa — no estaba en el alcance del punto 7 del spec).

- [ ] **Step 1: Agregar la animación de entrada en `globals.css`**

Agregar, justo antes de `@media (prefers-reduced-motion: reduce) {` (después de las reglas `.pb-safe`/`.pt-safe`):

```css
/* Entrada del modal de tarea: hoja en móvil (refuerza el patrón ya usado de
   items-end/rounded-b-none), aparición suave centrada en desktop. El guard
   global de prefers-reduced-motion de aquí abajo la anula automáticamente. */
@keyframes task-modal-in-mobile {
  from { transform: translateY(16px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
@keyframes task-modal-in-desktop {
  from { transform: scale(0.97); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
.task-modal-enter {
  animation: task-modal-in-mobile 200ms ease-out;
}
@media (min-width: 768px) {
  .task-modal-enter {
    animation: task-modal-in-desktop 180ms ease-out;
  }
}
```

- [ ] **Step 2: Reemplazar el estado de carga por un skeleton con el mismo tamaño que el formulario cargado**

En `task-detail.tsx`, agregar (después de la función `ChecklistProgress` agregada en la Tarea 1, antes de `export function TaskDetailModal`):

```tsx
/** Mismo footprint que el formulario cargado (max-h/overflow/padding) para
 *  que la apertura no salte de tamaño mientras llegan los datos. */
function TaskDetailSkeleton() {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cargando tarea"
      className="card card-raised w-full md:max-w-3xl max-h-[94dvh] md:max-h-[88dvh] overflow-y-auto rounded-b-none md:rounded-b-[18px] p-5 md:p-6 pb-safe task-modal-enter"
      data-testid="card-detail"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="h-8 w-40 rounded-lg bg-beige animate-pulse" />
        <div className="h-8 w-8 rounded-lg bg-beige animate-pulse" />
      </div>
      <div className="md:grid md:grid-cols-[1fr_252px] md:gap-6 flex flex-col gap-5">
        <div className="flex flex-col gap-4 min-w-0">
          <div className="h-9 w-full rounded-xl bg-beige animate-pulse" />
          <div className="flex flex-col gap-2">
            <div className="h-4 w-24 rounded bg-beige animate-pulse" />
            <div className="h-5 w-full rounded bg-beige animate-pulse" />
            <div className="h-5 w-5/6 rounded bg-beige animate-pulse" />
          </div>
          <div className="h-24 w-full rounded-xl bg-beige animate-pulse" />
        </div>
        <div className="flex flex-col gap-4">
          <div className="h-16 w-full rounded-xl bg-beige animate-pulse" />
          <div className="h-16 w-full rounded-xl bg-beige animate-pulse" />
          <div className="h-9 w-full rounded-xl bg-beige animate-pulse" />
        </div>
      </div>
    </div>
  );
}
```

Reemplazar el cuerpo de `TaskDetailModal` — hoy:

```tsx
  if (!data) {
    return (
      <div className="fixed inset-0 z-[55] overlay-screen flex items-end md:items-center justify-center p-0 md:p-6" role="presentation">
        <div role="dialog" aria-modal="true" aria-label="Cargando tarea" className="card card-raised w-full md:max-w-3xl p-6 rounded-b-none md:rounded-b-[18px]" data-testid="card-detail">
          <p className="text-sm text-stone">Abriendo tarea…</p>
        </div>
      </div>
    );
  }
  return <TaskDetailEditor data={data} onClose={onClose} />;
```

por:

```tsx
  if (!data) {
    return (
      <div className="fixed inset-0 z-[55] overlay-screen flex items-end md:items-center justify-center p-0 md:p-6" role="presentation">
        <TaskDetailSkeleton />
      </div>
    );
  }
  return <TaskDetailEditor data={data} onClose={onClose} />;
```

- [ ] **Step 3: Aplicar la misma animación al modal ya cargado**

En `TaskDetailEditor`, en el `<div role="dialog" ...>` que envuelve el formulario, agregar `task-modal-enter` a su `className`. Hoy:

```tsx
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Detalle de «${card.title}»`}
        className="card card-raised w-full md:max-w-3xl max-h-[94dvh] md:max-h-[88dvh] overflow-y-auto rounded-b-none md:rounded-b-[18px] p-5 md:p-6 pb-safe"
        data-testid="card-detail"
      >
```

por:

```tsx
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Detalle de «${card.title}»`}
        className="card card-raised w-full md:max-w-3xl max-h-[94dvh] md:max-h-[88dvh] overflow-y-auto rounded-b-none md:rounded-b-[18px] p-5 md:p-6 pb-safe task-modal-enter"
        data-testid="card-detail"
      >
```

- [ ] **Step 4: Verificación manual**

Run: `npm run dev`, abrir varias tareas desde: (a) el tablero de un proyecto, (b) un enlace directo `?abrir=<id>` recargando la página, (c) el botón atrás del navegador después de cerrar una.

Expected:
- Ya no hay un salto brusco de tamaño entre el estado de carga y el formulario — ambos ocupan aproximadamente el mismo alto/ancho.
- En móvil (viewport angosto o simulador), el modal se desliza desde abajo con fade.
- En desktop, el modal aparece con fade + un leve efecto de escala (de más chico a tamaño normal).
- Con "reduce motion" activado en el sistema operativo, el modal aparece sin animación perceptible (instantáneo).
- El resto del modal (checklist, barra de progreso, orden de campos de la Tarea 1) sigue funcionando igual.

- [ ] **Step 5: Commit**

```bash
git add src/components/tasks/task-detail.tsx src/app/globals.css
git commit -m "feat(tareas): agrega skeleton y animación de entrada al abrir el modal de tarea"
```

---

## Self-Review

**Cobertura del spec:** los 7 puntos del spec tienen tarea propia — 1: Task 1 (quitar próxima acción); 2: Task 1 (reordenar); 3: Task 1 (barra de progreso); 4: Task 2 (Hoy) + Task 3 (Mi jardín); 5: Task 4 (menú de Proyectos); 6: Task 5 (escala de crecimiento); 7: Task 6 (transición del modal). Sin huecos.

**Placeholders:** ninguno — cada paso trae el código completo a escribir, sin "TBD" ni "similar a la tarea N".

**Consistencia de tipos:** `PlantDetailData` (Tarea 3) se define como `GardenPlant & { stage: StageKey; next: ... }`, exactamente la forma de `garden.current` que ya devuelve `getGarden()` en `queries/focus.ts` — se pasa tal cual (`plant={c}`) sin reconstrucción. `CardMenu` (Tarea 4) recibe `completed: boolean`, coherente con `Boolean(card.completedAt)` en el único call site. `ChecklistProgress`/`TaskDetailSkeleton` (Tareas 1 y 6) no exponen nada consumido fuera de `task-detail.tsx`.
