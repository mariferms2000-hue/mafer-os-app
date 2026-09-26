/** Tipos de evento del calendario, en el orden en que aparecen en los
 *  selectores. Fuente única para el formulario, el detalle y el Inbox. */
export const EVENT_TYPES = [
  { value: "cita", label: "Cita" },
  { value: "reunion", label: "Reunión" },
  { value: "evento", label: "Evento" },
  { value: "recordatorio", label: "Recordatorio" },
  { value: "deadline", label: "Deadline" },
] as const;
