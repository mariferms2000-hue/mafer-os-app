import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

/* Un fallo del progreso nunca rompe la tarea: progressAfterChange lo atrapa y
 * devuelve `progressFailed` para que la interfaz lo diga. Aquí la base acepta
 * lecturas pero toda escritura del progreso falla (`realDb` queda intacta
 * para preparar y limpiar). */

vi.mock("@/lib/db", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/db")>();
  const broken = () => {
    throw new Error("escritura simulada fallida");
  };
  const db = new Proxy(mod.db, {
    get(target, key, receiver) {
      if (key === "insert" || key === "update" || key === "delete" || key === "execute") return broken;
      return Reflect.get(target, key, receiver);
    },
  });
  return { ...mod, db, realDb: mod.db };
});

const dbModule = (await import("@/lib/db")) as typeof import("@/lib/db") & { realDb: typeof import("@/lib/db").db };
const { realDb, now, schema } = dbModule;
const { progressAfterChange } = await import("@/lib/progress/credit");

const NUEVA = `progfail-a-${crypto.randomUUID().slice(0, 8)}`;
const CON_PUNTO = `progfail-b-${crypto.randomUUID().slice(0, 8)}`;

beforeAll(async () => {
  const t = now();
  for (const id of [NUEVA, CON_PUNTO]) {
    await realDb.insert(schema.cards).values({ id, title: "PROG FAIL", completedAt: t, createdAt: t, updatedAt: t });
  }
  await realDb.insert(schema.progressCredits).values({ cardId: CON_PUNTO, kind: "tarea", rewardId: null, creditedAt: t });
});
afterAll(async () => {
  for (const id of [NUEVA, CON_PUNTO]) {
    await realDb.delete(schema.progressCredits).where(eq(schema.progressCredits.cardId, id));
    await realDb.delete(schema.cards).where(eq(schema.cards.id, id));
  }
});

describe("fallo del progreso", () => {
  it("completar con la escritura fallida devuelve progressFailed, sin lanzar ni guardar el punto", async () => {
    await expect(progressAfterChange(NUEVA, false, true)).resolves.toEqual({ progressFailed: true });
    const rows = await realDb.select().from(schema.progressCredits).where(eq(schema.progressCredits.cardId, NUEVA));
    expect(rows).toHaveLength(0);
  });

  it("reabrir con la escritura fallida devuelve progressFailed y el punto sigue ahí", async () => {
    await expect(progressAfterChange(CON_PUNTO, true, false)).resolves.toEqual({ progressFailed: true });
    const rows = await realDb.select().from(schema.progressCredits).where(eq(schema.progressCredits.cardId, CON_PUNTO));
    expect(rows).toHaveLength(1);
  });
});
