/* Salud de proyectos — Fase 4B. Módulo puro y transparente: detecta qué
   proyectos necesitan atención y por qué, con umbrales explícitos, y formatea
   fechas en lenguaje humano. Sin cajas negras. */

import { diasEntre } from "./recommend";

export const DIAS_ESPERANDO = 7;
export const DIAS_INACTIVO = 14;

export type ProjectSignal = {
  /** Hay una siguiente acción viva: tarjeta vinculada abierta, o texto heredado. */
  hasNextAction: boolean;
  /** La tarjeta vinculada se completó: hay que elegir la siguiente (nunca se elige sola). */
  nextActionCompleted: boolean;
  /** Tareas abiertas vencidas. */
  overdue: number;
  /** Tareas abiertas bloqueadas. */
  blocked: number;
  /** Días de la espera más antigua entre las tareas en Esperando (null si no hay). */
  oldestWaitingDays: number | null;
  /** Días desde la última actividad significativa. */
  inactiveDays: number;
};

export type ProjectIssueKind =
  | "tarea-vencida"
  | "bloqueado"
  | "esperando-mucho"
  | "sin-accion"
  | "inactivo";

export type ProjectIssue = { kind: ProjectIssueKind; label: string };

/** Problemas del proyecto en orden de urgencia:
 *  vencida > bloqueado > esperando demasiado > sin siguiente acción > inactivo. */
export function projectIssues(s: ProjectSignal): ProjectIssue[] {
  const issues: ProjectIssue[] = [];
  if (s.overdue > 0) {
    issues.push({
      kind: "tarea-vencida",
      label: s.overdue === 1 ? "1 tarea vencida" : `${s.overdue} tareas vencidas`,
    });
  }
  if (s.blocked > 0) {
    issues.push({ kind: "bloqueado", label: s.blocked === 1 ? "1 tarea bloqueada" : `${s.blocked} bloqueadas` });
  }
  if (s.oldestWaitingDays !== null && s.oldestWaitingDays >= DIAS_ESPERANDO) {
    issues.push({ kind: "esperando-mucho", label: `esperando hace ${s.oldestWaitingDays} días` });
  }
  if (!s.hasNextAction) {
    issues.push({
      kind: "sin-accion",
      label: s.nextActionCompleted ? "la siguiente acción se completó — elige otra" : "sin siguiente acción",
    });
  }
  if (s.inactiveDays >= DIAS_INACTIVO) {
    issues.push({ kind: "inactivo", label: `${s.inactiveDays} días sin actividad` });
  }
  return issues;
}

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Fecha humana: Hoy · Ayer · Hace N días · 14 jul 2026. */
export function humanDate(iso: string | null | undefined, today: string): string {
  if (!iso) return "sin registro";
  const dias = diasEntre(iso, today);
  if (dias <= 0) return "Hoy";
  if (dias === 1) return "Ayer";
  if (dias <= 30) return `Hace ${dias} días`;
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${MESES_CORTOS[(m ?? 1) - 1]} ${y}`;
}
