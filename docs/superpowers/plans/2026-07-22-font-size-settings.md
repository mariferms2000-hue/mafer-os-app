# Tamaño de fuente configurable en Ajustes — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar a Ajustes una sección "Tamaño de texto" con control independiente por categoría (Títulos, Botones, Texto de cuerpo, Etiquetas y chips, Campos de formulario), persistido en `localStorage` y aplicado en vivo a toda la app sin recargar ni parpadear, según `docs/superpowers/specs/2026-07-22-font-size-settings-design.md`.

**Architecture:** Lógica pura de escalas en `src/lib/font-size.ts` (testeable con vitest). Un script inline en `<head>` aplica el tamaño guardado antes del primer pintado (mismo mecanismo que el selector de tema claro/oscuro ya existente). Cinco reglas de `globals.css` pasan a leer variables CSS con fallback al valor actual; dos categorías (Títulos, Texto de cuerpo) reusan variables que Tailwind v4 ya expone globalmente, sin tocar ningún componente.

**Tech Stack:** Next.js (App Router), React (Server + Client Components), Tailwind CSS v4 (variables `--text-*` ya globales), vitest.

## Global Constraints

- Todo el copy de UI va en español, con el mismo tono ya usado en el resto de Ajustes.
- No agregar dependencias nuevas (`package.json` no cambia).
- Solo `localStorage`, igual que el tema — no se guarda en base de datos ni viaja entre dispositivos.
- Tres escalones únicamente, mismos para las 5 categorías: `pequeno` ×0.88, `normal` ×1 (idéntico al tamaño actual, sin cambio visual), `grande` ×1.15.
- Las 5 categorías y sus variables/bases son exactamente:
  - **Títulos** → `--text-lg` (1.125rem), `--text-xl` (1.25rem), `--text-2xl` (1.5rem), `--text-3xl` (1.875rem) — variables de Tailwind v4, ya globales, no se tocan en `globals.css`.
  - **Botones** → `--btn-font-size` (nueva, base 0.875rem) en `.btn`.
  - **Texto de cuerpo** → `--text-xs` (0.75rem), `--text-sm` (0.875rem), `--text-base` (1rem) — variables de Tailwind v4, ya globales, no se tocan en `globals.css`.
  - **Etiquetas y chips** → `--label-font-size` (nueva, base 0.75rem) en `.label`, `--chip-font-size` (nueva, base 0.72rem) en `.chip`, `--eyebrow-font-size` (nueva, base 0.72rem) en `.section-eyebrow`.
  - **Campos de formulario** → `--field-font-size` (nueva, base 0.9rem) en `.input`/`.select`/`.textarea`.
- Este proyecto **no tiene arnés de pruebas de componentes React** (sin RTL/jsdom) — solo `vitest` para lógica pura en `src/lib/*.ts`, corridos con `npm run test:unit`. Las tareas que solo tocan JSX/CSS se verifican manualmente en `npm run dev`.
- **No usar `npm run test:e2e`** como señal de regresión (gap conocido de base real, documentado en specs previos).
- No tocar: modos claro/oscuro (el tamaño de fuente debe funcionar igual en ambos), layout general, breakpoints existentes, más de 3 escalones, categorías adicionales a las 5 listadas, persistencia en base de datos.
- Cada tarea termina con un `git commit` propio.

---

