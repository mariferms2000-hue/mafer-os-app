import type { ProgressFeedback } from "@/lib/progress/credit";
import { REWARD_LABEL, type RewardItem } from "@/lib/progress/logic";
import { warnAviso } from "@/components/tasks/aviso-toast";

/* Toasts de progreso (F3): cada pantalla que completa una tarea conserva su
   mensaje de siempre y este helper decide qué más mostrar:
   - sumó el punto → el toast lleva debajo «Progreso del jardín» con el camino
     en miniatura y la hoja nueva brotando;
   - ganó la recompensa → la tarjeta de recompensa (ícono grande, «Ganaste
     Agua», «Ver jardín»); el mensaje de siempre queda arriba, pequeño, y
     confirma que la tarea se completó;
   - el progreso falló → aviso discreto; la tarea quedó completada igual;
   - nada que mostrar (ya había dado su punto, o es de ejemplo) → el de siempre.
   El ToastProvider pinta `progress` y `reward`; aquí solo se decide. */

type Link = { label: string; href: string };
export type ProgressToast = {
  tone?: "ok" | "info" | "warn";
  message: string;
  link?: Link;
  progress?: { count: number; goal: number; grow?: number | null };
  reward?: { item: RewardItem; label: string; goal: number };
};

export const TERMINADAS_LINK: Link = { label: "Ver en terminadas", href: "/tareas?v=terminadas" };

/** «Ver jardín» lleva a la sección de recompensas y hace brillar la ficha ganada. */
export function gardenLink(item: RewardItem): Link {
  return { label: "Ver jardín", href: `/biblioteca/jardin?recompensa=${item}#recompensas-del-jardin` };
}

export function withProgress(
  base: string,
  res: unknown,
  link?: Link,
  failed = `${base} · No se pudo actualizar el progreso.`
): ProgressToast {
  const fb = (res ?? {}) as ProgressFeedback;
  if (fb.progressFailed) return { tone: "warn", message: failed, link };
  const p = fb.progress;
  if (p?.reward) {
    const item = p.reward.item;
    return { message: base, link: gardenLink(item), reward: { item, label: REWARD_LABEL[item], goal: p.goal } };
  }
  if (p?.delta === 1) return { message: base, link, progress: { count: p.count, goal: p.goal, grow: p.count - 1 } };
  return { message: base, link };
}

/** Recompensa ganada con este completado: Deshacer la pasa para revocarla. */
export function rewardIdOf(res: unknown): string | null {
  return (res as ProgressFeedback | null | undefined)?.progress?.reward?.id ?? null;
}

/** Tras Deshacer: si se revocó la recompensa, un aviso breve con el camino. */
export function undoneRewardToast(res: unknown): ProgressToast | null {
  const p = (res as ProgressFeedback | null | undefined)?.progress;
  return p?.rewardRevoked ? { tone: "info", message: "Recompensa deshecha", progress: { count: p.count, goal: p.goal } } : null;
}

type ToastApi = { show: (t: ProgressToast & { tone?: "ok" | "info" | "warn" | "error"; duration?: number }) => void };

/** Después de Deshacer un completado: el aviso de Google (si falló) y, si se
 *  revocó la recompensa, el camino como quedó. */
export function afterUndo(toast: ToastApi, res: unknown) {
  warnAviso(toast as Parameters<typeof warnAviso>[0], res);
  const undone = undoneRewardToast(res);
  if (undone) toast.show(undone);
}
