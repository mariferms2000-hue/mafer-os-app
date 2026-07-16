# Auditoría del modo oscuro — Fase 6A (antes de modificar)

Base: commit `607284a`, árbol limpio. Todo el tema vive en `src/app/globals.css`
(un bloque `@theme` con ~30 tokens y un override `html[data-theme="dark"]`).

## 1. Diagnóstico del problema (captura oscura actual)

- **Sin profundidad**: fondo `#171c15` vs superficie `#1f2519` — la diferencia de
  luminancia es mínima; tarjetas, sidebar y fondo se funden en un solo bloque
  verde lodoso. No existen niveles 2/3: modales, «Haz esto ahora» y tarjetas
  normales usan la misma superficie.
- **Todo pesa igual**: `btn-primary` en oscuro queda verde medio apagado sobre
  verde oscuro; la acción principal no destaca sobre los botones secundarios.
- **Texto secundario demasiado oscuro**: `--color-stone-soft: #7f7a6e` sobre
  `#1f2519` ≈ 3.1:1 (timestamps, hints y placeholders casi ilegibles);
  `--color-stone: #aaa496` ronda 5.6:1, justo.
- **Chips activos rotos en oscuro**: 11 componentes usan el patrón
  `!bg-forest !text-cream !border-forest` (+3 con `!bg-olive !text-cream`). En
  oscuro `forest` se vuelve verde claro (#9dbb8d) y `cream` casi negro… la
  utilidad de Tailwind congela texto crema-oscuro sobre fondo claro → contraste
  ≈ 2:1. Afecta: vistas rápidas de Tareas, filtros, energía del día, chips de
  duración/energía, proyectos, calendario y toolbar.
- **Sombras invisibles**: las tarjetas dependen solo del borde; no hay jerarquía
  de elevación ni glow de foco.

## 2. Inventario de tokens y componentes de tema

- Tokens: paleta (`cream/paper/beige/sand/sand-deep/sage*/olive/forest*/stone*/charcoal/ink-green`),
  estados (`blocked/waiting/done` + soft), toasts (8 tokens), sombras, radios, fuentes.
- Clases de componentes en CSS: `.card`, `.btn(-primary/secondary/ghost/danger)`,
  `.input/.select/.textarea`, `.chip(-blocked/-waiting/-done/-sage)`, `.label`,
  `.section-eyebrow`, `.intro-italic`, `.progress-track/fill`, foco global, scrollbars.
- Cambio de tema: `theme-script.ts` inline anti-flash (funciona) + `theme.tsx`
  (claro/oscuro/auto con persistencia). `viewport.themeColor` está fijo en
  `#faf7f1` en `layout.tsx`; el script lo reescribe con un dark `#1e231b` viejo.

## 3. Colores hardcodeados encontrados

| Dónde | Qué | Riesgo en oscuro |
| --- | --- | --- |
| `task-detail.tsx` | checkbox `accent-[#45573f]` | innecesario: ya hay `accent-color` global tokenizada |
| `agent-diagram.tsx` | ~10 fills/strokes light (`#fdfcf8`, `#dde5d6`, `#324230`…) | nodos casi blancos dentro del tema oscuro |
| `nav.tsx` (logo SVG) | 4 colores de la marca | aceptable (marca), se revisa visualmente |
| `theme.tsx` / `theme-script.ts` | meta theme-color `#1e231b` | desactualizado respecto al nuevo fondo |
| Toasts | ya tokenizados desde la fase 3 ✔ | — |

Sin `bg-white`, `text-white` ni `bg-black` en componentes ✔.

## 4. Contraste actual (oscuro) — pares problemáticos

- `stone-soft` (#7f7a6e) sobre `paper` ≈ **3.1:1** → hints/timestamps/labels débiles.
- Chip activo (`cream` #171c15 sobre `forest` #9dbb8d) ≈ **2.2:1** → ilegible.
- `btn-primary` (#9dbb8d de fondo… no: fondo `forest` #9dbb8d + texto `cream`
  #171c15 en oscuro) ≈ 8:1 pero **visualmente igual** a un chip — sin jerarquía.
- Fondo vs superficie: Δ luminancia ~1.3% → sin profundidad.
- Modales/paneles: misma superficie que las tarjetas → se pierden sobre el overlay.

## 5. Componentes sin tokens globales

- `agent-diagram.tsx` (SVG con colores fijos) — único componente realmente fuera
  del sistema. El resto consume utilidades Tailwind → tokens.
- Patrón repetido de chip activo con utilidades `!important` (11+3 archivos):
  funcionalmente tokenizado pero **semánticamente roto** (congela una combinación
  pensada para claro). Se reemplaza por clases `chip-on` / `chip-on-alt`.

## 6. Plan derivado

1. Sistema semántico nuevo en `@theme` (fondos por nivel, sidebar, raised,
   overlay, input, bordes 3 pesos + focus, acción primaria bg/fg/hover, chip
   activo, selección, glow, estados) con valores claros = apariencia actual y
   oscuros re-diseñados (bosque casi negro `#10150e` → superficies `#1a2117` →
   elevado `#212a1e`).
2. Clases nuevas: `.card-raised` (nivel 3), `.chip-on/.chip-on-alt`,
   `.sidebar-surface`, `.glow-focus`; retune de `.btn-*`, inputs, selección,
   sombras y nav activa (acento lateral solo en oscuro).
3. Reemplazo de los 14 usos del patrón de chip activo; checkbox y diagrama a
   tokens; meta theme-color sincronizada.
4. Prueba unitaria de contraste automatizada (parsea los tokens del CSS y
   calcula WCAG) + suite E2E oscura con capturas.