## File Structure

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/lib/font-size.ts` | Crear (Tarea 1) | Lógica pura: escalones, mapa categoría→variables CSS→valor base, `computeFontSizeVars` |
| `tests/font-size.test.ts` | Crear (Tarea 1) | Pruebas unitarias de la lógica pura |
| `src/app/globals.css` | Modificar (Tarea 2) | `.btn`, `.label`, `.chip`, `.section-eyebrow`, `.input`/`.select`/`.textarea` pasan a `font-size: var(--xxx, <valor actual>)` |
| `src/components/shell/font-size.tsx` | Crear (Tarea 3) | `readFontSizePrefs()` / `applyFontSizes(prefs)` — localStorage + `document.documentElement.style.setProperty` |
| `src/components/shell/font-size-script.ts` | Crear (Tarea 4) | Script inline anti-parpadeo, mismo mecanismo que `theme-script.ts` |
| `src/app/layout.tsx` | Modificar (Tarea 4) | Inyecta el script de tamaño de fuente junto al de tema |
| `src/components/settings/font-size-settings.tsx` | Crear (Tarea 5) | UI: 5 filas de segmented control Pequeño/Normal/Grande |
| `src/app/(app)/ajustes/page.tsx` | Modificar (Tarea 5) | Nueva sección "Tamaño de texto", junto a Apariencia |

---

### Task 1: Lógica pura de escalas (`src/lib/font-size.ts`)

**Files:**
- Create: `src/lib/font-size.ts`
- Test: `tests/font-size.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces (usado por las Tareas 3, 4 y 5):
  - `type FontLevel = "pequeno" | "normal" | "grande"`
  - `type FontCategory = "titulos" | "botones" | "cuerpo" | "etiquetas" | "campos"`
  - `type FontSizePrefs = Record<FontCategory, FontLevel>`
  - `FONT_SIZE_SCALE: Record<FontLevel, number>`
  - `FONT_SIZE_LEVELS: FontLevel[]` (orden `["pequeno", "normal", "grande"]`)
  - `FONT_CATEGORY_VARS: Record<FontCategory, { cssVar: string; baseRem: number }[]>`
  - `FONT_CATEGORY_LABEL: Record<FontCategory, string>` (orden de llaves = orden de categorías en la UI: `titulos, botones, cuerpo, etiquetas, campos`)
  - `DEFAULT_FONT_SIZE_PREFS: FontSizePrefs` (las 5 en `"normal"`)
  - `computeFontSizeVars(prefs: FontSizePrefs): Record<string, string>`

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/font-size.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  FONT_SIZE_SCALE,
  FONT_SIZE_LEVELS,
  DEFAULT_FONT_SIZE_PREFS,
  computeFontSizeVars,
  type FontSizePrefs,
} from "../src/lib/font-size";

describe("escalones de tamaño", () => {
  it("los tres factores aprobados: pequeño ×0.88, normal ×1, grande ×1.15", () => {
    expect(FONT_SIZE_SCALE).toEqual({ pequeno: 0.88, normal: 1, grande: 1.15 });
    expect(FONT_SIZE_LEVELS).toEqual(["pequeno", "normal", "grande"]);
  });
});

