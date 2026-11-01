import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq, inArray, like } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { featurePlant, fertilizePlant, getCareState, settleThirst, undoFertilize, undoWater, waterPlant } from "@/lib/garden/care";
import { HYDRATED_DAYS } from "@/lib/garden/care-logic";

/* Cuidado del Jardín (F4) contra la base de pruebas (mafer_e2e). El cuidado es
 * global (reloj de sed, planta especial), así que cada prueba empieza con
 * garden_plant_care, las recompensas y esos ajustes vacíos. Las plantas de
 * prueba llevan el prefijo «care-» y se borran al final. */

const P = "care-";
const KEYS = ["garden_care_since", "garden_special_plant"];
let n = 0;

async function plant(opts: { completed?: boolean; daysAgo?: number } = {}): Promise<string> {
  const id = `${P}${++n}-${crypto.randomUUID().slice(0, 6)}`;
  const t = new Date(Date.now() - (opts.daysAgo ?? 1) * 86_400_000).toISOString();
  await db.insert(schema.focusPlants).values({
    id,
    species: "lavanda",
    accumulatedMinutes: opts.completed === false ? 40 : 150,
    visualSeed: n,
    rendererVersion: 2,
    startedAt: t,
    completedAt: opts.completed === false ? null : t,
  });
  return id;
}

async function give(item: "agua" | "fertilizante", count = 1) {
  for (let i = 0; i < count; i++) {
    await db.insert(schema.gardenRewards).values({ id: `${P}r-${crypto.randomUUID()}`, item, earnedAt: new Date().toISOString() });
  }
}

async function thirsty(id: string) {
  const t = new Date().toISOString();
  await db.insert(schema.gardenPlantCare).values({ plantId: id, thirstySince: t, updatedAt: t }).onConflictDoUpdate({ target: schema.gardenPlantCare.plantId, set: { thirstySince: t } });
}

const unused = async (item: string) =>
  (await db.select().from(schema.gardenRewards)).filter((r) => r.item === item && !r.usedAt).length;
const careRow = async (id: string) => (await db.select().from(schema.gardenPlantCare).where(eq(schema.gardenPlantCare.plantId, id)))[0] ?? null;

async function clean() {
  await db.delete(schema.gardenPlantCare);
  await db.delete(schema.gardenRewards);
  await db.delete(schema.settings).where(inArray(schema.settings.key, KEYS));
  await db.delete(schema.focusPlants).where(like(schema.focusPlants.id, `${P}%`));
}

beforeEach(clean);
afterAll(clean);

describe("Agua", () => {
  it("regar gasta 1 Agua, quita la sed y nunca toca minutos ni etapas", async () => {
    const id = await plant();
    await thirsty(id);
    await give("agua", 2);
    const res = await waterPlant(id);
    expect(res.ok).toBe(true);
    expect(await unused("agua")).toBe(1);
    expect((await careRow(id))?.thirstySince).toBeNull();
    const [p] = await db.select().from(schema.focusPlants).where(eq(schema.focusPlants.id, id));
    expect(p.accumulatedMinutes).toBe(150);
  });

  it("sin sed o sin Agua no pasa nada (ni se gasta Agua)", async () => {
    const id = await plant();
    await give("agua");
    expect(await waterPlant(id)).toEqual({ ok: false, reason: "sin-sed" });
    expect(await unused("agua")).toBe(1);
    const dry = await plant();
    await thirsty(dry);
    await db.delete(schema.gardenRewards);
    expect(await waterPlant(dry)).toEqual({ ok: false, reason: "sin-agua" });
    expect((await careRow(dry))?.thirstySince).not.toBeNull();
  });

  it("dos riegos simultáneos con 1 Agua: solo uno se cumple", async () => {
    const a = await plant();
    const b = await plant();
    await thirsty(a);
    await thirsty(b);
    await give("agua");
    const [ra, rb] = await Promise.all([waterPlant(a), waterPlant(b)]);
    expect([ra.ok, rb.ok].filter(Boolean)).toHaveLength(1);
    expect(await unused("agua")).toBe(0);
  });

  it("Deshacer devuelve el Agua y la sed tal como estaban", async () => {
    const id = await plant();
    await thirsty(id);
    await give("agua");
    const res = await waterPlant(id);
    if (!res.ok) throw new Error("debía regar");
    expect(await undoWater(id, res.rewardId, res.prevThirsty, res.prevWatered)).toBe(true);
    expect(await unused("agua")).toBe(1);
    expect((await careRow(id))?.thirstySince).toBe(res.prevThirsty);
    // y no se puede deshacer dos veces
    expect(await undoWater(id, res.rewardId, res.prevThirsty, res.prevWatered)).toBe(false);
  });
});

