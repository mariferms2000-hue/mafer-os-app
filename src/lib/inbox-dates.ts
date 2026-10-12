import { addDays, dayOfWeek, toLocalDate } from "./tz";

/* Fechas del Inbox (Bloque 2). Puras: se prueban sin base ni navegador.
 * `today` siempre es la fecha de hoy en hora de México (lib/tz). */

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Antigüedad legible de una captura: «hoy», «ayer», «hace 5 días», «12 sep». */
export function captureAge(createdAtIso: string, today: string): string {
  const local = toLocalDate(createdAtIso);
  const dias = Math.round((Date.parse(today) - Date.parse(local)) / 86_400_000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 14) return `hace ${dias} días`;
  const [, m, d] = local.split("-").map(Number);
  return `${d} ${MESES[m - 1]}`;
}

export type QuickDue = { key: string; label: string; date: string | null };

/** Fechas rápidas al convertir una captura en tarea. «Próx. semana» es el
 *  lunes siguiente (si hoy es lunes, el de la semana que viene). */
export function quickDueDates(today: string): QuickDue[] {
  const dow = dayOfWeek(today); // 0 = domingo
  const toMonday = ((8 - dow) % 7) || 7;
  return [
    { key: "sin", label: "Sin fecha", date: null },
    { key: "hoy", label: "Hoy", date: today },
    { key: "manana", label: "Mañana", date: addDays(today, 1) },
    { key: "semana", label: "Próx. semana", date: addDays(today, toMonday) },
  ];
}