describe("computeFontSizeVars", () => {
  it("con todo en 'normal', cada variable es exactamente el tamaño actual (100%, sin cambio visual)", () => {
    const vars = computeFontSizeVars(DEFAULT_FONT_SIZE_PREFS);
    expect(vars).toEqual({
      "--text-lg": "1.125rem",
      "--text-xl": "1.25rem",
      "--text-2xl": "1.5rem",
      "--text-3xl": "1.875rem",
      "--btn-font-size": "0.875rem",
      "--text-xs": "0.75rem",
      "--text-sm": "0.875rem",
      "--text-base": "1rem",
      "--label-font-size": "0.75rem",
      "--chip-font-size": "0.72rem",
      "--eyebrow-font-size": "0.72rem",
      "--field-font-size": "0.9rem",
    });
  });

  it("solo escala la categoría que cambia — las demás quedan en su tamaño actual", () => {
    const prefs: FontSizePrefs = { ...DEFAULT_FONT_SIZE_PREFS, titulos: "grande" };
    const vars = computeFontSizeVars(prefs);
    expect(vars["--text-2xl"]).toBe("1.725rem"); // 1.5 * 1.15
    expect(vars["--text-3xl"]).toBe("2.156rem"); // 1.875 * 1.15, redondeado a 3 decimales
    expect(vars["--btn-font-size"]).toBe("0.875rem"); // botones no cambió: sigue en 100%
    expect(vars["--text-xs"]).toBe("0.75rem"); // cuerpo no cambió
  });

  it("'pequeño' reduce todas las variables de esa categoría por igual", () => {
    const prefs: FontSizePrefs = { ...DEFAULT_FONT_SIZE_PREFS, cuerpo: "pequeno" };
    const vars = computeFontSizeVars(prefs);
    expect(vars["--text-xs"]).toBe("0.66rem"); // 0.75 * 0.88
    expect(vars["--text-sm"]).toBe("0.77rem"); // 0.875 * 0.88
    expect(vars["--text-base"]).toBe("0.88rem"); // 1 * 0.88
  });

  it("etiquetas y chips escalan sus tres variables juntas con el mismo factor", () => {
    const prefs: FontSizePrefs = { ...DEFAULT_FONT_SIZE_PREFS, etiquetas: "grande" };
    const vars = computeFontSizeVars(prefs);
    expect(vars["--label-font-size"]).toBe("0.862rem"); // 0.75 * 1.15, redondeado a 3 decimales
    expect(vars["--chip-font-size"]).toBe("0.828rem"); // 0.72 * 1.15
    expect(vars["--eyebrow-font-size"]).toBe("0.828rem");
  });

  it("campos de formulario escala su única variable", () => {
    const prefs: FontSizePrefs = { ...DEFAULT_FONT_SIZE_PREFS, campos: "grande" };
    const vars = computeFontSizeVars(prefs);
    expect(vars["--field-font-size"]).toBe("1.035rem"); // 0.9 * 1.15
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `npm run test:unit -- tests/font-size.test.ts`
Expected: FAIL — `../src/lib/font-size` no existe todavía (error de módulo no encontrado).

- [ ] **Step 3: Implementación mínima**

Crear `src/lib/font-size.ts`:

```ts
/* Lógica pura de tamaño de fuente configurable — sin DOM, sin localStorage,
   sin dependencias. Misma filosofía que focus-logic.ts: testeable sin
   mockear nada, la UI y la persistencia viven en otros archivos.

   Dos categorías (Títulos, Texto de cuerpo) reusan variables CSS que
   Tailwind v4 ya expone globalmente (--text-lg…--text-3xl, --text-xs…
   --text-base) — confirmado en el CSS compilado del proyecto:
   `.text-2xl{font-size:var(--text-2xl)}`. Las otras tres categorías usan
   variables propias, nuevas, referenciadas en globals.css. */

export type FontLevel = "pequeno" | "normal" | "grande";

export type FontCategory = "titulos" | "botones" | "cuerpo" | "etiquetas" | "campos";

export type FontSizePrefs = Record<FontCategory, FontLevel>;

export const FONT_SIZE_SCALE: Record<FontLevel, number> = {
  pequeno: 0.88,
  normal: 1,
  grande: 1.15,
};

export const FONT_SIZE_LEVELS: FontLevel[] = ["pequeno", "normal", "grande"];

type CategoryVarSpec = { cssVar: string; baseRem: number };

/** Bases = el tamaño que ya existe hoy en el sitio (ver globals.css y las
 *  variables --text-* que Tailwind v4 ya define). "Normal" nunca cambia
 *  nada visualmente porque su factor es 1. */
export const FONT_CATEGORY_VARS: Record<FontCategory, CategoryVarSpec[]> = {
  titulos: [
    { cssVar: "--text-lg", baseRem: 1.125 },
    { cssVar: "--text-xl", baseRem: 1.25 },
    { cssVar: "--text-2xl", baseRem: 1.5 },
    { cssVar: "--text-3xl", baseRem: 1.875 },
  ],
  botones: [{ cssVar: "--btn-font-size", baseRem: 0.875 }],
  cuerpo: [
    { cssVar: "--text-xs", baseRem: 0.75 },
    { cssVar: "--text-sm", baseRem: 0.875 },
    { cssVar: "--text-base", baseRem: 1 },
  ],
  etiquetas: [
    { cssVar: "--label-font-size", baseRem: 0.75 },
    { cssVar: "--chip-font-size", baseRem: 0.72 },
    { cssVar: "--eyebrow-font-size", baseRem: 0.72 },
  ],
  campos: [{ cssVar: "--field-font-size", baseRem: 0.9 }],
};

export const FONT_CATEGORY_LABEL: Record<FontCategory, string> = {
  titulos: "Títulos",
  botones: "Botones",
  cuerpo: "Texto de cuerpo",
  etiquetas: "Etiquetas y chips",
  campos: "Campos de formulario",
};

export const DEFAULT_FONT_SIZE_PREFS: FontSizePrefs = {
  titulos: "normal",
  botones: "normal",
  cuerpo: "normal",
  etiquetas: "normal",
  campos: "normal",
};

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Dado un nivel por categoría, calcula el valor final (en rem) de cada
 *  variable CSS involucrada. Función pura: misma entrada, misma salida. */
export function computeFontSizeVars(prefs: FontSizePrefs): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const category of Object.keys(FONT_CATEGORY_VARS) as FontCategory[]) {
    const factor = FONT_SIZE_SCALE[prefs[category]];
    for (const { cssVar, baseRem } of FONT_CATEGORY_VARS[category]) {
      vars[cssVar] = `${round3(baseRem * factor)}rem`;
    }
  }
  return vars;
}
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `npm run test:unit -- tests/font-size.test.ts`
Expected: PASS — 6 tests en verde.

- [ ] **Step 5: Correr la suite completa**

Run: `npm run test:unit`
Expected: PASS — todos los tests (los ya existentes + los 6 nuevos).

- [ ] **Step 6: Commit**

```bash
git add src/lib/font-size.ts tests/font-size.test.ts
git commit -m "feat(ajustes): agrega lógica pura de escalas de tamaño de fuente"
```

---

### Task 2: Variables CSS con fallback en `globals.css`

**Files:**
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: los nombres de variable definidos en la Tarea 1 (`FONT_CATEGORY_VARS`) — deben coincidir exactamente: `--btn-font-size`, `--label-font-size`, `--chip-font-size`, `--eyebrow-font-size`, `--field-font-size`.
- Produces: nada consumido por código — esto es CSS puro que las Tareas 3/4 activan escribiendo esas variables en `<html>`.

- [ ] **Step 1: Agregar la variable con fallback a `.section-eyebrow`**

Reemplazar:

```css
.section-eyebrow {
  font-family: var(--font-body);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-stone);
}
```

por:

```css
.section-eyebrow {
  font-family: var(--font-body);
  font-size: var(--eyebrow-font-size, 0.72rem);
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-stone);
}
```

- [ ] **Step 2: Agregar la variable con fallback a `.btn`**

Reemplazar:

```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border-radius: var(--radius-soft);
  padding: 0.55rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  transition: background-color 150ms ease, color 150ms ease, border-color 150ms ease, opacity 150ms ease;
  cursor: pointer;
  border: 1px solid transparent;
  min-height: 40px;
}
```

por:

```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border-radius: var(--radius-soft);
  padding: 0.55rem 1rem;
  font-size: var(--btn-font-size, 0.875rem);
  font-weight: 500;
  transition: background-color 150ms ease, color 150ms ease, border-color 150ms ease, opacity 150ms ease;
  cursor: pointer;
  border: 1px solid transparent;
  min-height: 40px;
}
```

- [ ] **Step 3: Agregar la variable con fallback a `.input, .select, .textarea`**

Reemplazar:

```css
.input, .select, .textarea {
  width: 100%;
  background: var(--color-input-bg);
  border: 1px solid var(--color-sand);
  border-radius: var(--radius-soft);
  padding: 0.55rem 0.85rem;
  font-size: 0.9rem;
  color: var(--color-charcoal);
  min-height: 42px;
}
```

por:

```css
.input, .select, .textarea {
  width: 100%;
  background: var(--color-input-bg);
  border: 1px solid var(--color-sand);
  border-radius: var(--radius-soft);
  padding: 0.55rem 0.85rem;
  font-size: var(--field-font-size, 0.9rem);
  color: var(--color-charcoal);
  min-height: 42px;
}
```

- [ ] **Step 4: Agregar la variable con fallback a `.label`**

Reemplazar:

```css
.label {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-stone);
  margin-bottom: 0.3rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
