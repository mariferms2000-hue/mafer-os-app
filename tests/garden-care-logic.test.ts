import { describe, expect, it } from "vitest";
import { MAX_THIRSTY, NO_CARE, THIRST_INTERVAL_MS, careOptions, pickThirsty, planThirst } from "../src/lib/garden/care-logic";
import { REWARD_BAG, fullBag } from "../src/lib/progress/logic";

const T0 = new Date("2026-11-01T12:00:00.000Z");
const after = (intervals: number, extraMs = 0) => new Date(T0.getTime() + intervals * THIRST_INTERVAL_MS + extraMs);

describe("reloj de sed", () => {
  it("la primera vez arranca el reloj sin dar sed", () => {
    expect(planThirst(null, T0, 0)).toEqual({ clock: T0.toISOString(), newlyThirsty: 0 });
  });

  it("un reloj ilegible o en el futuro se reinicia sin castigo", () => {
    expect(planThirst("no-es-fecha", T0, 0)).toEqual({ clock: T0.toISOString(), newlyThirsty: 0 });
    expect(planThirst(after(2).toISOString(), T0, 0)).toEqual({ clock: T0.toISOString(), newlyThirsty: 0 });
  });

  it("antes de un intervalo completo no pasa nada", () => {
    expect(planThirst(T0.toISOString(), after(0, THIRST_INTERVAL_MS - 1), 0)).toBeNull();
  });

  it("cada intervalo da sed a una planta y el reloj avanza en intervalos enteros", () => {
    expect(planThirst(T0.toISOString(), after(1, 5000), 0)).toEqual({ clock: after(1).toISOString(), newlyThirsty: 1 });
  });

  it("nunca más de MAX_THIRSTY a la vez, y lo que no cabe se descarta (no se acumula)", () => {
    expect(planThirst(T0.toISOString(), after(10), 0)).toEqual({ clock: after(10).toISOString(), newlyThirsty: MAX_THIRSTY });
    expect(planThirst(T0.toISOString(), after(10), 1)?.newlyThirsty).toBe(1);
    expect(planThirst(T0.toISOString(), after(10), 2)).toEqual({ clock: after(10).toISOString(), newlyThirsty: 0 });
  });
});

describe("a quién le toca la sed", () => {
  const c = (id: string, lastCare: string, thirsty = false) => ({ id, lastCare, thirsty });

  it("la que lleva más tiempo sin cuidado, sin repetir las que ya tienen sed ni la especial", () => {
    const list = [c("a", "2026-10-05"), c("b", "2026-10-01"), c("c", "2026-09-01", true), c("d", "2026-09-15")];
    expect(pickThirsty(list, 2, "d")).toEqual(["b", "a"]);
  });

  it("empates por id: el resultado es estable", () => {
    expect(pickThirsty([c("z", "2026-10-01"), c("m", "2026-10-01")], 1, null)).toEqual(["m"]);
  });

  it("n = 0 no marca nada", () => {
    expect(pickThirsty([c("a", "2026-10-01")], 0, null)).toEqual([]);
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

  it("el Agua ganada alcanza la sed máxima posible a un ritmo de 6 tareas por semana", () => {
    const tasksPerWeek = 6;
    const aguaPerWeek = (tasksPerWeek / 3) * (REWARD_BAG.agua / (REWARD_BAG.agua + REWARD_BAG.fertilizante));
    const thirstPerWeek = 7 / (THIRST_INTERVAL_MS / 86_400_000);
    expect(aguaPerWeek).toBeGreaterThanOrEqual(thirstPerWeek - 1e-9);
  });
});
