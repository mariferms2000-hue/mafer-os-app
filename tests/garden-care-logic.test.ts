import { describe, expect, it } from "vitest";
import { HYDRATED_DAYS, MAX_WATERINGS_PER_WEEK, NO_CARE, STAGGER_HOURS, careOptions, dueThirst, hydratedDays, isFresh, staggerMs } from "../src/lib/garden/care-logic";
import { REWARD_BAG, fullBag } from "../src/lib/progress/logic";

describe("sed por planta", () => {
  const DAY = 86_400_000;
  const T0 = "2026-11-01T12:00:00.000Z";
  const at = (days: number) => new Date(Date.parse(T0) + days * DAY);
  const p = (id: string, opts: Partial<{ seed: number; arrivedAt: string; wateredAt: string | null; thirsty: boolean }> = {}) => ({
    id,
    seed: opts.seed ?? 0,
    arrivedAt: opts.arrivedAt ?? T0,
    wateredAt: opts.wateredAt ?? null,
    thirsty: opts.thirsty ?? false,
  });

  it("una planta regada se mantiene hidratada HYDRATED_DAYS días (más su desfase)", () => {
    const plant = p("a", { wateredAt: T0 });
    expect(dueThirst([plant], at(HYDRATED_DAYS - 0.01), null, null)).toEqual([]);
    expect(dueThirst([plant], at(HYDRATED_DAYS + 2), null, null).map((x) => x.id)).toEqual(["a"]);
  });

  it("todas pueden tener sed a la vez: no hay tope", () => {
    const many = Array.from({ length: 6 }, (_, i) => p(`p${i}`));
    expect(dueThirst(many, at(30), null, null)).toHaveLength(6);
  });

  it("la especial y las que ya tienen sed no se vuelven a marcar", () => {
    expect(dueThirst([p("a"), p("b", { thirsty: true }), p("c")], at(30), null, "c").map((x) => x.id)).toEqual(["a"]);
  });

  it("al estrenar el cuidado nadie empieza sediento, aunque la planta sea antigua", () => {
    const old = p("viejo", { arrivedAt: "2025-01-01T00:00:00.000Z" });
    expect(dueThirst([old], at(1), T0, null)).toEqual([]);
    expect(dueThirst([old], at(10), T0, null)).toHaveLength(1);
  });

  it("el desfase escalona la sed y es estable por semilla", () => {
    expect(staggerMs(5)).toBe(staggerMs(5));
    expect(staggerMs(5)).not.toBe(staggerMs(600));
    expect(staggerMs(123456)).toBeLessThanOrEqual(STAGGER_HOURS * 3_600_000);
  });

  it("un jardín grande dura más hidratado: la demanda semanal nunca pasa del máximo", () => {
    for (const n of [1, 4, 8, 12, 40, 200]) {
      expect((n * 7) / hydratedDays(n)).toBeLessThanOrEqual(MAX_WATERINGS_PER_WEEK + 1e-9);
    }
    expect(hydratedDays(16)).toBe(HYDRATED_DAYS * 2);
  });

  it("recién regada dura FRESH_HOURS", () => {
    expect(isFresh(T0, new Date(Date.parse(T0) + 2 * 3_600_000))).toBe(true);
    expect(isFresh(T0, at(2))).toBe(false);
    expect(isFresh(null, at(0))).toBe(false);
  });
});

describe("opciones de cuidado", () => {
  const inv = { agua: 1, fertilizante: 1 };

  it("solo se riega con sed y con Agua en el inventario", () => {
    expect(careOptions({ ...NO_CARE, thirsty: true }, true, inv).canWater).toBe(true);
    expect(careOptions({ ...NO_CARE, thirsty: true }, true, { ...inv, agua: 0 }).canWater).toBe(false);
    expect(careOptions(NO_CARE, true, inv).canWater).toBe(false);
  });

  it("el Fertilizante solo va en plantas completadas y una sola vez por planta", () => {
    expect(careOptions(NO_CARE, false, inv).canFertilize).toBe(false);
    expect(careOptions(NO_CARE, true, inv).canFertilize).toBe(true);
    expect(careOptions({ ...NO_CARE, fertilized: true }, true, inv).canFertilize).toBe(false);
  });

  it("lucir o quitar la especial es gratis entre las ya fertilizadas", () => {
    const fert = { ...NO_CARE, fertilized: true };
    expect(careOptions(fert, true, { agua: 0, fertilizante: 0 }).canFeature).toBe(true);
    expect(careOptions({ ...fert, special: true }, true, inv)).toMatchObject({ canFeature: false, canUnfeature: true });
  });
});

describe("economía", () => {
  it("la bolsa es 5 Agua + 1 Fertilizante", () => {
    expect(REWARD_BAG).toEqual({ agua: 5, fertilizante: 1 });
    expect(fullBag().filter((x) => x === "agua")).toHaveLength(5);
  });

  it("un jardín bien cuidado pide como máximo 8 Agua por semana: unas 4 tareas al día", () => {
    const aguaPerTask = (1 / 3) * (REWARD_BAG.agua / (REWARD_BAG.agua + REWARD_BAG.fertilizante));
    const tasksPerDay = MAX_WATERINGS_PER_WEEK / aguaPerTask / 7;
    expect(MAX_WATERINGS_PER_WEEK).toBe(8);
    expect(tasksPerDay).toBeGreaterThan(3.5);
    expect(tasksPerDay).toBeLessThan(4.5);
  });
});