```

por:

```css
.label {
  display: block;
  font-size: var(--label-font-size, 0.75rem);
  font-weight: 600;
  color: var(--color-stone);
  margin-bottom: 0.3rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
```

- [ ] **Step 5: Agregar la variable con fallback a `.chip`**

Reemplazar:

```css
.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  border-radius: 999px;
  padding: 0.15rem 0.6rem;
  font-size: 0.72rem;
  font-weight: 500;
  background: transparent;
  color: var(--color-stone);
  border: 1px solid var(--color-sand);
  white-space: nowrap;
}
```

por:

```css
.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  border-radius: 999px;
  padding: 0.15rem 0.6rem;
  font-size: var(--chip-font-size, 0.72rem);
  font-weight: 500;
  background: transparent;
  color: var(--color-stone);
  border: 1px solid var(--color-sand);
  white-space: nowrap;
}
```

- [ ] **Step 6: Correr la suite unitaria (no debería cambiar nada, pero confirma que no rompiste nada)**

Run: `npm run test:unit`
Expected: PASS — sin cambios, CSS no afecta la lógica pura.

- [ ] **Step 7: Verificación manual**

Run: `npm run dev`, abrir cualquier página con botones, campos de formulario, chips y etiquetas (p. ej. Ajustes mismo, o el modal de tarea).

Expected: **nada se ve distinto** — cada `var(--xxx, <valor original>)` cae en su fallback porque ninguna de esas variables está definida todavía en `<html>`. Este paso es puramente preparatorio.

- [ ] **Step 8: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(ajustes): agrega variables CSS de tamaño de fuente con fallback al valor actual"
```

