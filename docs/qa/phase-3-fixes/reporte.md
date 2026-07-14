# QA — Correcciones de la Fase 3

Fecha: 2026-07-14 · Reproducido primero en la APP REAL (puerto 3456, `data/mafer-os.db`, WebKit).

## Diagnóstico sobre la app real

1. **Prioridades**: el selector de Hoy sí abría y añadía, pero el botón «Prioridad de hoy»
   del detalle **no daba ningún feedback**: en éxito no decía nada, y si la tarea ya era
   prioridad o los tres espacios estaban llenos, callaba — parecía roto.
2. **Toast en oscuro**: estilos computados reales `background: rgb(236,230,217)` y
   `color: rgb(236,230,217)` — texto crema sobre fondo crema, invisible. Causa: las clases
   `!bg-charcoal !border-charcoal` (con `!important`) le ganaban al token inline, y en modo
   oscuro `--color-charcoal` se convierte en crema.

## Correcciones

### Prioridades de Hoy
- `addTodayPriority` ahora responde `added | duplicate | full` (con las 3 actuales); nueva
  `replaceTodayPriority` conserva la posición. Nada se reemplaza en silencio.
- Botón «Prioridad de hoy» (detalle y «Haz esto ahora»): añade al primer espacio libre con
  toast **«Añadida a tus prioridades de hoy ✓» + Deshacer**; duplicado → **«Ya está en tus
  prioridades de hoy»**; tres llenos → **selector de reemplazo** («la que salga no se pierde»)
  con toast **«Prioridad reemplazada» + Deshacer**.
- El selector de Hoy también da feedback al elegir, y sus candidatas excluyen terminadas,
  archivadas y **bloqueadas**.
- **Completar una prioridad libera su espacio** (nunca se elige otra automáticamente), con
  toast «su espacio quedó libre» + **Deshacer** (restaura tarea Y prioridad en su posición)
  + **«Elegir reemplazo»**. Aplica se complete desde donde se complete.
- Las prioridades siguen siendo por fecha: al cambiar de día los espacios amanecen vacíos
  y el historial de días anteriores se conserva (sin cambios en el modelo).

### Toasts (auditoría global del componente)
- `toast.tsx` ya no usa colores de utilidades: solo tokens `--color-toast-*` definidos por
  tema. Claro: superficie tinta oscura + texto crema (igual que antes, contraste correcto).
  Oscuro: **superficie verde bosque elevada `#223122`, texto crema `#f2ecdf`, borde discreto,
  acciones subrayadas, icono por tono, botón cerrar visible**.
- Tonos: éxito (ok), información, advertencia y **error** (nuevo), cada uno con su icono y
  color de icono tokenizado. Cubre todos los mensajes existentes (completada, Guardado en
  Inbox, actualizada, prioridades, errores, Deshacer, Ver en terminadas…).

### Panel «Pruebas de alertas antiolvido» (solo desarrollo)
- Vive al final de Ajustes únicamente cuando `NODE_ENV=development` (o `MAFER_QA_TOOLS=1`,
  que usa solo el entorno de pruebas E2E; el lanzador real nunca lo define). Las acciones
  del servidor rechazan ejecutarse en producción.
- «Crear escenarios de prueba» siembra los 6 casos con prefijo visible **«QA ALERTA»**
  (vencida −5 días, hoy sin estimar, proyecto sin siguiente acción, Inbox −5 días,
  esperando −10 días, proyecto dormido −20 días) sin tocar fechas ni proyectos reales.
- «Eliminar todos los datos QA» borra todo por prefijo. Los umbrales reales de producción
  no se cambiaron.

## Capturas
- `01-prioridad-asignada.png` — prioridad en Hoy con su toast.
- `02-selector-reemplazo.png` — selector con los tres espacios llenos.
- `03-toast-oscuro.png` — toast legible en modo oscuro.
- `04-panel-qa.png` — panel QA en Ajustes.
- `05-alertas-simuladas.png` — las alertas simuladas en Hoy (máx. 5, vencida primero).
