import "server-only";
import { eq, isNull, sql, count } from "drizzle-orm";
import { db, now, schema } from "@/lib/db";
import { NO_CARE, dueThirst, isFresh, type PlantCare } from "./care-logic";

/* Persistencia del cuidado del Jardín (F4). Las reglas viven en care-logic.ts.

   Igual que el progreso (ver progress/credit.ts): SIN transacciones, porque
   db.transaction no funciona con el pooler de Supabase. Cada operación que debe
   ser atómica es UNA sola sentencia SQL con CTEs que modifican datos: o se
   gasta el Agua y la planta se hidrata, o no pasa nada. Nunca a medias.

   Estado:
   - garden_plant_care: sed, último riego y fertilización por planta.
   - garden_rewards.used_at / used_on: qué ficha se gastó y en qué planta.
   - settings `garden_care_since`: cuándo se estrenó el cuidado (nadie empieza sediento).
   - settings `garden_special_plant`: la planta especial que se luce ('' = ninguna). */

const SINCE_KEY = "garden_care_since";
const SPECIAL_KEY = "garden_special_plant";

export type CareState = {
  /** solo plantas con algo distinto de NO_CARE */
  care: Record<string, PlantCare>;
  specialId: string | null;
  inventory: { agua: number; fertilizante: number };
};

export const EMPTY_CARE: CareState = { care: {}, specialId: null, inventory: { agua: 0, fertilizante: 0 } };

async function readSetting(key: string): Promise<string | null> {
  const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, key)).limit(1);
  return row?.value ?? null;
}

async function specialId(): Promise<string | null> {
  return (await readSetting(SPECIAL_KEY)) || null;
}

/** Marca la sed que ya venció. Se llama al abrir el jardín (no hay tareas
 *  programadas). Es idempotente: solo escribe en plantas sin sed, así que dos
 *  aperturas simultáneas dan el mismo resultado. La primera vez guarda
 *  `garden_care_since`: nadie empieza sediento al estrenar el cuidado. Nunca
 *  rompe la página. */
export async function settleThirst(at: Date = new Date()): Promise<void> {
  try {
    const t = at.toISOString();
    await db.execute(sql`
      INSERT INTO settings (key, value, updated_at) VALUES (${SINCE_KEY}, ${t}, ${t})
      ON CONFLICT (key) DO NOTHING
    `);
    const careSince = await readSetting(SINCE_KEY);
    const rows = await db.execute<{ id: string; visual_seed: number; started_at: string; completed_at: string | null; watered_at: string | null; thirsty_since: string | null }>(sql`
      SELECT p.id, p.visual_seed, p.started_at, p.completed_at, c.watered_at, c.thirsty_since
      FROM focus_plants p LEFT JOIN garden_plant_care c ON c.plant_id = p.id
    `);
    const due = dueThirst(
      rows.map((r) => ({ id: r.id, seed: r.visual_seed, arrivedAt: r.completed_at ?? r.started_at, wateredAt: r.watered_at, thirsty: !!r.thirsty_since })),
      at,
      careSince,
      await specialId(),
    );
    if (due.length === 0) return;
    const values = sql.join(due.map((d) => sql`(${d.id}, ${d.since})`), sql`, `);
    await db.execute(sql`
      INSERT INTO garden_plant_care (plant_id, thirsty_since, updated_at)
      SELECT v.id, v.since, ${t} FROM (VALUES ${values}) AS v(id, since)
      ON CONFLICT (plant_id) DO UPDATE SET thirsty_since = EXCLUDED.thirsty_since, updated_at = EXCLUDED.updated_at
      WHERE garden_plant_care.thirsty_since IS NULL
    `);
  } catch (err) {
    console.error("[jardín] no se pudo actualizar la sed:", err);
  }
}

/** Todo lo que el jardín necesita para pintar el cuidado. Si la base aún no
 *  tiene la migración 0004, devuelve el estado vacío: el jardín se ve como
 *  siempre y nada se rompe. */
export async function getCareState(at: Date = new Date()): Promise<CareState> {
  try {
    const rows = await db.select().from(schema.gardenPlantCare);
    const special = await specialId();
    const inv = await db
      .select({ item: schema.gardenRewards.item, n: count() })
      .from(schema.gardenRewards)
      .where(isNull(schema.gardenRewards.usedAt))
      .groupBy(schema.gardenRewards.item);
    const care: Record<string, PlantCare> = {};
    for (const r of rows) {
      const c: PlantCare = {
        thirsty: !!r.thirstySince && r.plantId !== special,
        fresh: !r.thirstySince && isFresh(r.wateredAt, at),
        fertilized: !!r.fertilizedAt,
        special: r.plantId === special,
      };
      if (c.thirsty || c.fresh || c.fertilized || c.special) care[r.plantId] = c;
    }
    if (special && !care[special]) care[special] = { ...NO_CARE, special: true };
    const n = (item: string) => Number(inv.find((x) => x.item === item)?.n ?? 0);
    return { care, specialId: special, inventory: { agua: n("agua"), fertilizante: n("fertilizante") } };
  } catch (err) {
    console.error("[jardín] no se pudo leer el cuidado:", err);
    return EMPTY_CARE;
  }
}