---

### Task 3: Persistencia y aplicación (`src/components/shell/font-size.tsx`)

**Files:**
- Create: `src/components/shell/font-size.tsx`

**Interfaces:**
- Consumes: `computeFontSizeVars`, `DEFAULT_FONT_SIZE_PREFS`, `type FontSizePrefs` de `@/lib/font-size` (Tarea 1).
- Produces (usado por la Tarea 5): `readFontSizePrefs(): FontSizePrefs`, `applyFontSizes(prefs: FontSizePrefs): void`. Ambas exportadas desde `@/components/shell/font-size`.

- [ ] **Step 1: Crear el archivo**

```tsx
"use client";

import { computeFontSizeVars, DEFAULT_FONT_SIZE_PREFS, type FontSizePrefs } from "@/lib/font-size";

const STORAGE_KEY = "mafer-font-sizes";

/** Lee la preferencia guardada. Si no hay nada, está corrupta, o falta
 *  alguna categoría (versión vieja del formato), completa con "normal"
 *  — nunca lanza, nunca deja una categoría sin valor. */
export function readFontSizePrefs(): FontSizePrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FONT_SIZE_PREFS;
    const parsed = JSON.parse(raw) as Partial<FontSizePrefs>;
    return { ...DEFAULT_FONT_SIZE_PREFS, ...parsed };
  } catch {
    return DEFAULT_FONT_SIZE_PREFS;
  }
}

/** Guarda la preferencia y la aplica de inmediato en toda la app: al ser
 *  variables CSS puras en <html>, el cambio se refleja en cascada sin
 *  re-render de React en otros componentes. */
export function applyFontSizes(prefs: FontSizePrefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {}
  const vars = computeFontSizeVars(prefs);
  const html = document.documentElement;
  for (const [name, value] of Object.entries(vars)) {
    html.style.setProperty(name, value);
  }
}
```

- [ ] **Step 2: Verificación manual**

Run: `npm run test:unit` (debe seguir en verde — este archivo no tiene test propio, es DOM/localStorage puro, sin arnés de componentes en este proyecto).

Expected: PASS, sin cambios respecto a la Tarea 1.

- [ ] **Step 3: Commit**

```bash
git add src/components/shell/font-size.tsx
git commit -m "feat(ajustes): agrega lectura/aplicación de preferencias de tamaño de fuente"
```

---

### Task 4: Script inline anti-parpadeo + wiring en `layout.tsx`

**Files:**
- Create: `src/components/shell/font-size-script.ts`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: ninguna importación real (el script inline no puede importar módulos TS — ver nota abajo), pero sus valores literales DEBEN coincidir exactamente con `FONT_SIZE_SCALE` y `FONT_CATEGORY_VARS` de `src/lib/font-size.ts` (Tarea 1).
- Produces: `FONT_SIZE_INIT_SCRIPT: string`, inyectado en `src/app/layout.tsx`.

