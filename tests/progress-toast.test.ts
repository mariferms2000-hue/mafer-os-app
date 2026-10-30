import { describe, expect, it } from "vitest";
import { progressDots } from "../src/lib/progress/logic";
import { rewardIdOf, undoneRewardMessage, withProgress, GARDEN_LINK, TERMINADAS_LINK } from "../src/components/progress/progress-toast";

/* F3: lo que dice el toast al completar, según lo que pasó con el progreso. */

const update = (extra: Record<string, unknown>) => ({
  progress: { delta: 1, count: 2, goal: 3, reward: null, rewardRevoked: false, ...extra },
});

describe("progressDots", () => {
  it("pinta un punto por tarea, nunca más que la meta", () => {
    expect(progressDots(0, 3)).toBe("○○○");
    expect(progressDots(2, 3)).toBe("●●○");
    expect(progressDots(3, 3)).toBe("●●●");
    expect(progressDots(5, 3)).toBe("●●●");
    expect(progressDots(-1, 3)).toBe("○○○");
  });
});

describe("withProgress", () => {
  it("un punto nuevo añade la barra al mensaje de siempre", () => {
    expect(withProgress("Hecho ✓", update({}), TERMINADAS_LINK)).toEqual({
      message: "Hecho ✓ · ●●○ 2 de 3",
      link: TERMINADAS_LINK,
    });
  });

  it("la recompensa cambia el mensaje y lleva al Jardín", () => {
    expect(withProgress("Hecho ✓", update({ count: 0, reward: { id: "r1", item: "agua" } }), TERMINADAS_LINK)).toEqual({
      message: "Hecho ✓ · Ganaste Agua 💧",
      link: GARDEN_LINK,
    });
    expect(withProgress("Hecho ✓", update({ count: 0, reward: { id: "r2", item: "fertilizante" } })).message).toBe(
      "Hecho ✓ · Ganaste Fertilizante 🌱"
    );
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

  it("sin punto nuevo (ya lo había dado, o no cuenta) queda el mensaje de siempre", () => {
    expect(withProgress("Hecho ✓", update({ delta: 0 })).message).toBe("Hecho ✓");
    expect(withProgress("Hecho ✓", {}).message).toBe("Hecho ✓");
    expect(withProgress("Hecho ✓", undefined).message).toBe("Hecho ✓");
  });
});

describe("Deshacer", () => {
  it("rewardIdOf da la recompensa de ese completado, o null", () => {
    expect(rewardIdOf(update({ reward: { id: "r1", item: "agua" } }))).toBe("r1");
    expect(rewardIdOf(update({}))).toBeNull();
    expect(rewardIdOf(null)).toBeNull();
  });

  it("solo hay aviso cuando se revocó la recompensa", () => {
    expect(undoneRewardMessage(update({ delta: -1, rewardRevoked: true }))).toBe("Recompensa deshecha · ●●○ 2 de 3");
    expect(undoneRewardMessage(update({ delta: -1 }))).toBeNull();
    expect(undoneRewardMessage({})).toBeNull();
  });
});
