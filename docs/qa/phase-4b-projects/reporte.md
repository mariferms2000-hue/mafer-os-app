# QA — Fase 4B: Proyectos y Retomar proyecto

Fecha: 2026-07-14 · Base de pruebas temporal; la BD real no se toca en pruebas.

## Antes → Después de las tarjetas

**Antes**: icono + nombre + objetivo + texto de próxima acción (si existía) + barra con
**porcentaje** («57 %») + chips de estado/salud/abiertas/bloqueadas/meta.

**Después**, en este orden: 1) nombre · 2) **siguiente acción concreta** (tarea real
vinculada; si falta: «Falta definir la siguiente acción.») · 3) estado · 4) N abiertas ·
5) bloqueo/espera solo si existe · 6) fecha relevante más próxima (fecha límite abierta
más cercana o la meta) · 7) última actividad humana («Hoy», «Ayer», «Hace 5 días»,
«14 jul 2026») · **máximo 2 alertas**, la más urgente con mayor jerarquía (roja, la
segunda ámbar). Progreso honesto: «4/7 tareas» con barra etiquetada como *tareas
completadas* — nunca un % que finja medir el proyecto.

## Necesitan atención — cómo se calcula (`src/lib/project-health.ts`)

Solo proyectos **activos** (ni terminados, ni archivados, ni pausados), con problemas,
ordenados por urgencia del problema principal:

| # | Problema | Umbral |
| --- | --- | --- |
| 1 | Tiene tarea vencida | fecha < hoy |
| 2 | Bloqueado | tareas en Bloqueado o con razón de bloqueo |
| 3 | Esperando demasiado | espera más antigua ≥ 7 días |
| 4 | Sin siguiente acción | sin tarea vinculada viva ni texto (incluye «se completó — elige otra») |
| 5 | Sin actividad reciente | ≥ 14 días sin actividad significativa |

Cada tarjeta explica por qué está ahí (las alertas visibles). Los mismos umbrales
alimentan las alertas antiolvido de Hoy.

## Siguiente acción como tarea real

- Nueva columna `projects.next_action_card_id` (migración drizzle 0003). El texto
  heredado se conserva como respaldo hasta que se vincula una tarea.
- Elegir una tarea existente del proyecto, crear una nueva (nace en «Próximo»),
  cambiarla, quitarla, abrirla o marcarla como prioridad de Hoy — siempre con
  confirmación de Mafer, **nunca se elige una automáticamente**.
- Al completarla: el proyecto avisa «“X” se completó ✓ — necesita nueva siguiente
  acción» con botón «Elegir siguiente acción».
- En el tablero, la tarjeta vinculada lleva la marca discreta «→ Siguiente acción».
- Al crear un proyecto, la «siguiente acción (opcional)» ya nace como tarea real.

## Retomar proyecto

Resumen compacto sin secciones vacías: objetivo · estado actual · **dónde me quedé**
(transparente: tarea en proceso → «Estabas trabajando en…»; si no, última completada;
si no hay datos: «No hay suficiente actividad registrada…» con sugerencias) · última
actividad humana · última decisión · en proceso ahora · bloqueos · esperando a ·
próximas fechas · prompts/recursos/enlaces vinculados · **«Contexto para retomar»**
(nota manual editable, guardada en el proyecto, cuenta como actividad). Cierra con
**«Continuar con: [tarea]»** y botones Abrir tarea / Marcar como prioridad / Ver
tablero / Editar siguiente acción — o «Definir siguiente acción» si no hay.

## Última actividad significativa

Máximo entre: cambios del proyecto (siguiente acción, nota de contexto, edición),
`updatedAt` de sus tarjetas (crear, mover, completar, editar) y decisiones registradas.
Abrir la página no cuenta.

## Capturas

`01-proyectos` · `02-necesitan-atencion` · `03-tarjeta-con-accion` ·
`04-tarjeta-sin-accion` · `05-retomar` · `06-selector-siguiente` ·
`07-proyecto-iphone` · `08-proyecto-oscuro`