**Nota importante:** un `<script>` inline en el `<head>` no puede hacer `import` de un módulo — por eso este archivo reimplementa la tabla de variables/bases y los factores de escala como JavaScript plano embebido en un string, igual que `THEME_INIT_SCRIPT` ya reimplementa la lógica de resolución de tema en vez de llamar a `applyTheme`. Si algún día cambian las bases o los factores en `src/lib/font-size.ts`, este archivo debe actualizarse a mano en paralelo — está comentado para dejarlo claro.

- [ ] **Step 1: Crear el script inline**

```ts
/** Se ejecuta antes del primer render (inline en <head>) para evitar
 *  parpadeo/salto de tamaño al cargar. No puede importar TypeScript —
 *  reimplementa a mano las mismas bases y factores que
 *  src/lib/font-size.ts (FONT_SIZE_SCALE y FONT_CATEGORY_VARS).
 *  Si esos valores cambian ahí, actualizar aquí también. */
export const FONT_SIZE_INIT_SCRIPT = `(function(){try{var SCALE={pequeno:0.88,normal:1,grande:1.15};var VARS={titulos:[["--text-lg",1.125],["--text-xl",1.25],["--text-2xl",1.5],["--text-3xl",1.875]],botones:[["--btn-font-size",0.875]],cuerpo:[["--text-xs",0.75],["--text-sm",0.875],["--text-base",1]],etiquetas:[["--label-font-size",0.75],["--chip-font-size",0.72],["--eyebrow-font-size",0.72]],campos:[["--field-font-size",0.9]]};var raw=localStorage.getItem('mafer-font-sizes');var prefs=raw?JSON.parse(raw):{};var h=document.documentElement;for(var cat in VARS){var level=(prefs[cat]==='pequeno'||prefs[cat]==='grande')?prefs[cat]:'normal';var factor=SCALE[level];var list=VARS[cat];for(var i=0;i<list.length;i++){h.style.setProperty(list[i][0],(Math.round(list[i][1]*factor*1000)/1000)+'rem');}}}catch(e){}})();`;
```

- [ ] **Step 2: Inyectar el script en `layout.tsx`**

Agregar el import junto al de `THEME_INIT_SCRIPT`. Reemplazar:

```tsx
import { THEME_INIT_SCRIPT } from "@/components/shell/theme-script";
import { ThemeWatcher } from "@/components/shell/theme";
```

por:

```tsx
import { THEME_INIT_SCRIPT } from "@/components/shell/theme-script";
import { ThemeWatcher } from "@/components/shell/theme";
import { FONT_SIZE_INIT_SCRIPT } from "@/components/shell/font-size-script";
```

Reemplazar el `<head>`:

```tsx
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
```

por:

```tsx
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: FONT_SIZE_INIT_SCRIPT }} />
      </head>
```

- [ ] **Step 3: Verificación manual**

Run: `npm run dev`, abrir cualquier página, abrir las herramientas de desarrollo del navegador y en la consola correr:

```js
document.documentElement.style.getPropertyValue('--btn-font-size')
```

Expected: devuelve `"0.875rem"` (el valor por defecto, calculado por el script inline al cargar, aunque `localStorage` esté vacío — porque sin nada guardado usa `"normal"` para las 5 categorías, que es factor 1).

También: `npm run test:unit` sigue en verde (este archivo no tiene test — es JS plano embebido en un string, sin lógica TypeScript que testear con vitest).

- [ ] **Step 4: Commit**

```bash
git add src/components/shell/font-size-script.ts src/app/layout.tsx
git commit -m "feat(ajustes): aplica el tamaño de fuente guardado antes del primer pintado"
```

---

### Task 5: UI en Ajustes (`FontSizeSettings` + sección nueva)

**Files:**
- Create: `src/components/settings/font-size-settings.tsx`
- Modify: `src/app/(app)/ajustes/page.tsx`

**Interfaces:**
- Consumes: `FONT_SIZE_LEVELS`, `FONT_CATEGORY_LABEL`, `DEFAULT_FONT_SIZE_PREFS`, `type FontCategory`, `type FontLevel`, `type FontSizePrefs` de `@/lib/font-size` (Tarea 1); `readFontSizePrefs`, `applyFontSizes` de `@/components/shell/font-size` (Tarea 3).
- Produces: `FontSizeSettings` (componente, sin props), usado únicamente en `ajustes/page.tsx`.

