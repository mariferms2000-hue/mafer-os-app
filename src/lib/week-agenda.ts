import { addDays, dayOfWeek } from "./tz";
import type { CardRow } from "./queries/today";

/** Agenda semanal de Hoy: eventos y tareas pendientes con fecha, de lunes a
 *  domingo, agrupados por día. Reglas (para no repetir lo que ya está en
 *  «Para que nada se caiga»):
 *  - Solo tareas abiertas (la consulta ya excluye completadas y archivadas).
 *  - Una tarea con fecha ANTERIOR a hoy está vencida: vive en «Vencidas», no
 *    aquí. Por eso los días pasados solo muestran eventos.
 *  - Si un evento y una tarea son lo mismo (mismo evento de Google, o mismo
 *    día y mismo título) se muestra una sola vez, como tarea, porque la tarea
 *    tiene acciones (completar, abrir, eliminar).
 *  - Dentro de cada día: eventos de todo el día, luego lo que tiene hora en
 *    orden cronológico, y al final las tareas sin hora. */

export type AgendaEvent = {
  id: string;
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  type: string | null;
  gcalEventId?: string | null;
};

export type AgendaItem =
  | { kind: "evento"; time: string | null; event: AgendaEvent }
  | { kind: "tarea"; time: string | null; card: CardRow };

export type AgendaDay = { date: string; isToday: boolean; isPast: boolean; items: AgendaItem[] };

export type WeekAgenda = {
  weekStart: string;
  weekEnd: string;
  isCurrentWeek: boolean;
  days: AgendaDay[];
};

/** Lunes de la semana que contiene `ymd`. */
export function weekStartOf(ymd: string): string {
  return addDays(ymd, -((dayOfWeek(ymd) + 6) % 7));
}

/** Acepta solo un lunes YYYY-MM-DD válido; cualquier otra cosa → semana actual. */
export function parseWeekParam(param: string | undefined, today: string): string {
  if (param && /^\d{4}-\d{2}-\d{2}$/.test(param) && !Number.isNaN(Date.parse(param))) {
    return weekStartOf(param);
  }
  return weekStartOf(today);
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/\s+/g, " ").trim();

function sortKey(i: AgendaItem): string {
  if (i.time) return `1${i.time}${i.kind === "evento" ? "0" : "1"}`;
  return i.kind === "evento" ? "0" : "2";
}

export function buildWeekAgenda(input: {
  today: string;
  weekStart: string;
  events: AgendaEvent[];
  open: CardRow[];
}): WeekAgenda {
  const { today: d, weekStart, events, open } = input;
  const weekEnd = addDays(weekStart, 6);
  const inWeek = (ymd: string | null | undefined): ymd is string => Boolean(ymd && ymd >= weekStart && ymd <= weekEnd);

  const tasks = open.filter((c) => inWeek(c.dueDate) && c.dueDate! >= d);
  const taskGcal = new Set(tasks.map((c) => c.gcalEventId).filter(Boolean));
  const taskKey = new Set(tasks.map((c) => `${c.dueDate}|${norm(c.title)}`));
  const evs = events.filter(
    (e) => inWeek(e.date) && !(e.gcalEventId && taskGcal.has(e.gcalEventId)) && !taskKey.has(`${e.date}|${norm(e.title)}`)
  );

  const days: AgendaDay[] = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const items: AgendaItem[] = [
      ...evs.filter((e) => e.date === date).map((e) => ({ kind: "evento" as const, time: e.startTime || null, event: e })),
      ...tasks.filter((c) => c.dueDate === date).map((c) => ({ kind: "tarea" as const, time: c.startTime || null, card: c })),
    ].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    return { date, isToday: date === d, isPast: date < d, items };
  });

  return { weekStart, weekEnd, isCurrentWeek: d >= weekStart && d <= weekEnd, days };
}

/** Ids de las tareas que la Agenda de ESTA semana ya muestra (de hoy al domingo). */
export function currentWeekTaskIds(today: string, open: CardRow[]): Set<string> {
  const end = addDays(weekStartOf(today), 6);
  return new Set(open.filter((c) => c.dueDate && c.dueDate >= today && c.dueDate <= end).map((c) => c.id));
}
