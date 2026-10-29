import "server-only";
import { and, count, eq, isNull, sql } from "drizzle-orm";
import { db, now, uid, schema } from "@/lib/db";
import {
  PROGRESS_GOAL,
  drawReward,
  isRewardItem,
  parseBag,
  progressView,
  reachesGoal,
  returnReward,
  type RewardItem,
} from "./logic";

/* Persistencia del progreso (oct 2026). Las reglas viven en logic.ts; aquí
   solo se leen y escriben progress_credits, garden_rewards y la bolsa.

   SIN TRANSACCIONES, a propósito: con `max_pipeline: 0` (obligatorio para el
   pooler de Supabase, ver src/lib/db/index.ts) postgres-js nunca reserva la
   conexión de `sql.begin`, así que db.transaction no funciona en esta app.
   Cada paso que debe ser atómico es UNA sola sentencia SQL — en Postgres una
   sentencia es atómica por sí misma:
   - sumar un punto: INSERT … ON CONFLICT DO NOTHING (la llave es la tarea);
   - ganar la recompensa: tomar los puntos con FOR UPDATE, avanzar la bolsa
     solo si nadie la cambió desde que se leyó (compare-and-swap), crear la
     recompensa y asignarle los puntos — todo o nada;
   - deshacerla: lo mismo al revés.
   Dos completados simultáneos no pueden ganar dos recompensas: el segundo
   encuentra los puntos ya asignados (o la bolsa ya cambiada) y no hace nada.

   Un fallo aquí NUNCA deshace la tarea: progressAfterChange lo atrapa, lo
   registra y la tarea queda completada (o reabierta) igual, sin progreso. */

const BAG_KEY = "progress_reward_bag";
const ATTEMPTS = 3;

/** Lo que una acción devuelve a la interfaz cuando el progreso cambió. */
export type ProgressUpdate = {
  /** +1 sumó el punto · 0 la tarea ya lo había dado (o no cambió nada) · -1 se quitó */
  delta: 1 | 0 | -1;
  count: number;
  goal: number;
  /** recompensa ganada con ESTE completado (para mostrarla y poder deshacerla) */
  reward: { id: string; item: RewardItem } | null;
  /** Deshacer revocó la recompensa de este completado */
  rewardRevoked: boolean;
};

export type ProgressFeedback = { progress?: ProgressUpdate };

/** Azar del servidor para barajar la bolsa (las pruebas inyectan el suyo). */
function secureRandom(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
}

/** Puntos en la barra (aún sin recompensa). */
async function openCount(): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(schema.progressCredits)
    .where(and(eq(schema.progressCredits.kind, "tarea"), isNull(schema.progressCredits.rewardId)));
  return row?.n ?? 0;
}

/** Valor crudo de la bolsa en settings: el compare-and-swap lo compara tal cual. */
async function readBagRaw(): Promise<string | null> {
  const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, BAG_KEY)).limit(1);
  return row?.value ?? null;
}

/** ¿La tarea existe, está completada y cuenta? Las de ejemplo (o de un
 *  proyecto de ejemplo — la misma regla que Mantenimiento) nunca cuentan. */
async function countableCompleted(cardId: string): Promise<boolean> {
  const [row] = await db
    .select({
      completedAt: schema.cards.completedAt,
      cardStarter: schema.cards.isStarter,
      projectStarter: schema.projects.isStarter,
    })
    .from(schema.cards)
    .leftJoin(schema.projects, eq(schema.cards.projectId, schema.projects.id))
    .where(eq(schema.cards.id, cardId))
    .limit(1);
  if (!row?.completedAt) return false;
  return !row.cardStarter && !row.projectStarter;
}

/** Convierte los PROGRESS_GOAL puntos más antiguos de la barra en una
 *  recompensa, en una sola sentencia. null si no alcanzan (otro completado
 *  simultáneo ya se los llevó). Reintenta si la bolsa cambió entre la lectura
 *  y la escritura. */
async function claimReward(rng: () => number): Promise<{ id: string; item: RewardItem } | null> {
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const raw = await readBagRaw();
    const { item, rest } = drawReward(parseBag(raw), rng);
    const id = uid();
    const t = now();
    const claimed = await db.execute(sql`
      WITH picked AS (
        SELECT card_id FROM progress_credits
        WHERE kind = 'tarea' AND reward_id IS NULL
        ORDER BY credited_at, card_id
        LIMIT ${PROGRESS_GOAL}
        FOR UPDATE
      ),
      bag AS (
        INSERT INTO settings (key, value, updated_at)
        SELECT ${BAG_KEY}, ${JSON.stringify(rest)}, ${t}
        WHERE (SELECT count(*) FROM picked) >= ${PROGRESS_GOAL}
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
        WHERE settings.value IS NOT DISTINCT FROM ${raw}::text
        RETURNING 1
      ),
      reward AS (
        INSERT INTO garden_rewards (id, item, earned_at, used_at)
        SELECT ${id}, ${item}, ${t}, NULL
        WHERE EXISTS (SELECT 1 FROM bag)
        RETURNING id
      )
      UPDATE progress_credits SET reward_id = (SELECT id FROM reward)
      WHERE card_id IN (SELECT card_id FROM picked) AND EXISTS (SELECT 1 FROM reward)
      RETURNING card_id
    `);
    if (claimed.length > 0) return { id, item };
    if (!reachesGoal(await openCount())) return null;
  }
  return null;
}