- [ ] **Step 1: Crear `FontSizeSettings`**

```tsx
"use client";

import { useEffect, useState } from "react";
import {
  FONT_SIZE_LEVELS,
  FONT_CATEGORY_LABEL,
  DEFAULT_FONT_SIZE_PREFS,
  type FontCategory,
  type FontLevel,
  type FontSizePrefs,
} from "@/lib/font-size";
import { applyFontSizes, readFontSizePrefs } from "@/components/shell/font-size";

const LEVEL_LABEL: Record<FontLevel, string> = {
  pequeno: "Pequeño",
  normal: "Normal",
  grande: "Grande",
};

const CATEGORIES = Object.keys(FONT_CATEGORY_LABEL) as FontCategory[];

/** Ajustes → Tamaño de texto: 5 filas, una por categoría, cada una un
 *  segmented control Pequeño/Normal/Grande (mismo lenguaje visual que
 *  ThemeSelector). Lee localStorage solo en el cliente (useEffect) para
 *  no romper el render del servidor; antes de montar muestra "Normal"
 *  en las 5 sin parpadeo visible porque el script inline ya aplicó el
 *  tamaño real a nivel CSS antes de que React hidrate. */
export function FontSizeSettings() {
  const [prefs, setPrefs] = useState<FontSizePrefs>(DEFAULT_FONT_SIZE_PREFS);

  useEffect(() => {
    setPrefs(readFontSizePrefs());
  }, []);

  function setLevel(category: FontCategory, level: FontLevel) {
    const next = { ...prefs, [category]: level };
    setPrefs(next);
    applyFontSizes(next);
  }

  return (
    <div className="flex flex-col gap-3">
      {CATEGORIES.map((category) => (
        <div key={category} className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-charcoal">{FONT_CATEGORY_LABEL[category]}</p>
          <div
            role="radiogroup"
            aria-label={`Tamaño de ${FONT_CATEGORY_LABEL[category].toLowerCase()}`}
            className="inline-flex rounded-xl border border-sand bg-beige p-1 gap-1"
          >
            {FONT_SIZE_LEVELS.map((level) => {
              const active = prefs[category] === level;
              return (
                <button
                  key={level}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  data-testid={`font-size-${category}-${level}`}
                  onClick={() => setLevel(category, level)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    active ? "bg-forest text-cream" : "text-ink-green hover:bg-sand"
                  }`}
                >
                  {LEVEL_LABEL[level]}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Agregar la sección en Ajustes**

Agregar el ícono al import de `lucide-react` en `src/app/(app)/ajustes/page.tsx`. Reemplazar:

```tsx
import {
  Settings,
  CalendarDays,
  Smartphone,
  HardDriveDownload,
  Palette,
  FlaskConical,
  Volume2,
} from "lucide-react";
```

por:

```tsx
import {
  Settings,
  CalendarDays,
  Smartphone,
  HardDriveDownload,
  Palette,
  ALargeSmall,
  FlaskConical,
  Volume2,
} from "lucide-react";
```

Agregar el import del componente nuevo, junto a los demás imports de `@/components/settings/...`:

```tsx
import { FontSizeSettings } from "@/components/settings/font-size-settings";
```

Agregar la nueva sección justo después de la de Apariencia. Reemplazar:

```tsx
      {/* Apariencia */}
      <section className="card p-5 mb-5">
        <h2 className="section-eyebrow mb-1 flex items-center gap-2">
          <Palette size={13} className="text-sage-deep" aria-hidden /> Apariencia
        </h2>
        <p className="text-sm text-stone mb-3">
          «Automático» sigue la preferencia de tu Mac o iPhone: claro de día, oscuro de noche.
        </p>
        <ThemeSelector />
      </section>

      {/* Sonido del pomodoro */}
```

por:

