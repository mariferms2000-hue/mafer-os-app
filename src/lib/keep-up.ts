import { addDays } from "./tz";
import { diasEntre } from "./recommend";
import type { CardRow } from "./queries/today";

/** «Para que nada se caiga» (Bloque 2): lo que hay que vigilar, agrupado y SIN
 *  repetir — cada tarea aparece una sola vez, en su grupo más urgente
 *  (vencida > bloqueada > esperando > próxima). Los avisos de proyecto se
 *  juntan en una línea por proyecto. */
export type KeepUp = {
  overdue: CardRow[];
  blocked: CardRow[];
  waiting: (CardRow & { waitingDays: number })[];
  upcoming: CardRow[];
  projects: { id: string; title: string; noNextAction: boolean; idleDays: number | null }[];
};

export const PROJECT_IDLE_DAYS = 14;

export function buildKeepUp(input: {
  today: string;
  open: CardRow[];
  projects: { id: string; title: string; hasNextAction: boolean; lastActivity: string }[];
}): KeepUp {
  const { today: d, open, projects } = input;
  const seen = new Set<string>();
  const take = (list: CardRow[]) => list.filter((c) => !seen.has(c.id) && (seen.add(c.id), true));
  const d7 = addDays(d, 7);
  const isBlocked = (c: CardRow) => c.columnKind === "bloqueado" || Boolean(c.blockedReason);
  const isWaiting = (c: CardRow) => c.columnKind === "esperando" || Boolean(c.waitingFor);
  const byDue = (a: CardRow, b: CardRow) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "");

  const overdue = take(open.filter((c) => c.dueDate && c.dueDate < d).sort(byDue));
  const blocked = take(open.filter(isBlocked));
  const waiting = take(open.filter(isWaiting))
    .map((c) => ({ ...c, waitingDays: diasEntre(c.updatedAt, d) }))
    .sort((a, b) => b.waitingDays - a.waitingDays);
  // Las que vencen HOY ya están en la Agenda: aquí, de mañana a 7 días.
  const upcoming = take(open.filter((c) => c.dueDate && c.dueDate > d && c.dueDate <= d7).sort(byDue));

  const projectAlerts = projects
    .map((p) => {
      const idle = diasEntre(p.lastActivity, d);
      return {
        id: p.id,
        title: p.title,
        noNextAction: !p.hasNextAction,
        idleDays: idle >= PROJECT_IDLE_DAYS ? idle : null,
      };
    })
    .filter((p) => p.noNextAction || p.idleDays !== null)
    // el más olvidado primero (los que solo carecen de siguiente acción, al final)
    .sort((a, b) => (b.idleDays ?? -1) - (a.idleDays ?? -1));

  return { overdue, blocked, waiting, upcoming, projects: projectAlerts };
}
