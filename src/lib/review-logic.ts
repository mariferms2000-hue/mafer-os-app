/* Lógica pura de revisiones — Fase 5A. Cuándo sugerir cada revisión y qué
   único aviso mostrar en Hoy. Transparente y con pruebas unitarias. */

export const DAILY_STEPS = 5;
export const WEEKLY_STEPS = 6;

export const DAILY_STEP_TITLES = ["Inbox", "Tareas", "Prioridades", "Energía", "Cierre"];
export const WEEKLY_STEP_TITLES = ["Proyectos", "Tareas", "Incubadora", "Learn Fast", "Recursos", "Próxima semana"];

/** Lunes (YYYY-MM-DD) de la semana a la que pertenece la fecha dada. */
export function mondayOf(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00`);
  const day = d.getDay(); // 0=domingo
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** La diaria se sugiere una vez al día: pendiente si hoy no se ha completado.
 *  (Se puede hacer más de una vez; simplemente deja de sugerirse.) */
export function dailyPending(today: string, lastCompletedDate: string | null): boolean {
  return lastCompletedDate !== today;
}

/** La semanal se sugiere una vez por semana (lunes a domingo). Si Mafer
 *  configuró un día (0=domingo…6=sábado), solo se sugiere a partir de ese día. */
export function weeklyPending(
  today: string,
  lastCompletedDate: string | null,
  configuredDay: number | null
): boolean {
  const hechEstaSemana = lastCompletedDate !== null && mondayOf(lastCompletedDate) === mondayOf(today);
  if (hechEstaSemana) return false;
  if (configuredDay === null) return true; // cualquier día
  const dow = new Date(`${today}T00:00:00`).getDay();
  // días transcurridos de la semana (lunes=0 … domingo=6), en ambos calendarios
  const pos = (d: number) => (d === 0 ? 6 : d - 1);
  return pos(dow) >= pos(configuredDay);
}

export type ReviewNudgeKind = "continuar-diaria" | "continuar-semanal" | "semanal" | "diaria";

/** UN solo aviso en Hoy. Prioridad: incompleta > semanal pendiente > diaria pendiente. */
export function reviewNudge(opts: {
  unfinishedDaily: boolean;
  unfinishedWeekly: boolean;
  dailyIsPending: boolean;
  weeklyIsPending: boolean;
}): ReviewNudgeKind | null {
  if (opts.unfinishedWeekly) return "continuar-semanal";
  if (opts.unfinishedDaily) return "continuar-diaria";
  if (opts.weeklyIsPending) return "semanal";
  if (opts.dailyIsPending) return "diaria";
  return null;
}
