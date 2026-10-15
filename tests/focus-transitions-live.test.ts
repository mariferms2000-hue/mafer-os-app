import { describe, expect, it } from "vitest";
import {
  initialState,
  recoverThenTransition,
  transition,
  type FocusAction,
  type FocusState,
} from "../src/lib/focus-logic";

/* Error real (oct 2026): al llegar a 0:00 con el Pomodoro abierto, la pantalla
 * pedía «completar-enfoque», pero el servidor ya había recuperado la sesión a
 * «enfoque-listo» y rechazaba la acción; la pantalla quedaba congelada en 0:00
 * y el siguiente botón mostraba «Algo salió mal». */

const T0 = "2026-10-15T15:00:00.000Z";
const at = (min: number, sec = 0) => new Date(Date.parse(T0) + (min * 60 + sec) * 1000).toISOString();
const pomodoro = () => initialState(25, 5, T0);

describe("recoverThenTransition — el bloque termina mientras llega la acción", () => {
  it("completar-enfoque a las 25:00 (o un poco después) pasa a enfoque-listo sin error", () => {
    for (const sec of [0, 1, 3, 30]) {
      const r = recoverThenTransition(pomodoro(), "completar-enfoque", at(25, sec));
      expect(r.state.phase).toBe("enfoque-listo");
      expect(r.state.elapsedFocusSeconds).toBe(25 * 60);
      expect(r.finished).toBeUndefined();
    }
  });

  it("antes era un error: la acción pedida no aplica a la fase recuperada", () => {
    const listo = recoverThenTransition(pomodoro(), "completar-enfoque", at(25, 1)).state;
    expect(() => transition(listo, "completar-enfoque", at(25, 1))).toThrow(/inválida/);
  });

  it("después, «Descansar» funciona y el descanso termina solo, abonando 25 una sola vez", () => {
    const listo = recoverThenTransition(pomodoro(), "completar-enfoque", at(25, 1)).state;
    const descanso = recoverThenTransition(listo, "empezar-descanso", at(26)).state;
    expect(descanso.phase).toBe("descanso");
    const fin = recoverThenTransition(descanso, "terminar-descanso", at(31, 2));
    expect(fin.finished).toEqual({ outcome: "completa", creditedMinutes: 25 });
  });

  it("Pausar o Terminar antes pulsados cuando el bloque ya terminó: muestra «enfoque-listo» con 25 min", () => {
    for (const action of ["pausar", "terminar-antes"] as FocusAction[]) {
      const r = recoverThenTransition(pomodoro(), action, at(26));
      expect(r.state.phase).toBe("enfoque-listo");
      expect(r.finished).toBeUndefined();
    }
  });

  it("Pausar durante el descanso cuando el descanso ya terminó: cierra el ciclo una vez", () => {
    const descanso: FocusState = { ...pomodoro(), phase: "descanso", phaseStartedAt: at(25), elapsedFocusSeconds: 1500 };
    const r = recoverThenTransition(descanso, "pausar", at(31));
    expect(r.finished).toEqual({ outcome: "completa", creditedMinutes: 25 });
  });

  it("Arranque (sin descanso): llegar a 0:00 cierra el ciclo completo", () => {
    const r = recoverThenTransition(initialState(5, 0, T0), "completar-enfoque", at(5, 1));
    expect(r.finished).toEqual({ outcome: "completa", creditedMinutes: 5 });
  });

  it("con tiempo restante todo sigue igual que antes", () => {
    expect(recoverThenTransition(pomodoro(), "pausar", at(10)).state.phase).toBe("pausado");
    expect(recoverThenTransition(pomodoro(), "terminar-antes", at(10)).finished).toEqual({
      outcome: "terminada-antes",
      creditedMinutes: 10,
    });
  });

  it("una acción inválida sin que el tiempo haya cambiado nada sigue siendo un error", () => {
    expect(() => recoverThenTransition(pomodoro(), "empezar-descanso", at(10))).toThrow(/inválida/);
    const listo: FocusState = { ...pomodoro(), phase: "enfoque-listo", elapsedFocusSeconds: 1500 };
    expect(() => recoverThenTransition(listo, "empezar-descanso", at(30))).not.toThrow();
    const desc = recoverThenTransition(listo, "empezar-descanso", at(30)).state;
    expect(() => recoverThenTransition(desc, "empezar-descanso", at(30, 5))).toThrow(/inválida/);
  });
});
