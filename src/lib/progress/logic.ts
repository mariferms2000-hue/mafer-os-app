/* Reglas puras del progreso por tareas completadas (oct 2026). Sin base de
   datos ni React: el azar llega inyectado (`rng`), así todo es determinista y
   probable. La persistencia vive en credit.ts.

   - Cada tarea completada da 1 punto, una sola vez para siempre.
   - Al juntar PROGRESS_GOAL puntos se gana una recompensa sorpresa.
   - La recompensa sale de una BOLSA, no de azar puro: se baraja una bolsa
     completa y se saca una ficha cada vez; al vaciarse se rellena. En cada
     bolsa salen exactamente las proporciones de REWARD_BAG — sin rachas de
     mala suerte — y cambiarlas es editar esta constante. */

/** Tareas por recompensa. Empezó en 3 por el uso real medido en F0 (oct 2026);
 *  subirla a 5 si el ritmo cambia. */
export const PROGRESS_GOAL = 3;

export const REWARD_ITEMS = ["agua", "fertilizante"] as const;
export type RewardItem = (typeof REWARD_ITEMS)[number];

/** Composición de una bolsa (F4): 5 + 1. El Agua repone la sed del jardín
 *  (como mucho una planta cada THIRST_EVERY_DAYS días, ver garden/care-logic);
 *  el Fertilizante es raro: uno cada 6 recompensas = 18 tareas. Las bolsas ya
 *  empezadas con la composición anterior (6 + 2) se vacían tal cual; la
 *  siguiente ya sale con esta. */
export const REWARD_BAG: Record<RewardItem, number> = { agua: 5, fertilizante: 1 };

export const REWARD_LABEL: Record<RewardItem, string> = { agua: "Agua", fertilizante: "Fertilizante" };

export function isRewardItem(value: unknown): value is RewardItem {
  return typeof value === "string" && (REWARD_ITEMS as readonly string[]).includes(value);
}

/** Una bolsa completa, sin barajar (orden estable). */
export function fullBag(): RewardItem[] {
  return REWARD_ITEMS.flatMap((item) => Array<RewardItem>(REWARD_BAG[item]).fill(item));
}

/** Fisher–Yates con el generador inyectado (`rng` devuelve [0, 1)). */
export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Saca la siguiente ficha. Bolsa vacía → se rellena barajada y se saca de ahí. */
export function drawReward(bag: readonly RewardItem[], rng: () => number): { item: RewardItem; rest: RewardItem[] } {
  const source = bag.length > 0 ? [...bag] : shuffle(fullBag(), rng);
  const [item, ...rest] = source;
  return { item, rest };
}

/** Deshacer: la ficha vuelve al PRINCIPIO, así que rehacer saca la misma
 *  recompensa — Deshacer nunca sirve para volver a tirar. */
export function returnReward(bag: readonly RewardItem[], item: RewardItem): RewardItem[] {
  return [item, ...bag];
}

/** Lee la bolsa guardada en settings. Cualquier valor ilegible o ficha
 *  desconocida se descarta: lo peor que pasa es que se rellene antes. */
export function parseBag(raw: string | null | undefined): RewardItem[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isRewardItem) : [];
  } catch {
    return [];
  }
}

/** ¿Con estos puntos en la barra toca recompensa? */
export function reachesGoal(openPoints: number, goal = PROGRESS_GOAL): boolean {
  return goal > 0 && openPoints >= goal;
}

/** Lo que se muestra de la barra: nunca más puntos que la meta. */
export function progressView(openPoints: number, goal = PROGRESS_GOAL): { count: number; goal: number } {
  return { count: Math.max(0, Math.min(openPoints, goal)), goal };
}