describe("sed por planta", () => {
  const DAY = 86_400_000;

  it("la primera apertura estrena el cuidado: nadie empieza sediento", async () => {
    await plant({ daysAgo: 90 });
    await settleThirst(new Date());
    expect(Object.values((await getCareState()).care).some((c) => c.thirsty)).toBe(false);
  });

  it("pasado su tiempo hidratadas, todas pueden tener sed a la vez", async () => {
    const ids = [await plant({ daysAgo: 30 }), await plant({ daysAgo: 30 }), await plant({ daysAgo: 30 }), await plant({ daysAgo: 30 })];
    const start = new Date(Date.now() - (HYDRATED_DAYS + 3) * DAY);
    await settleThirst(start);
    await settleThirst(new Date());
    const care = (await getCareState()).care;
    expect(ids.every((id) => care[id]?.thirsty)).toBe(true);
    // y repetir no cambia nada (idempotente)
    await settleThirst(new Date());
    expect(Object.values((await getCareState()).care).filter((c) => c.thirsty)).toHaveLength(4);
  });

  it("regar la deja hidratada y recién regada; no vuelve a tener sed hasta su tiempo", async () => {
    const id = await plant();
    await thirsty(id);
    await give("agua");
    await waterPlant(id);
    await settleThirst(new Date());
    expect((await getCareState()).care[id]).toMatchObject({ thirsty: false, fresh: true });
  });

  it("la planta especial nunca tiene sed", async () => {
    const a = await plant({ daysAgo: 90 });
    await give("fertilizante");
    expect((await fertilizePlant(a)).ok).toBe(true);
    await settleThirst(new Date(Date.now() - (HYDRATED_DAYS + 3) * DAY));
    await settleThirst(new Date());
    expect((await getCareState()).care[a]?.thirsty).toBeFalsy();
  });
});

describe("Fertilizante y planta especial", () => {
  it("solo en plantas completadas", async () => {
    const growing = await plant({ completed: false });
    await give("fertilizante");
    expect(await fertilizePlant(growing)).toEqual({ ok: false, reason: "no-completada" });
    expect(await unused("fertilizante")).toBe(1);
  });

  it("una sola especial a la vez; cambiar entre las ya fertilizadas es gratis", async () => {
    const a = await plant();
    const b = await plant();
    await give("fertilizante", 2);
    expect((await fertilizePlant(a)).ok).toBe(true);
    expect((await fertilizePlant(b)).ok).toBe(true);
    let state = await getCareState();
    expect(state.specialId).toBe(b);
    expect(Object.values(state.care).filter((c) => c.special)).toHaveLength(1);
    expect(state.care[a]).toMatchObject({ fertilized: true, special: false });

    expect((await featurePlant(a)).ok).toBe(true);
    state = await getCareState();
    expect(state.specialId).toBe(a);
    expect(state.inventory.fertilizante).toBe(0);
    expect(await fertilizePlant(a)).toEqual({ ok: false, reason: "ya-fertilizada" });

    await featurePlant(null);
    expect((await getCareState()).specialId).toBeNull();
  });

  it("no se puede lucir como especial una planta sin fertilizar", async () => {
    const a = await plant();
    expect((await featurePlant(a)).ok).toBe(false);
  });

  it("Deshacer devuelve el Fertilizante y la especial anterior", async () => {
    const a = await plant();
    const b = await plant();
    await give("fertilizante", 2);
    await fertilizePlant(a);
    const res = await fertilizePlant(b);
    if (!res.ok) throw new Error("debía fertilizar");
    expect(res.prevSpecial).toBe(a);
    expect(await undoFertilize(b, res.rewardId, res.prevSpecial, res.prevThirsty)).toBe(true);
    const state = await getCareState();
    expect(state.specialId).toBe(a);
    expect(state.inventory.fertilizante).toBe(1);
    expect(state.care[b]?.fertilized).toBeFalsy();
  });
});
