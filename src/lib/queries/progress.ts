import "server-only";
import { and, count, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { PROGRESS_GOAL, REWARD_ITEMS, progressView, type RewardItem } from "@/lib/progress/logic";

/* Lectura del progreso para Hoy y el Jardín (F3). Solo lectura. */

export type ProgressOverview = {
  count: number;
  goal: number;
  /** recompensas sin usar, en el orden de REWARD_ITEMS; solo las que hay */
  inventory: { item: RewardItem; count: number }[];
};

/** null si el progreso no se pudo leer (p. ej. una base sin la migración 0003):
 *  la interfaz simplemente no lo muestra, nunca rompe Hoy ni el Jardín. */
export async function getProgressOverview(): Promise<ProgressOverview | null> {
  try {
    const [open] = await db
      .select({ n: count() })
      .from(schema.progressCredits)
      .where(and(eq(schema.progressCredits.kind, "tarea"), isNull(schema.progressCredits.rewardId)));
    const rows = await db
      .select({ item: schema.gardenRewards.item, n: count() })
      .from(schema.gardenRewards)
      .where(isNull(schema.gardenRewards.usedAt))
      .groupBy(schema.gardenRewards.item);
    const byItem = new Map(rows.map((r) => [r.item, r.n]));
    return {
      ...progressView(open?.n ?? 0, PROGRESS_GOAL),
      inventory: REWARD_ITEMS.flatMap((item) => {
        const n = byItem.get(item) ?? 0;
        return n > 0 ? [{ item, count: n }] : [];
      }),
    };
  } catch (err) {
    console.error("[progreso] no se pudo leer el progreso:", err);
    return null;
  }
}