export type WaterResult =
  | { ok: true; rewardId: string; prevThirsty: string; prevWatered: string | null }
  | { ok: false; reason: "sin-sed" | "sin-agua" };

/** Riega una planta con sed gastando 1 Agua, en una sola sentencia. */
export async function waterPlant(plantId: string): Promise<WaterResult> {
  const t = now();
  const res = await db.execute<{ reward_id: string; prev_thirsty: string; prev_watered: string | null }>(sql`
    WITH target AS (
      SELECT plant_id, thirsty_since, watered_at FROM garden_plant_care
      WHERE plant_id = ${plantId} AND thirsty_since IS NOT NULL
      FOR UPDATE
    ),
    r AS (
      SELECT id FROM garden_rewards
      WHERE item = 'agua' AND used_at IS NULL AND EXISTS (SELECT 1 FROM target)
      ORDER BY earned_at, id LIMIT 1
      FOR UPDATE SKIP LOCKED
    ),
    u AS (
      UPDATE garden_rewards SET used_at = ${t}, used_on = ${plantId}
      WHERE id IN (SELECT id FROM r)
      RETURNING id
    )
    UPDATE garden_plant_care c SET thirsty_since = NULL, watered_at = ${t}, updated_at = ${t}
    FROM target
    WHERE c.plant_id = target.plant_id AND EXISTS (SELECT 1 FROM u)
    RETURNING (SELECT id FROM u) AS reward_id, target.thirsty_since AS prev_thirsty, target.watered_at AS prev_watered
  `);
  const row = res[0];
  if (row) return { ok: true, rewardId: row.reward_id, prevThirsty: row.prev_thirsty, prevWatered: row.prev_watered };
  const [care] = await db.select().from(schema.gardenPlantCare).where(eq(schema.gardenPlantCare.plantId, plantId));
  return { ok: false, reason: care?.thirstySince ? "sin-agua" : "sin-sed" };
}

/** Deshacer un riego: el Agua vuelve al inventario y la planta a su sed, solo
 *  si ese riego sigue siendo el último (la ficha está gastada en esa planta y
 *  la planta sigue hidratada). */
export async function undoWater(plantId: string, rewardId: string, prevThirsty: string, prevWatered: string | null): Promise<boolean> {
  const t = now();
  const res = await db.execute(sql`
    WITH u AS (
      UPDATE garden_rewards SET used_at = NULL, used_on = NULL
      WHERE id = ${rewardId} AND item = 'agua' AND used_on = ${plantId}
        AND EXISTS (SELECT 1 FROM garden_plant_care WHERE plant_id = ${plantId} AND thirsty_since IS NULL)
      RETURNING id
    )
    UPDATE garden_plant_care SET thirsty_since = ${prevThirsty}, watered_at = ${prevWatered}, updated_at = ${t}
    WHERE plant_id = ${plantId} AND EXISTS (SELECT 1 FROM u)
    RETURNING plant_id
  `);
  return res.length > 0;
}

export type FertilizeResult =
  | { ok: true; rewardId: string; prevSpecial: string | null; prevThirsty: string | null }
  | { ok: false; reason: "no-completada" | "ya-fertilizada" | "sin-fertilizante" };

/** Fertiliza una planta completada gastando 1 Fertilizante: desbloquea su
 *  versión especial y la vuelve la planta especial (la anterior solo deja de
 *  lucirse; conserva su desbloqueo). Una sola sentencia. */
