# Fase 6B — Refinamiento visual del modo oscuro (carbón + marcos vivos)

**Fecha:** 2026-07-16 · **Base:** commit `31e0760` (Fase 6A aprobada) · **Alcance:** solo visual/UX visual, cero lógica de negocio.

## Auditoría que originó la fase

Contra las referencias de `visual-references/phase-6` (Manus target dark, Serenity Flow), la app tras 6A tenía:

- **Superficies lodosas:** la separación de niveles se lograba rellenando cada tarjeta con un verde-oliva más claro (`#1a2117`, `#212a1e`), no con luz.
- **Todo del mismo peso:** hero, revisiones y alertas eran cajas idénticas; sin punto focal.
- **Ruido de chips:** píldoras rellenas para cada metadato.
- **Varios botones compitiendo** en el hero.
- **Cero elementos visuales:** solo texto en cajas.

## Decisiones aprobadas por Mafer

1. **Fondo:** carbón casi negro con tinte verde mínimo; sidebar aún más profunda; el verde solo para acentos/selección. Separación por hairlines, marcos, luz y sombra — no por relleno.
2. **Encabezados internos:** sistema de eyebrows (sans, mayúsculas, tracking). Títulos de página siguen en serif; nombres propios conservan su jerarquía; los títulos de modales se mantienen en serif a propósito (actúan como título de página del diálogo).
3. **Marco vivo:** borde salvia perceptible + doble anillo + halo elegante, reservado a 1–2 elementos por pantalla.
4. **Más visual:** ritmo de hoy, ruta de proyecto, progreso luminoso, planta adulta en sidebar, estados vacíos botánicos — todo vinculado a datos reales, nada inventado.
5. **Biblioteca:** limpieza visual básica (respiración, 2 columnas, código con contraste, advertencia como componente).
6. **Fuera de alcance (fase posterior):** Focus Garden, temporizador, crecimiento persistente, notificaciones, modo claro completo.

## Qué cambió

### P1 — Sistema base (`src/app/globals.css`)
- Nueva escala carbón: fondo `#0d100c` · sidebar `#0a0c08` · tarjeta `#151a13` · elevado `#1c2318` (tres niveles reales, desaturados).
- Bordes en 3 pesos desaturados (`#232a1f` / `#2e3728` / `#4f5c45`); verdes de identidad solo como acento (`sage-deep #9fbe8e`, enlaces `#a5c793`, títulos `#d3e2c1`).
- **Marco vivo** (`.glow-focus`): anillo salvia nítido + segundo anillo suave + brillo interior + halo exterior. Usos: «Haz esto ahora» y el día de hoy en Calendario.
- Tarjetas con «luz de canto» (inset 1px crema al 4%) en vez de relleno claro.
- **Dieta de chips** (solo oscuro): metadatos = texto tenue con hairline transparente; los chips de estado (vencida/bloqueada/esperando/hecha) conservan tinte.
- Un solo CTA luminoso por zona: en el hero, «La terminé» es primario; «Abrir tarea» y «Prioridad de hoy» pasan a fantasma.
- Eyebrows en encabezados internos de Hoy, Revisiones, Ajustes, Buscar, Biblioteca, Calendario, Explorar.
- Toast sobre carbón elevado `#1e2619`; overlay más profundo; progreso luminoso con gradiente + brillo discreto.
- Token nuevo `--color-code-bg` para bloques de comando (claro: arena; oscuro: un paso más profundo que la tarjeta).

### P2 — Pantallas
- **Hoy:** hero centrado estilo referencia (eyebrow → título serif grande → separador con rombo → metadatos → porqué → CTA); **«Ritmo de hoy»** (`src/components/hoy/rhythm.tsx`): 3 nodos con datos reales — prioridades elegidas (n/3), completadas del día, revisión diaria hecha/pendiente.
- **Proyectos:** tarjeta con **ruta visual** (nodo de estado → siguiente acción → próxima fecha, conectados por hairline), conteos como texto tenue, progreso luminoso.
- **Calendario:** rejilla hairline, días de la semana en eyebrow, **hoy con marco vivo** (único glow de la pantalla).
- **Tareas:** hereda la dieta de chips (filas mucho más ligeras).
- **Biblioteca:** flujos a 2 columnas con pasos conectados por línea vertical, numeración en anillo, comandos en bloque profundo con borde, advertencia como caja con icono, enlaces con flecha.
- **Sidebar:** planta adulta lineal nueva (tallo con hojas alternas y línea de tierra, opacidad 55%).
- **Estados vacíos:** variantes botánicas discretas — semilla (Proyectos vacío), brote (Hoy vacío), rama (resto).

### Sin tocar
Lógica de negocio, queries (solo lectura reutilizada en Rhythm), estructura de datos, Google Calendar, PWA, login, paleta del modo claro (hereda solo la nueva composición del hero/eyebrows, verificado sin regresiones de contraste).

## Verificación

| Prueba | Resultado |
|---|---|
| ESLint | 0 errores (1 warning preexistente en `scripts/seed.mjs`) |
| TypeScript (`tsc --noEmit`) | limpio |
| Build de producción | ✓ |
| Unitarias (incl. 43 de contraste WCAG) | **96/96** |
| E2E Chrome/WebKit/iPhone/iPad | **138/138** |
| Modo claro | AA/AAA intactos, capturas 10–11 |

Valores esperados actualizados en `tests/` y `e2e/` (tokens carbón, toast, meta `theme-color` → `#0d100c`).

## Capturas

1. `01-hoy-oscuro` · 2. `02-tareas-oscuro` · 3. `03-proyectos-oscuro` · 4. `04-calendario-oscuro` · 5. `05-biblioteca-oscuro` · 6. `06-modal-oscuro` · 7. `07-toast-oscuro` · 8. `08-vacio-oscuro` · 9. `09-iphone-oscuro` · 10. `10-hoy-claro-comparacion` · 11. `11-biblioteca-claro-comparacion` · `checkpoint-p1/` (comprobación intermedia tras P1).
