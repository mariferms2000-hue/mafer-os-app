# QA — Fase 4A: página Tareas simplificada (dos niveles)

Fecha: 2026-07-14 · Base de pruebas temporal; la BD real no se toca en pruebas.

## Antes → Después

**Antes** (ver `docs/qa/phase-2/03-filtros-avanzados.png`): dos filas llenas de chips
siempre visibles — 7 filtros de estado («Abiertas», «≤ 30 min», «Bloqueadas»,
«Esperando», «Con fecha», «Terminadas», «Archivadas») + 6 agrupaciones («Proyecto ·
Estado · Fecha · Duración · Prioridad · Energía») + «Más filtros», y la lista siempre
agrupada en contenedores grandes por proyecto. Muchas decisiones antes de ver nada.

**Después** (`01-haz-ahora.png`): encabezado de dos niveles —
`[ Buscar tareas… ] [ Filtrar ] [ Agrupar ]` + «Nueva tarea» siempre visible — y
**cinco vistas rápidas**: «Haz ahora» (predeterminada), «Hoy», «≤ 30 min»,
«Esperando», «Todas», más «Más vistas». Una sola lista ordenada, sin contenedores
gigantes, que contesta «¿qué puedo hacer ahora?» sin configurar nada.

## Qué se eliminó de la vista permanente

- Los 7 chips de filtro de estado (Terminadas y Archivadas ahora viven en «Más
  vistas», en el pie discreto y como toggles del panel Filtrar).
- Los 6 chips de agrupación permanentes.
- El bloque «Más filtros» con los filtros de clasificación.
- La agrupación por proyecto como default (ahora: sin agrupar, lista única).

## Qué quedó dentro de Filtrar (panel lateral / bottom sheet)

Proyecto (incluye «Sin proyecto»), Estado (las 7 listas), Fecha (vence hoy /
vencidas / próximos 7 días / con / sin), Duración (los 4 rangos + «Sin duración»),
Energía (baja/media/alta + «Sin energía»), Prioridad, y los toggles Bloqueadas,
Sin estimar, Terminadas y Archivadas. **Los filtros se combinan**, con Aplicar /
Limpiar / Cancelar. El botón muestra el contador («Filtrar (2)») y arriba solo
queda el resumen compacto («Filtros activos: 10–30 min · Energía baja» + Limpiar).

## Qué quedó dentro de Agrupar

Menú de una sola elección: Sin agrupar (default) · Por proyecto · Por estado ·
Por fecha · Por duración · Por prioridad · Por energía. El botón refleja la
selección («Por proyecto»).

## Vistas

| Vista | Contenido |
| --- | --- |
| **Haz ahora** (default) | El motor de recomendación de Hoy ordena lo accionable (excluye bloqueadas, esperando, pospuestas, terminadas, archivadas); hasta 15 con enlace «Ver todas» |
| Hoy | Prioridades del día (en su orden) → vencidas → vence hoy |
| ≤ 30 min | Solo `<10` y `10–30`, accionables |
| Esperando | En espera de alguien |
| Todas | Abiertas (sin agrupar por defecto) |
| Más vistas | Baja energía, Trabajo profundo, Bloqueadas, Sin clasificar, Sin proyecto, Terminadas, Archivadas — con ⭐ para fijar 1–2 favoritas junto a las principales |

## Persistencia

Todo el estado vive en la URL (`v`, `q`, filtros, `agrupar`): sobrevive al refresh,
a abrir una tarea y volver (el detalle solo añade `?abrir=`, el scroll no se pierde
porque es un modal), y a navegar entre secciones (la barra lateral recuerda la URL).
Los enlaces antiguos `?f=…` siguen funcionando (se interpretan sin redirigir).

## Capturas

`01-haz-ahora.png` · `02-panel-filtrar.png` · `03-resumen-filtros.png` ·
`04-menu-agrupar.png` · `05-tareas-iphone.png` · `06-tareas-oscuro.png`