/** Revoca una recompensa recién ganada, en una sola sentencia: solo si sigue
 *  siendo la más reciente, no se ha usado y el punto de `cardId` es suyo. Los
 *  demás puntos vuelven a la barra, el de `cardId` se quita y la ficha vuelve
 *  al principio de la bolsa. */
async function revokeReward(cardId: string, rewardId: string): Promise<boolean> {
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const [reward] = await db.select().from(schema.gardenRewards).where(eq(schema.gardenRewards.id, rewardId)).limit(1);
    if (!reward || reward.usedAt || !isRewardItem(reward.item)) return false;
    const raw = await readBagRaw();
    const back = returnReward(parseBag(raw), reward.item);
    const t = now();
    const removed = await db.execute(sql`
      WITH ok AS (
        SELECT g.id FROM garden_rewards g
        WHERE g.id = ${rewardId} AND g.used_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM garden_rewards n WHERE (n.earned_at, n.id) > (g.earned_at, g.id))
          AND EXISTS (SELECT 1 FROM progress_credits c WHERE c.card_id = ${cardId} AND c.reward_id = g.id)
        FOR UPDATE OF g
      ),
      bag AS (
        INSERT INTO settings (key, value, updated_at)
        SELECT ${BAG_KEY}, ${JSON.stringify(back)}, ${t}
        WHERE EXISTS (SELECT 1 FROM ok)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
        WHERE settings.value IS NOT DISTINCT FROM ${raw}::text
        RETURNING 1
      ),
      gone AS (
        DELETE FROM garden_rewards
        WHERE id IN (SELECT id FROM ok) AND EXISTS (SELECT 1 FROM bag)
        RETURNING id
      ),
      released AS (
        UPDATE progress_credits SET reward_id = NULL
        WHERE reward_id IN (SELECT id FROM gone) AND card_id <> ${cardId}
        RETURNING 1
      )
      DELETE FROM progress_credits
      WHERE card_id = ${cardId} AND reward_id IN (SELECT id FROM gone)
      RETURNING card_id
    `);
    if (removed.length > 0) return true;
  }
  return false;
}

/** Suma el punto de una tarea recién completada. Idempotente: si la tarea ya
 *  tenía crédito (de cualquier tipo, incluida 'previa') no suma nada. Al llegar
 *  a la meta gana una recompensa con los puntos más antiguos. null = la tarea
 *  no existe, no está completada o no cuenta (ejemplo). */
export async function creditCompletion(cardId: string, rng: () => number = secureRandom): Promise<ProgressUpdate | null> {
  if (!(await countableCompleted(cardId))) return null;

  const inserted = await db
    .insert(schema.progressCredits)
    .values({ cardId, kind: "tarea", rewardId: null, creditedAt: now() })
    .onConflictDoNothing({ target: schema.progressCredits.cardId })
    .returning({ cardId: schema.progressCredits.cardId });
  if (inserted.length === 0) {
    return { delta: 0, ...progressView(await openCount()), reward: null, rewardRevoked: false };
  }

  const reward = reachesGoal(await openCount()) ? await claimReward(rng) : null;
  return { delta: 1, ...progressView(await openCount()), reward, rewardRevoked: false };
}

/** Quita el punto de una tarea que se reabrió.
 *  - Si el punto sigue en la barra, se quita.
 *  - Si ya se gastó en una recompensa, se queda (y la recompensa también):
 *    volver a completar la tarea no suma, porque la llave sigue ocupada.
 *  - Excepción: el Deshacer inmediato del completado que ganó la recompensa
 *    (`undoRewardId`). Si esa recompensa es la más reciente y no se ha usado,
 *    se revoca: los demás puntos vuelven a la barra y la ficha vuelve al
 *    principio de la bolsa, así que rehacer gana LA MISMA recompensa.
 *  null = la tarea no tenía punto propio (nunca contó, o es 'previa'). */
export async function revokeCompletion(cardId: string, undoRewardId?: string | null): Promise<ProgressUpdate | null> {
  const [credit] = await db
    .select()
    .from(schema.progressCredits)
    .where(eq(schema.progressCredits.cardId, cardId))
    .limit(1);
  if (!credit || credit.kind !== "tarea") return null;

  let delta: ProgressUpdate["delta"] = 0;
  let rewardRevoked = false;
  if (credit.rewardId === null) {
    const removed = await db
      .delete(schema.progressCredits)
      .where(and(eq(schema.progressCredits.cardId, cardId), isNull(schema.progressCredits.rewardId)))
      .returning({ cardId: schema.progressCredits.cardId });
    if (removed.length > 0) delta = -1;
  } else if (undoRewardId && credit.rewardId === undoRewardId) {
    rewardRevoked = await revokeReward(cardId, undoRewardId);
    if (rewardRevoked) delta = -1;
  }
  return { delta, ...progressView(await openCount()), reward: null, rewardRevoked };
}

/** Punto único que usan las acciones de tareas: decide según el antes y el
 *  después de `completedAt`. Sin cambio de estado, no toca nada. Nunca lanza:
 *  el progreso no puede romper completar ni reabrir una tarea. */
export async function progressAfterChange(
  cardId: string,
  wasCompleted: boolean,
  isCompleted: boolean,
  undoRewardId?: string | null
): Promise<ProgressUpdate | undefined> {
  if (wasCompleted === isCompleted) return undefined;
  try {
    const res = isCompleted ? await creditCompletion(cardId) : await revokeCompletion(cardId, undoRewardId);
    return res ?? undefined;
  } catch (err) {
    console.error("[progreso] no se pudo actualizar el progreso:", err);
    return undefined;
  }
}
