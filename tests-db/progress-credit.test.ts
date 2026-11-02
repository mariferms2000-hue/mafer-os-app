import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq, inArray, like } from "drizzle-orm";
import { db, now, schema } from "@/lib/db";
import { creditCompletion, progressAfterChange, revokeCompletion } from "@/lib/progress/credit";
import { parseBag } from "@/lib/progress/logic";

/* Progreso por tareas completadas contra la base de pruebas (mafer_e2e).
 * La barra y la bolsa son globales, así que cada prueba empieza con
 * progress_credits, garden_rewards y la bolsa vacíos — es la base de pruebas,
 * que además se vacía entera antes de cada corrida de E2E. */

const P = "PROG DB";
let n = 0;

async function tarea(opts: { completed?: boolean; starter?: boolean; projectStarter?: boolean } = {}): Promise<string> {
  const id = `progdb-${++n}-${crypto.randomUUID().slice(0, 8)}`;
  const t = now();
  let projectId: string | null = null;
  if (opts.projectStarter) {
    projectId = `${id}-p`;
    await db.insert(schema.projects).values({ id: projectId, title: `${P} proyecto`, isStarter: true, createdAt: t, updatedAt: t });
  }
  await db.insert(schema.cards).values({
    id,
    title: `${P} ${n}`,
    projectId,
    isStarter: opts.starter ?? false,
    completedAt: opts.completed === false ? null : t,
    createdAt: t,
    updatedAt: t,
  });
  return id;
}

const setCompleted = (id: string, done: boolean) =>
  db.update(schema.cards).set({ completedAt: done ? now() : null }).where(eq(schema.cards.id, id));
const creditOf = async (id: string) =>
  (await db.select().from(schema.progressCredits).where(eq(schema.progressCredits.cardId, id)))[0] ?? null;
const rewards = () => db.select().from(schema.gardenRewards);
const bag = async () =>
  parseBag((await db.select().from(schema.settings).where(eq(schema.settings.key, "progress_reward_bag")))[0]?.value);

/** Completa (en la base) y acredita, como hace completeCardAction. */
async function completar(id: string, rng?: () => number) {
  await setCompleted(id, true);
  return creditCompletion(id, rng);
}

async function limpiar() {
  await db.delete(schema.progressCredits);
  await db.delete(schema.gardenRewards);
  await db.delete(schema.settings).where(eq(schema.settings.key, "progress_reward_bag"));
  await db.delete(schema.cards).where(like(schema.cards.title, `${P}%`));
  await db.delete(schema.projects).where(like(schema.projects.title, `${P}%`));
}

beforeEach(limpiar);
afterAll(limpiar);

describe("un punto por tarea, para siempre", () => {
  it("acreditar dos veces la misma tarea suma una sola vez", async () => {
    const a = await tarea();
    expect(await creditCompletion(a)).toMatchObject({ delta: 1, count: 1, goal: 3, reward: null });
    expect(await creditCompletion(a)).toMatchObject({ delta: 0, count: 1 });
    expect(await db.select().from(schema.progressCredits)).toHaveLength(1);
  });

  it("reabrir con el punto en la barra lo quita; completar de nuevo lo devuelve una vez", async () => {
    const a = await tarea({ completed: false });
    expect(await completar(a)).toMatchObject({ delta: 1, count: 1 });
    await setCompleted(a, false);
    expect(await revokeCompletion(a)).toMatchObject({ delta: -1, count: 0 });
    expect(await creditOf(a)).toBeNull();
    expect(await completar(a)).toMatchObject({ delta: 1, count: 1 });
    expect(await completar(a)).toMatchObject({ delta: 0, count: 1 });
  });

  it("dos acreditaciones simultáneas de la misma tarea dejan un solo crédito", async () => {
    const a = await tarea();
    const res = await Promise.all([creditCompletion(a), creditCompletion(a), creditCompletion(a)]);
    expect(res.map((r) => r?.delta).sort()).toEqual([0, 0, 1]);
    expect(await db.select().from(schema.progressCredits)).toHaveLength(1);
  });

  it("eliminar la tarea conserva su crédito y no permite volver a ganarlo", async () => {
    const a = await tarea();
    await creditCompletion(a);
    await db.delete(schema.cards).where(eq(schema.cards.id, a));
    expect(await creditOf(a)).toMatchObject({ kind: "tarea" });
    expect(await creditCompletion(a)).toBeNull();
    expect(await db.select().from(schema.progressCredits)).toHaveLength(1);
  });
});

describe("lo que nunca cuenta", () => {
  it("una tarea 'previa' (completada antes del lanzamiento) no suma ni al reabrir y completar", async () => {
    const a = await tarea();
    await db.insert(schema.progressCredits).values({ cardId: a, kind: "previa", rewardId: null, creditedAt: now() });
    await setCompleted(a, false);
    expect(await revokeCompletion(a)).toBeNull();
    expect(await completar(a)).toMatchObject({ delta: 0, count: 0 });
    expect(await creditOf(a)).toMatchObject({ kind: "previa" });
  });

  it("tareas de ejemplo, o de un proyecto de ejemplo, no cuentan", async () => {
    expect(await creditCompletion(await tarea({ starter: true }))).toBeNull();
    expect(await creditCompletion(await tarea({ projectStarter: true }))).toBeNull();
    expect(await db.select().from(schema.progressCredits)).toHaveLength(0);
  });

  it("una tarea abierta o inexistente no acredita", async () => {
    expect(await creditCompletion(await tarea({ completed: false }))).toBeNull();
    expect(await creditCompletion("progdb-no-existe")).toBeNull();
    expect(await db.select().from(schema.progressCredits)).toHaveLength(0);
  });

  it("sin cambio de estado, progressAfterChange no toca nada", async () => {
    const a = await tarea();
    expect(await progressAfterChange(a, true, true)).toEqual({});
    expect(await progressAfterChange(a, false, false)).toEqual({});
    expect(await db.select().from(schema.progressCredits)).toHaveLength(0);
    expect(await progressAfterChange(a, false, true)).toMatchObject({ progress: { delta: 1, count: 1 } });
  });
});

