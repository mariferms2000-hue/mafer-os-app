import { describe, expect, it } from "vitest";
import { pathHint, pathTitle } from "../src/components/progress/progress-copy";
import {
  gardenLink,
  rewardIdOf,
  undoneRewardToast,
  withProgress,
  TERMINADAS_LINK,
} from "../src/components/progress/progress-toast";

/* F3: qué muestra el toast al completar según lo que pasó con el progreso, y
 * los textos del camino hacia la próxima recompensa. */

const update = (extra: Record<string, unknown>) => ({
  progress: { delta: 1, count: 2, goal: 3, reward: null, rewardRevoked: false, ...extra },
});

describe("textos del camino", () => {
  it("título: «2 de 3 tareas»", () => {
    expect(pathTitle(0, 3)).toBe("0 de 3 tareas");
    expect(pathTitle(2, 3)).toBe("2 de 3 tareas");
    expect(pathTitle(1, 1)).toBe("1 de 1 tarea");
  });

  it("la frase dice cuánto falta, en palabras", () => {
    expect(pathHint(0, 3)).toBe("Tres tareas para tu próxima recompensa.");
    expect(pathHint(1, 3)).toBe("Dos más para tu próxima recompensa.");
    expect(pathHint(2, 3)).toBe("Una más para tu próxima recompensa.");
    expect(pathHint(0, 1)).toBe("Una tarea para tu próxima recompensa.");
    expect(pathHint(3, 3)).toBe("Tu recompensa ya está en tu inventario.");
    expect(pathHint(0, 12)).toBe("12 tareas para tu próxima recompensa.");
  });
});

describe("withProgress", () => {
  it("un punto nuevo deja el mensaje de siempre y añade el camino con la hoja nueva brotando", () => {
    expect(withProgress("Hecho ✓", update({}), TERMINADAS_LINK)).toEqual({
      message: "Hecho ✓",
      link: TERMINADAS_LINK,
      progress: { count: 2, goal: 3, grow: 1 },
    });
  });

  it("la recompensa pide la tarjeta especial y «Ver jardín» hacia la ficha ganada", () => {
    expect(withProgress("Hecho ✓", update({ count: 0, reward: { id: "r1", item: "agua" } }), TERMINADAS_LINK)).toEqual({
      message: "Hecho ✓",
      link: { label: "Ver jardín", href: "/biblioteca/jardin?recompensa=agua#recompensas-del-jardin" },
      reward: { item: "agua", label: "Agua", goal: 3 },
    });
    expect(withProgress("Hecho ✓", update({ count: 0, reward: { id: "r2", item: "fertilizante" } })).reward).toEqual({
      item: "fertilizante",
      label: "Fertilizante",
      goal: 3,
    });
    expect(gardenLink("fertilizante").href).toBe("/biblioteca/jardin?recompensa=fertilizante#recompensas-del-jardin");
  });

  it("si el progreso falló lo dice, con aviso y el texto propio si lo hay", () => {
    expect(withProgress("Tarea completada ✓", { progressFailed: true })).toEqual({
      tone: "warn",
      message: "Tarea completada ✓ · No se pudo actualizar el progreso.",
      link: undefined,
    });
    expect(withProgress("Hecho ✓", { progressFailed: true }, undefined, "✓ Hecho. No se pudo actualizar el progreso.").message).toBe(
      "✓ Hecho. No se pudo actualizar el progreso."
    );
  });

  it("sin punto nuevo (ya lo había dado, o no cuenta) queda el mensaje de siempre, sin camino", () => {
    expect(withProgress("Hecho ✓", update({ delta: 0 }))).toEqual({ message: "Hecho ✓", link: undefined });
    expect(withProgress("Hecho ✓", {})).toEqual({ message: "Hecho ✓", link: undefined });
    expect(withProgress("Hecho ✓", undefined)).toEqual({ message: "Hecho ✓", link: undefined });
  });
});

describe("Deshacer", () => {
  it("rewardIdOf da la recompensa de ese completado, o null", () => {
    expect(rewardIdOf(update({ reward: { id: "r1", item: "agua" } }))).toBe("r1");
    expect(rewardIdOf(update({}))).toBeNull();
    expect(rewardIdOf(null)).toBeNull();
  });

  it("solo hay aviso cuando se revocó la recompensa, con el camino como quedó", () => {
    expect(undoneRewardToast(update({ delta: -1, rewardRevoked: true }))).toEqual({
      tone: "info",
      message: "Recompensa deshecha",
      progress: { count: 2, goal: 3 },
    });
    expect(undoneRewardToast(update({ delta: -1 }))).toBeNull();
    expect(undoneRewardToast({})).toBeNull();
  });
});