```tsx
      {/* Apariencia */}
      <section className="card p-5 mb-5">
        <h2 className="section-eyebrow mb-1 flex items-center gap-2">
          <Palette size={13} className="text-sage-deep" aria-hidden /> Apariencia
        </h2>
        <p className="text-sm text-stone mb-3">
          «Automático» sigue la preferencia de tu Mac o iPhone: claro de día, oscuro de noche.
        </p>
        <ThemeSelector />
      </section>

      {/* Tamaño de texto */}
      <section className="card p-5 mb-5">
        <h2 className="section-eyebrow mb-1 flex items-center gap-2">
          <ALargeSmall size={13} className="text-sage-deep" aria-hidden /> Tamaño de texto
        </h2>
        <p className="text-sm text-stone mb-3">
          Ajusta el tamaño por tipo de texto. «Normal» es el tamaño de siempre — se guarda en este
          dispositivo, no viaja a otros.
        </p>
        <FontSizeSettings />
      </section>

      {/* Sonido del pomodoro */}
```

- [ ] **Step 3: Verificación manual**

Run: `npm run dev`, ir a Ajustes.

Expected:
- Nueva sección "Tamaño de texto" justo debajo de Apariencia, con 5 filas (Títulos, Botones, Texto de cuerpo, Etiquetas y chips, Campos de formulario), cada una con Pequeño/Normal/Grande.
- Al cargar la página por primera vez, todas están en "Normal" y nada se ve distinto al tamaño de siempre.
- Cambiar cualquier categoría a "Grande" o "Pequeño" cambia el tamaño correspondiente **en toda la app, al instante, sin recargar** — por ejemplo, "Botones" en Grande agranda los botones en Ajustes mismo; "Títulos" en Grande agranda encabezados en otras páginas (navegar a Hoy o Proyectos para confirmarlo).
- Recargar la página (F5): el tamaño elegido se mantiene, sin parpadeo perceptible al tamaño por defecto antes de aplicarse el guardado.
- Repetir en modo oscuro: mismo comportamiento, sin diferencias.
- Repetir en viewport móvil (o el iPhone real): mismo comportamiento.
- Confirmar la limitación conocida y aceptada: un botón que se ve chico porque tiene la clase `text-xs` de Tailwind (por ejemplo el botón "Enfocar esta tarea" del modal de tarea) escala con "Texto de cuerpo", no con "Botones" — esto es esperado, no un bug.

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/font-size-settings.tsx "src/app/(app)/ajustes/page.tsx"
git commit -m "feat(ajustes): agrega la sección Tamaño de texto"
```

---

## Self-Review

**Cobertura del spec:** las 5 categorías con sus variables/bases exactas → Tarea 1 (constantes) + Tarea 2 (CSS). Los 3 escalones (0.88/1/1.15) → Tarea 1, verificados por test. Aplicación en vivo sin re-render de React → Tarea 3 (`applyFontSizes` escribe variables CSS directo en `<html>`). Sin parpadeo al cargar → Tarea 4 (script inline, mismo mecanismo que el tema). UI de 5 filas con segmented control → Tarea 5. Persistencia solo en `localStorage` → Tarea 3. La limitación conocida (botones con `text-xs` escalan con Cuerpo) es un efecto esperado de cómo Tailwind expone `--text-xs`/`--text-sm`, documentado en el spec y verificado explícitamente en la Tarea 5. Sin huecos.

**Placeholders:** ninguno — cada paso trae el código completo, incluyendo los 12 valores exactos de `computeFontSizeVars` (verificados con Node antes de escribir el test, no calculados a mano, para evitar errores de redondeo de punto flotante).

**Consistencia de tipos:** `FontSizePrefs`/`FontCategory`/`FontLevel` se definen una sola vez en la Tarea 1 y se importan sin redeclarar en las Tareas 3 y 5. Los nombres de variable CSS (`--btn-font-size`, `--label-font-size`, `--chip-font-size`, `--eyebrow-font-size`, `--field-font-size`) son idénticos entre `FONT_CATEGORY_VARS` (Tarea 1), `globals.css` (Tarea 2) y el script inline (Tarea 4) — la Tarea 4 documenta explícitamente que su duplicación de valores es intencional y debe mantenerse en sync a mano, igual que ya ocurre con `THEME_INIT_SCRIPT`.
