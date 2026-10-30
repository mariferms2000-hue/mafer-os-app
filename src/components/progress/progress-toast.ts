import type { ProgressFeedback } from "@/lib/progress/credit";
import { REWARD_EMOJI, REWARD_LABEL, progressDots } from "@/lib/progress/logic";
import { warnAviso } from "@/components/tasks/aviso-toast";

/* Toasts de progreso (F3): cada pantalla que completa una tarea conserva su
   mensaje de siempre y este helper le añade lo que pasó con el progreso:
   - sumó el punto → «Tarea completada ✓ · ●●○ 2 de 3»;
   - ganó la recompensa → «Tarea completada ✓ · Ganaste Agua 💧», con enlace al
     Jardín (el mensaje de siempre se conserva: confirma que la tarea se completó);
   - el progreso falló → aviso discreto; la tarea quedó completada igual;
   - nada que mostrar (ya había dado su punto, o es de ejemplo) → el mensaje de siempre. */

type Link = { label: string; href: string };
export type ProgressToast = { tone?: "ok" | "warn"; message: string; link?: Link };

export const GARDEN_LINK: Link = { label: "Ver en el jardín", href: "/biblioteca/jardin" };

export function withProgress(base: string, res: unknown, link?: Link, failed = `${base} · No se pudo actualizar el progreso.`): ProgressToast {
  const fb = (res ?? {}) as ProgressFeedback;
  if (fb.progressFailed) return { tone: "warn", message: failed, link };
  const p = fb.progress;
  if (p?.reward) {
    return { message: `${base} · Ganaste ${REWARD_LABEL[p.reward.item]} ${REWARD_EMOJI[p.reward.item]}`, link: GARDEN_LINK };
  }
  if (p?.delta === 1) return { message: `${base} · ${progressDots(p.count, p.goal)} ${p.count} de ${p.goal}`, link };
  return { message: base, link };
}

/** Recompensa ganada con este completado: Deshacer la pasa para revocarla. */
export function rewardIdOf(res: unknown): string | null {
  return (res as ProgressFeedback | null | undefined)?.progress?.reward?.id ?? null;
}

/** Tras Deshacer: si se revocó la recompensa, un aviso breve con la barra. */
export function undoneRewardMessage(res: unknown): string | null {
  const p = (res as ProgressFeedback | null | undefined)?.progress;
  return p?.rewardRevoked ? `Recompensa deshecha · ${progressDots(p.count, p.goal)} ${p.count} de ${p.goal}` : null;
}

export const TERMINADAS_LINK: Link = { label: "Ver en terminadas", href: "/tareas?v=terminadas" };

type ToastApi = { show: (t: { tone?: "ok" | "info" | "warn" | "error"; message: string; link?: Link; duration?: number }) => void };

/** Después de Deshacer un completado: el aviso de Google (si falló) y, si se
 *  revocó la recompensa, la barra como quedó. */
export function afterUndo(toast: ToastApi, res: unknown) {
  warnAviso(toast as Parameters<typeof warnAviso>[0], res);
  const m = undoneRewardMessage(res);
  if (m) toast.show({ tone: "info", message: m });
}