describe("recompensas", () => {
  it("el tercer punto gana una recompensa, consume los tres y la barra vuelve a 0", async () => {
    const [a, b, c] = [await tarea(), await tarea(), await tarea()];
    await creditCompletion(a);
    expect(await creditCompletion(b)).toMatchObject({ count: 2, reward: null });
    const res = await creditCompletion(c);
    expect(res).toMatchObject({ delta: 1, count: 0 });
    expect(res?.reward).not.toBeNull();
    const all = await rewards();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ id: res!.reward!.id, item: res!.reward!.item, usedAt: null });
    const credits = await db.select().from(schema.progressCredits).where(inArray(schema.progressCredits.cardId, [a, b, c]));
    expect(credits.every((cr) => cr.rewardId === res!.reward!.id)).toBe(true);
    expect(await bag()).toHaveLength(5);
  });

  it("un punto ya gastado no se quita al reabrir y no se vuelve a ganar", async () => {
    const [a, b, c] = [await tarea(), await tarea(), await tarea()];
    for (const id of [a, b, c]) await creditCompletion(id);
    await setCompleted(a, false);
    expect(await revokeCompletion(a)).toMatchObject({ delta: 0, count: 0, rewardRevoked: false });
    expect(await creditOf(a)).not.toBeNull();
    expect(await completar(a)).toMatchObject({ delta: 0, count: 0 });
    expect(await rewards()).toHaveLength(1);
  });

  it("Deshacer el tercer completado revoca la recompensa, devuelve 2 puntos y rehacer gana la MISMA", async () => {
    const [a, b, c] = [await tarea(), await tarea(), await tarea()];
    await creditCompletion(a);
    await creditCompletion(b);
    const won = (await creditCompletion(c))!.reward!;
    const bagAfterWin = await bag();

    await setCompleted(c, false);
    expect(await revokeCompletion(c, won.id)).toMatchObject({ delta: -1, count: 2, rewardRevoked: true });
    expect(await rewards()).toHaveLength(0);
    expect(await creditOf(c)).toBeNull();
    expect((await creditOf(a))?.rewardId).toBeNull();
    expect((await creditOf(b))?.rewardId).toBeNull();
    expect(await bag()).toEqual([won.item, ...bagAfterWin]);

    // el generador no puede intervenir: la ficha ya está al frente de la bolsa
    const again = await completar(c, () => {
      throw new Error("no debería barajar");
    });
    expect(again?.reward?.item).toBe(won.item);
    expect(await bag()).toEqual(bagAfterWin);
  });

  it("Deshacer conserva la recompensa si ya no es la más reciente", async () => {
    const ids = [];
    for (let i = 0; i < 6; i++) ids.push(await tarea());
    let first: string | null = null;
    for (const [i, id] of ids.entries()) {
      const r = await creditCompletion(id);
      if (i === 2) first = r!.reward!.id;
    }
    expect(await rewards()).toHaveLength(2);
    await setCompleted(ids[2], false);
    expect(await revokeCompletion(ids[2], first)).toMatchObject({ delta: 0, rewardRevoked: false });
    expect(await rewards()).toHaveLength(2);
  });

  it("Deshacer conserva la recompensa si ya se usó", async () => {
    const [a, b, c] = [await tarea(), await tarea(), await tarea()];
    await creditCompletion(a);
    await creditCompletion(b);
    const won = (await creditCompletion(c))!.reward!;
    await db.update(schema.gardenRewards).set({ usedAt: now() }).where(eq(schema.gardenRewards.id, won.id));
    await setCompleted(c, false);
    expect(await revokeCompletion(c, won.id)).toMatchObject({ delta: 0, rewardRevoked: false });
    expect(await rewards()).toHaveLength(1);
    expect(await creditOf(c)).not.toBeNull();
  });

  it("tres completados simultáneos con la barra en 0 dan exactamente una recompensa", async () => {
    const ids = [await tarea(), await tarea(), await tarea()];
    const res = await Promise.all(ids.map((id) => creditCompletion(id)));
    expect(res.filter((r) => r?.reward)).toHaveLength(1);
    expect(await rewards()).toHaveLength(1);
    expect(await db.select().from(schema.progressCredits)).toHaveLength(3);
  });

  it("6 recompensas seguidas con el azar real dan 5 de agua y 1 de fertilizante", async () => {
    for (let i = 0; i < 18; i++) await creditCompletion(await tarea());
    const all = await rewards();
    expect(all).toHaveLength(6);
    expect(all.filter((r) => r.item === "agua")).toHaveLength(5);
    expect(all.filter((r) => r.item === "fertilizante")).toHaveLength(1);
    expect(await bag()).toHaveLength(0);
  });
});
