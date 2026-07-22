# Tamaño de fuente configurable en Ajustes — diseño

## Problema

Hoy no existe ningún control de tamaño de fuente en Mafer OS. Los tamaños de
texto viven repartidos en dos lugares: clases centralizadas en
`src/app/globals.css` (`.btn`, `.input`/`.select`/`.textarea`, `.label`,
`.chip`, `.section-eyebrow`) y clases de utilidad de Tailwind puestas
directo en cada componente (`text-xs`…`text-3xl`), sobre todo para títulos
(`h1`/`h2`/`h3`/`.font-display` en `globals.css` solo define
`font-family`/`font-weight`/`letter-spacing`, no tamaño).

## Alcance

Agregar a Ajustes (`src/app/(app)/ajustes/page.tsx`) una nueva sección
"Tamaño de texto", junto a Apariencia, con control independiente por
categoría (no un slider único global).

## Categorías y qué escala cada una

Todas parten de 100% = el tamaño que ya existe hoy (sin cambio visual con
"Normal").

| Categoría | Qué escala | Variables CSS (nuevas salvo las de Tailwind) | Base actual |
|---|---|---|---|
| Títulos | `h1`/`h2`/`h3`/`.font-display` (vía clases `text-lg`/`xl`/`2xl`/`3xl` de Tailwind) | `--text-lg`, `--text-xl`, `--text-2xl`, `--text-3xl` (ya globales, Tailwind v4) | 1.125 / 1.25 / 1.5 / 1.875 rem |
| Botones | `.btn` | `--btn-font-size` (nueva) | 0.875rem |
| Texto de cuerpo | Texto general (vía clases `text-xs`/`sm`/`base` de Tailwind) | `--text-xs`, `--text-sm`, `--text-base` (ya globales, Tailwind v4) | 0.75 / 0.875 / 1 rem |
| Etiquetas y chips | `.label`, `.chip`, `.section-eyebrow` | `--label-font-size`, `--chip-font-size`, `--eyebrow-font-size` (nuevas) | 0.75 / 0.72 / 0.72 rem |
| Campos de formulario | `.input`, `.select`, `.textarea` | `--field-font-size` (nueva) | 0.9rem |

**Escalones:** Pequeño ×0.88, Normal ×1, Grande ×1.15 — los mismos tres
factores para las 5 categorías.

**Limitación conocida y aceptada:** botones que se achican con la clase
`text-xs`/`text-sm` de Tailwind (no con el tamaño base de `.btn`) escalan
junto con "Texto de cuerpo", no con "Botones", porque comparten la misma
variable de Tailwind. Los botones de tamaño normal (sin ese override) sí
escalan correctamente con "Botones". Se acepta esta inconsistencia a
cambio de no tener que refactorizar ~200 usos de clases `text-*` por toda
la app.

## Mecanismo técnico

Se apoya en que Tailwind v4 ya compila sus utilidades de tamaño como
variables CSS globales sobreescribibles (confirmado en el CSS compilado
del proyecto: `.text-2xl{font-size:var(--text-2xl)}`), así que las
categorías de Títulos y Texto de cuerpo no requieren tocar ningún
componente — solo sobreescribir esas variables. Para Botones, Etiquetas y
chips, y Campos de formulario, se agregan variables CSS propias en las
reglas correspondientes de `globals.css` (con el valor actual como
fallback, por si el script de aplicación no llegó a correr).

No hace falta sincronización entre componentes vía React (a diferencia del
tema claro/oscuro): al ser variables CSS puras en `<html>`, el cambio se
refleja en cascada en toda la app apenas se actualizan, sin re-render
explícito.

- **`src/lib/font-size.ts`** — lógica pura y testeable, sin DOM ni
  localStorage (mismo estilo que `focus-logic.ts`):
  - `FONT_SIZE_SCALE: Record<"pequeno" | "normal" | "grande", number>` =
    `{ pequeno: 0.88, normal: 1, grande: 1.15 }`.
  - Mapa de categoría → lista de `{ cssVar, baseRem }` con los valores base
    de la tabla de arriba.
  - `computeFontSizeVars(prefs: Record<FontCategory, FontLevel>): Record<string, string>`
    — dado un nivel por categoría, devuelve el valor final
    (`baseRem * factor`, en rem) para cada variable CSS. Función pura,
    testeable sin mockear nada.
- **`src/components/shell/font-size.tsx`** — `applyFontSizes(prefs)`:
  guarda `prefs` en `localStorage("mafer-font-sizes")` (try/catch, igual
  que `applyTheme`) y aplica `document.documentElement.style.setProperty(...)`
  por cada variable calculada con `computeFontSizeVars`.
- **`src/components/shell/font-size-script.ts`** — script inline (mismo
  mecanismo que `THEME_INIT_SCRIPT`), inyectado en el `<head>` de
  `src/app/layout.tsx` junto al de tema, para que el tamaño correcto se
  aplique antes del primer pintado (sin parpadeo ni salto al cargar).
- **`globals.css`** — `.btn`, `.label`, `.chip`, `.section-eyebrow`,
  `.input`/`.select`/`.textarea` pasan de `font-size: <valor fijo>` a
  `font-size: var(--xxx-font-size, <mismo valor fijo>)`. El fallback
  asegura que sin JS (o antes de que el script corra) se ve exactamente
  igual que hoy.
- **`src/components/settings/font-size-settings.tsx`** — 5 filas
  (una por categoría) con segmented control Pequeño/Normal/Grande, mismo
  lenguaje visual que `ThemeSelector`. Lee el estado inicial de
  `localStorage` al montar (default `"normal"` en las 5 si no hay nada
  guardado) y llama `applyFontSizes` en cada cambio.

Persistencia: solo `localStorage`, igual que el tema — no viaja entre
dispositivos. Si Jorge usa Mafer OS en computadora y iPhone, cada uno
mantiene su propio tamaño.

## Fuera de alcance

Guardar la preferencia en base de datos (para que viaje entre
dispositivos), más de 3 escalones por categoría, categorías adicionales a
las 5 listadas, cualquier cambio a layout o breakpoints existentes, modos
claro/oscuro (el tamaño de fuente es ortogonal al tema y debe funcionar
igual en ambos).

## Testing

- Unitarios en `tests/font-size.test.ts` para `computeFontSizeVars` y los
  factores de escala (mismo estilo que `tests/focus-logic.test.ts`).
- Manual en `npm run dev`: cambiar cada una de las 5 categorías y
  confirmar el cambio en vivo sin recargar; recargar la página y confirmar
  que persiste sin parpadeo; revisar en claro y oscuro; revisar en
  viewport móvil. No se usa el e2e completo como señal (gap conocido de
  base real, documentado en el spec de modal de tareas).