export async function fertilizePlant(plantId: string): Promise<FertilizeResult> {
  const t = now();
  const res = await db.execute<{ reward_id: string; prev_special: string | null; prev_thirsty: string | null }>(sql`
    WITH plant AS (
      SELECT id FROM focus_plants
      WHERE id = ${plantId} AND completed_at IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM garden_plant_care WHERE plant_id = ${plantId} AND fertilized_at IS NOT NULL)
    ),
    pc AS (SELECT thirsty_since FROM garden_plant_care WHERE plant_id = ${plantId}),
    prev AS (SELECT value FROM settings WHERE key = ${SPECIAL_KEY}),
    r AS (
      SELECT id FROM garden_rewards
      WHERE item = 'fertilizante' AND used_at IS NULL AND EXISTS (SELECT 1 FROM plant)
      ORDER BY earned_at, id LIMIT 1
      FOR UPDATE SKIP LOCKED
    ),
    -- Primero la planta y luego la ficha: si otra petición fertilizó esta misma
    -- planta en paralelo, el upsert no hace nada y la ficha no se gasta.
    care AS (
      INSERT INTO garden_plant_care (plant_id, fertilized_at, updated_at)
      SELECT ${plantId}, ${t}, ${t} WHERE EXISTS (SELECT 1 FROM r)
      ON CONFLICT (plant_id) DO UPDATE SET fertilized_at = EXCLUDED.fertilized_at, thirsty_since = NULL, updated_at = EXCLUDED.updated_at
      WHERE garden_plant_care.fertilized_at IS NULL
      RETURNING plant_id
    ),
    u AS (
      UPDATE garden_rewards SET used_at = ${t}, used_on = ${plantId}
      WHERE id IN (SELECT id FROM r) AND EXISTS (SELECT 1 FROM care)
      RETURNING id
    )
    INSERT INTO settings (key, value, updated_at)
    SELECT ${SPECIAL_KEY}, ${plantId}, ${t} WHERE EXISTS (SELECT 1 FROM u)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
    RETURNING (SELECT id FROM u) AS reward_id, (SELECT value FROM prev) AS prev_special, (SELECT thirsty_since FROM pc) AS prev_thirsty
  `);
  const row = res[0];
  if (row) return { ok: true, rewardId: row.reward_id, prevSpecial: row.prev_special || null, prevThirsty: row.prev_thirsty };
  const [plant] = await db.select().from(schema.focusPlants).where(eq(schema.focusPlants.id, plantId));
  if (!plant?.completedAt) return { ok: false, reason: "no-completada" };
  const [care] = await db.select().from(schema.gardenPlantCare).where(eq(schema.gardenPlantCare.plantId, plantId));
  return { ok: false, reason: care?.fertilizedAt ? "ya-fertilizada" : "sin-fertilizante" };
}

/** Deshacer una fertilización: el Fertilizante vuelve al inventario, la planta
 *  pierde el desbloqueo (y recupera la sed que tuviera) y vuelve a lucirse la
 *  especial anterior, si la de ahora sigue siendo esta. */
export async function undoFertilize(plantId: string, rewardId: string, prevSpecial: string | null, prevThirsty: string | null): Promise<boolean> {
  const t = now();
  const res = await db.execute<{ n: number }>(sql`
    WITH ok AS (
      SELECT id FROM garden_rewards
      WHERE id = ${rewardId} AND item = 'fertilizante' AND used_on = ${plantId} AND used_at IS NOT NULL
    ),
    u AS (
      UPDATE garden_rewards SET used_at = NULL, used_on = NULL
      WHERE id IN (SELECT id FROM ok)
      RETURNING id
    ),
    c AS (
      UPDATE garden_plant_care SET fertilized_at = NULL, thirsty_since = ${prevThirsty}, updated_at = ${t}
      WHERE plant_id = ${plantId} AND EXISTS (SELECT 1 FROM ok)
      RETURNING plant_id
    ),
    s AS (
      UPDATE settings SET value = ${prevSpecial ?? ""}, updated_at = ${t}
      WHERE key = ${SPECIAL_KEY} AND value = ${plantId} AND EXISTS (SELECT 1 FROM ok)
      RETURNING key
    )
    SELECT (SELECT count(*) FROM u)::int AS n
  `);
  return (res[0]?.n ?? 0) > 0;
}

/** Elige cuál planta ya fertilizada se luce como especial (null = ninguna).
 *  Es gratis y no gasta nada. Devuelve la especial anterior, para Deshacer. */
export async function featurePlant(plantId: string | null): Promise<{ ok: boolean; prevSpecial: string | null }> {
  const prevSpecial = await specialId();
  const t = now();
  if (plantId === null) {
    await db.execute(sql`
      INSERT INTO settings (key, value, updated_at) VALUES (${SPECIAL_KEY}, '', ${t})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
    `);
    return { ok: true, prevSpecial };
  }
  const res = await db.execute(sql`
    WITH eligible AS (
      SELECT c.plant_id FROM garden_plant_care c JOIN focus_plants p ON p.id = c.plant_id
      WHERE c.plant_id = ${plantId} AND c.fertilized_at IS NOT NULL AND p.completed_at IS NOT NULL
    ),
    calm AS (
      UPDATE garden_plant_care SET thirsty_since = NULL, updated_at = ${t}
      WHERE plant_id IN (SELECT plant_id FROM eligible) AND thirsty_since IS NOT NULL
      RETURNING plant_id
    )
    INSERT INTO settings (key, value, updated_at)
    SELECT ${SPECIAL_KEY}, ${plantId}, ${t} WHERE EXISTS (SELECT 1 FROM eligible)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
    RETURNING key
  `);
  return { ok: res.length > 0, prevSpecial };
}
