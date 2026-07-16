# QA — Fase 5A: revisiones diaria y semanal (sistema antiolvido)

Fecha: 2026-07-15 · Base de pruebas temporal; la BD real no se toca en pruebas.

## Qué existe ahora

**Centro de revisiones** en `/revisiones` (sin ocupar la barra lateral): dos tarjetas con
estado, última vez, próxima sugerida, duración aproximada y progreso si quedó a medias,
más el **historial simple de las últimas 5** (fecha, tipo, completa/incompleta, minutos,
elementos atendidos y resumen). Desde **Hoy** hay un acceso compacto («Revisiones») con
**un solo aviso** como máximo — prioridad: incompleta > semanal pendiente > diaria
pendiente — sin desplazar a «Haz esto ahora».

## Revisión diaria (5 pasos, ~5 min)

1. **Inbox** — hasta 5 capturas con Procesar / Archivar / Eliminar; «dejar para después»
   es simplemente seguir. Enlace «Ver más» si hay más.
2. **Tareas** — solo lo que pide decisión: vencidas, de hoy, esperando ≥7 días,
   bloqueadas. Acciones por fila: Abrir (TaskLine) · Completar (círculo) · Mañana ·
   +7 días · Quitar fecha · Después · Mantener así.
3. **Prioridades** — las 3 del día con confirmar/cambiar/quitar/reemplazo (los flujos
   ya aprobados).
4. **Energía** — «¿Cómo está tu energía hoy?» con la nota de que solo ajusta
   sugerencias, nunca las prioridades manuales.
5. **Cierre** — qué se terminó, qué queda de hoy, cuántos elementos atendiste y
   **cuál será el primer paso al volver** (el #1 del motor de recomendación).
   Botón «Cerrar revisión».

## Revisión semanal (6 pasos, ~15–20 min)

1. **Proyectos** — los que piden atención (motor de la Fase 4B) con Retomar / Definir
   siguiente acción / Pausar / Mantener activo / Archivar.
2. **Tareas** — vencidas, sin proyecto, sin estimar, esperando, ≥14 días sin actividad;
   con reprogramar/Después/Archivar/Mantener.
3. **Incubadora** — ideas sin revisar hace ≥14 días (o las más antiguas): A proyecto /
   A Learn Fast / Mantener incubando / Algún día / Archivar / Eliminar con confirmación.
   **Nada se convierte solo.**
4. **Learn Fast** — temas sin arrancar, activos (con su sprint) y pausados; Definir
   siguiente paso / Pausar / Reactivar / Completar / Archivar.
5. **Recursos** — pendientes y en progreso: Revisado / Vincular / Mantener pendiente /
   Eliminar con confirmación.
6. **Próxima semana** — fechas de los próximos 7 días, vencidas que siguen abiertas,
   proyectos prioritarios y **sugerencias de prioridades que tú decides** (botón por
   candidata; nada se marca solo). Botón «Semana preparada».

## Diseño TDAH

Un paso a la vez · barra de progreso discreta (puntos) · máximo 5 elementos por tanda
con «Ver más» · acción principal clara · **«Salir y continuar después»** siempre visible ·
progreso guardado automáticamente en la base (tabla `reviews`, migración 0004) ·
«Anterior» disponible · lenguaje calmado («No necesitas procesarlas todas», «Reprogramar
también es avanzar», «Tu revisión quedó guardada») · sin animaciones.

## Continuidad y frecuencia

Salir a mitad guarda paso y decisiones; Hoy muestra «Continuar revisión …»; Continuar /
Reiniciar (con confirmación; **no revierte** lo aplicado) / Dar por terminada (queda
como incompleta en el historial). La diaria se sugiere una vez al día (repetible, sin
insistir); la semanal una vez por semana, con **día preferido configurable en Ajustes**
(lógica pura en `src/lib/review-logic.ts`, con pruebas). Solo avisos dentro de la app.

## Capturas

`01-centro` · `02-hoy-acceso` · `03-diaria-inbox` · `04-diaria-cierre` ·
`05-semanal-proyectos` · `06-semana-preparada` · `07-continuar` · `08-oscuro` · `09-movil`
