# Fase 6A — Sistema visual del modo oscuro · Reporte QA

Fecha: 15 de julio de 2026 · Auditoría previa: [audit.md](./audit.md)

## 1. Paleta oscura nueva (dirección: bosque nocturno editorial)

Tres niveles de profundidad reales, sin negro puro y sin blanco puro:

| Nivel | Token | Valor | Uso |
|---|---|---|---|
| Fondo (N1) | `--color-cream` | `#10150e` | fondo de página, bosque casi negro |
| Sidebar | `--color-sidebar` | `#0d120c` | navegación lateral/inferior, un paso más profunda que el fondo |
| Superficie (N2) | `--color-paper` | `#1a2117` | tarjetas y paneles |
| Elevado (N3) | `--color-raised` | `#212a1e` | modales, «Haz esto ahora», diálogos críticos |

Texto en tres pesos: principal `#f1ebdb` (crema cálido, 13.8:1 sobre superficie), secundario `#b7b2a2` (7.8:1), tenue `#948e7d` (5.0:1). Títulos fuertes `#d0dfbb`, enlaces `#abc897`.

Acción primaria invertida a propósito: en oscuro el botón primario y los chips activos usan **verde luminoso con texto casi negro** (`#a9c79a`/`#131a0e`, 9.9:1) para que lo importante brille sin gritar. El glow discreto (`--shadow-glow`) queda reservado a «Haz esto ahora».

## 2. Tokens semánticos añadidos (capa compartida claro/oscuro)

`sidebar, raised, surface-hover, input-bg, overlay, border-strong, border-focus, link, btn-primary-bg/fg/hover, chip-on-bg/fg, chip-on-alt-bg/fg, selection-bg/fg, shadow-glow` — con valores claros idénticos a la apariencia aprobada (el refinamiento claro es Fase 6B).

Clases nuevas: `.card-raised` (nivel 3), `.overlay-screen` (velo de modales con token propio), `.chip-on` / `.chip-on-alt` (activo legible en ambos temas), `.sidebar-surface`, `.glow-focus`, y acento lateral `nav-active` (solo visible en oscuro).

## 3. Componentes corregidos

- **14 patrones de chip activo rotos** (`!bg-forest !text-cream…` ≈2:1 en oscuro) → `.chip-on`/`.chip-on-alt` en vistas rápidas, filtros de proyectos, selector de energía, chips de estimación, detalle de tarea, toolbar, favoritos de journal/prompts/recursos, calendario, etc.
- **15 velos de modal** usaban `bg-charcoal/30-40` (en oscuro charcoal es claro → velo lechoso) → `.overlay-screen` con `--color-overlay`.
- **14 diálogos** (`role="dialog"`) elevados a `.card-raised`.
- **Sidebar y barra inferior** con superficie propia (`.sidebar-surface`) + ítem activo con acento lateral en oscuro.
- **«Haz esto ahora»** en nivel 3 con glow discreto.
- **Checkbox** con hex fijo eliminado; **diagrama de agentes** (SVG) tokenizado con `var(--color-*)` — 12 colores fijos fuera.
- **Meta theme-color** oscuro sincronizado (`#10150e`) en `theme-script.ts` y `theme.tsx`; el claro no cambia.
- Inputs sobre `--color-input-bg`, foco con `--color-border-focus`, selección de texto con par propio, sombras oscuras reales.

## 4. Contraste (automatizado)

`tests/contrast.test.ts` parsea los tokens de `globals.css` y calcula ratios WCAG en ambos temas (43 pruebas): texto principal ≥7 (AAA) en los tres niveles, secundario ≥4.5, tenue ≥3, botón primario/chips activos/toast ≥4.5, jerarquía de profundidad y de texto verificadas, sin negro/blanco puros.

Limitación documentada (pre-existente, va en Fase 6B): en **claro**, `stone` (4.4:1) y el chip alterno oliva (4.2:1) conservan la apariencia aprobada; la prueba fija un piso para que no empeoren.

## 5. Pruebas

- Unitarias: 96/96 (53 previas + 43 de contraste).
- E2E nuevas: `z11-fase6a-dark.spec.ts` (barrido oscuro de 7 secciones, 3 niveles de profundidad, sidebar, chips activos, apertura directa en oscuro sin flash + meta theme-color, modo automático + refresh, detalle de tarea, claro intacto + iPad) · prueba oscura en `safari-board.spec.ts` (WebKit) · prueba oscura en `mobile.spec.ts` (iPhone).
- Capturas en esta carpeta: 01–08 secciones en oscuro, 09 comparación en claro, 10 iPad, 11 iPhone, 12 Safari.

## 6. Sin cambios funcionales

Solo estilos, clases y tokens; ninguna acción, ruta, texto funcional ni estructura cambió. El modo claro conserva exactamente sus colores (verificado por prueba E2E y por los tokens: los valores claros nuevos replican la apariencia actual).
