# Fase 6C — Refinamiento visual del modo claro (marfil limpio + marco vivo en claro)

**Fecha:** 2026-07-16 · **Base:** commit `9c28573` (Fase 6B aprobada) · **Alcance:** solo tema claro; el modo oscuro aprobado quedó intacto (capturas de regresión 07–08).

## Auditoría que originó la fase

- Fondo (`#faf7f1`) y tarjetas (`#fdfcf8`) casi idénticos → plano y pálido; todo demasiado beige/amarillo.
- `--shadow-glow` era un alias de `shadow-lift` en claro → el Marco vivo no existía (solo un borde verde).
- Chips con relleno beige en claro (la dieta de 6B solo aplicaba en oscuro).
- `stone` 4.4:1 y `stone-soft` ~2.6:1 — por debajo de AA; el propio test tenía pisos rebajados con nota pendiente.
- Calendario: rejilla casi invisible, hoy sin protagonismo, filtros todos del mismo peso.
- Biblioteca: código y advertencias eran el mismo beige.

## Qué cambió (todo en tokens/clases del tema claro)

`src/app/globals.css` — bloque `@theme` (el bloque `html[data-theme="dark"]` no se tocó):

- **Marfil limpio:** fondo `#faf7f1` → `#f7f4ee` (menos amarillo); tarjetas → `#fffefb` (casi blancas); elevado `#fffefc`; sidebar diferenciada `#f1ede3`; `beige/sand/sand-deep` con menos amarillo.
- **Hairlines visibles:** `card-border` `#ece3d3` → `#e5ddcb`; sombras suaves apenas más presentes (siguen discretas).
- **Marco vivo propio del claro** (aclaración aprobada: perceptible y premium, no tímido): anillo salvia 1.5px al 65% + segundo anillo suave + halo verdoso sutil + sombra de profundidad. Mismo uso limitado que en oscuro: hero de Hoy y día actual del Calendario.
- **Dieta de chips en ambos temas:** el `.chip` base pasa a fantasma (transparente + hairline + texto piedra); los chips de estado conservan su tinte. Filtros de Calendario/Tareas dejan de competir; solo el activo lleva verde oscuro.
- **Texto secundario legible:** `stone` → `#6e675a`, `stone-soft` → `#97907e`, chip alterno oliva → `#5d6a45`. Pisos del test de contraste claro subidos a los mismos AA estrictos del oscuro (4.5/3/4.5) — ya no hay excepciones.
- **Superficie técnica:** `--color-code-bg` claro → `#f0efe8` (marfil-gris frío) — código ≠ advertencia (ámbar) ≠ contenido.
- Sincronizados `theme-color`/manifest/layout/global-error al nuevo marfil `#f7f4ee`.

Calendario y Biblioteca no necesitaron cambios de markup: los tokens resolvieron rejilla, protagonismo de hoy, píldoras y separación de bloques.

## Verificación

| Prueba | Resultado |
|---|---|
| ESLint | 0 errores (1 warning preexistente en `scripts/seed.mjs`) |
| TypeScript | limpio |
| Build de producción | ✓ |
| Unitarias (43 contraste WCAG, claro ahora AA estricto) | **96/96** |
| E2E Chrome/WebKit/iPhone/iPad | **138/138** |
| Regresión modo oscuro | idéntico al aprobado (capturas 07–08) |

Ajustes de pruebas: `LIGHT_BG` y tarjeta clara en `z11` (con el selector corregido a tarjeta normal, pues el primer `.card` de Hoy es el hero elevado), tono claro del toast sin cambios.

## Capturas

`01-hoy-claro` · `02-calendario-claro` · `03-biblioteca-claro` · `04-proyectos-claro` · `05-tareas-claro` · `06-modal-claro` · `07-hoy-oscuro-regresion` · `08-biblioteca-oscuro-regresion`
