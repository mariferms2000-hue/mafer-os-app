import { describe, expect, it } from "vitest";
import {
  PROGRESS_GOAL,
  REWARD_BAG,
  drawReward,
  fullBag,
  parseBag,
  progressView,
  reachesGoal,
  returnReward,
  shuffle,
  type RewardItem,
} from "../src/lib/progress/logic";

/* Progreso por tareas completadas (oct 2026): meta, bolsa de recompensas y
 * Deshacer sin «volver a tirar». */

/** Generador determinista (mulberry32) para que las pruebas no dependan del azar. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const count = (bag: RewardItem[], item: RewardItem) => bag.filter((i) => i === item).length;

describe("meta", () => {
  it("la meta inicial es 3", () => {
    expect(PROGRESS_GOAL).toBe(3);
  });

  it("solo el punto que llega a la meta da recompensa", () => {
    expect(reachesGoal(0)).toBe(false);
    expect(reachesGoal(2)).toBe(false);
    expect(reachesGoal(3)).toBe(true);
    // si algún día la meta baja, lo que ya había alcanza
    expect(reachesGoal(4, 3)).toBe(true);
    expect(reachesGoal(4, 5)).toBe(false);
    expect(reachesGoal(5, 0)).toBe(false);
  });

  it("la barra nunca muestra más puntos que la meta ni negativos", () => {
    expect(progressView(2)).toEqual({ count: 2, goal: 3 });
    expect(progressView(7)).toEqual({ count: 3, goal: 3 });
    expect(progressView(-1)).toEqual({ count: 0, goal: 3 });
  });
});

describe("bolsa de recompensas", () => {
  it("una bolsa completa trae exactamente 5 de agua y 1 de fertilizante (F4)", () => {
    expect(REWARD_BAG).toEqual({ agua: 5, fertilizante: 1 });
    const bag = fullBag();
    expect(bag).toHaveLength(6);
    expect(count(bag, "agua")).toBe(5);
    expect(count(bag, "fertilizante")).toBe(1);
  });

  it("barajar conserva el contenido y es determinista con el mismo generador", () => {
    const a = shuffle(fullBag(), seeded(7));
    const b = shuffle(fullBag(), seeded(7));
    expect(a).toEqual(b);
    expect([...a].sort()).toEqual([...fullBag()].sort());
  });

  it("barajar tolera un generador que devuelve el extremo superior", () => {
    const out = shuffle(fullBag(), () => 0.9999999999);
    expect([...out].sort()).toEqual([...fullBag()].sort());
  });

  it("cada bolsa de 6 recompensas da siempre 5 + 1, en muchas semillas", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rng = seeded(seed);
      let bag: RewardItem[] = [];
      for (let ronda = 0; ronda < 3; ronda++) {
        const sacadas: RewardItem[] = [];
        for (let i = 0; i < 6; i++) {
          const r = drawReward(bag, rng);
          sacadas.push(r.item);
          bag = r.rest;
        }
        expect(count(sacadas, "agua")).toBe(5);
        expect(count(sacadas, "fertilizante")).toBe(1);
        expect(bag).toHaveLength(0);
      }
    }
  });

  it("una bolsa vacía se rellena barajada; una con fichas saca la primera sin barajar", () => {
    const fromEmpty = drawReward([], seeded(3));
    expect(fromEmpty.rest).toHaveLength(5);
    const r = drawReward(["fertilizante", "agua"], () => {
      throw new Error("no debería barajar");
    });
    expect(r).toEqual({ item: "fertilizante", rest: ["agua"] });
  });

  it("Deshacer devuelve la ficha al principio: rehacer saca la MISMA", () => {
    const rng = seeded(11);
    const first = drawReward([], rng);
    const back = returnReward(first.rest, first.item);
    expect(back).toHaveLength(6);
    const again = drawReward(back, rng);
    expect(again.item).toBe(first.item);
    expect(again.rest).toEqual(first.rest);
  });

  it("parseBag descarta valores ilegibles o fichas desconocidas", () => {
    expect(parseBag(null)).toEqual([]);
    expect(parseBag("")).toEqual([]);
    expect(parseBag("{no es json")).toEqual([]);
    expect(parseBag('{"agua":1}')).toEqual([]);
    expect(parseBag('["agua","oro",3,"fertilizante"]')).toEqual(["agua", "fertilizante"]);
  });
});
