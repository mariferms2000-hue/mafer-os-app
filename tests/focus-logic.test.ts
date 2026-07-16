import { describe, expect, it } from "vitest";
import {
  PRESETS,
  CUSTOM_FOCUS_MIN,
  CUSTOM_FOCUS_MAX,
  clampCustomFocus,
  STAGES,
  PLANT_COMPLETE_MINUTES,
  plantStage,
  nextStageInfo,
  applyMinutesToPlant,
  initialState,
  transition,
  recover,
  focusElapsedSeconds,
  focusRemainingSeconds,
  breakRemainingSeconds,
  creditedMinutes,
  formatClock,
  type FocusState,
} from "../src/lib/focus-logic";

/** Fase 7B — el motor de Focus Garden es puro: cada prueba fija sus relojes. */

const T0 = "2026-07-16T10:00:00.000Z";
const at = (minutes: number, seconds = 0) =>
  new Date(Date.parse(T0) + (minutes * 60 + seconds) * 1000).toISOString();

const pomodoro = () => initialState(25, 5, T0);

describe("presets y personalizado", () => {
  it("los cuatro presets aprobados existen con sus tiempos", () => {
    expect(PRESETS.arranque).toMatchObject({ focusMin: 5, breakMin: 0 });
    expect(PRESETS.ligero).toMatchObject({ focusMin: 15, breakMin: 5 });
    expect(PRESETS.pomodoro).toMatchObject({ focusMin: 25, breakMin: 5 });
    expect(PRESETS.profundo).toMatchObject({ focusMin: 45, breakMin: 10 });
  });

  it("personalizado se acota a [5, 90] y redondea", () => {
    expect(clampCustomFocus(1)).toBe(CUSTOM_FOCUS_MIN);
    expect(clampCustomFocus(400)).toBe(CUSTOM_FOCUS_MAX);
    expect(clampCustomFocus(32.6)).toBe(33);
    expect(clampCustomFocus(NaN)).toBe(CUSTOM_FOCUS_MIN);
  });
});

describe("iniciar", () => {
  it("una sesión nueva empieza en enfoque con cero acumulado", () => {
    const s = pomodoro();
    expect(s.phase).toBe("enfoque");
    expect(focusElapsedSeconds(s, T0)).toBe(0);
    expect(focusRemainingSeconds(s, T0)).toBe(25 * 60);
  });

  it("el tiempo corre solo por timestamps: a los 10 minutos quedan 15", () => {
    const s = pomodoro();
    expect(focusRemainingSeconds(s, at(10))).toBe(15 * 60);
  });
});

describe("pausar y reanudar", () => {
  it("pausar consolida lo transcurrido y congela el contador", () => {
    const { state: paused } = transition(pomodoro(), "pausar", at(10));
    expect(paused.phase).toBe("pausado");
    expect(paused.elapsedFocusSeconds).toBe(600);
    // media hora en pausa no suma nada
    expect(focusElapsedSeconds(paused, at(40))).toBe(600);
  });

  it("reanudar continúa exactamente donde iba, sin perder segundos", () => {
    const { state: paused } = transition(pomodoro(), "pausar", at(10, 30));
    const { state: resumed } = transition(paused, "reanudar", at(50));
    expect(resumed.phase).toBe("enfoque");
    // 10:30 antes de la pausa + 4:30 después = 15:00
    expect(focusElapsedSeconds(resumed, at(54, 30))).toBe(15 * 60);
  });

  it("pausar el descanso también congela y reanuda", () => {
    const { state: done } = transition(pomodoro(), "completar-enfoque", at(25));
    const { state: resting } = transition(done, "empezar-descanso", at(25));
    const { state: pausedBreak } = transition(resting, "pausar", at(27));
    expect(pausedBreak.phase).toBe("descanso-pausado");
    expect(pausedBreak.elapsedBreakSeconds).toBe(120);
    const { state: resumed } = transition(pausedBreak, "reanudar", at(60));
    expect(breakRemainingSeconds(resumed, at(61))).toBe(2 * 60);
  });
});

describe("terminar antes", () => {
  it("conserva los minutos reales trabajados (nunca se pierden)", () => {
    const { state, finished } = transition(pomodoro(), "terminar-antes", at(12, 40));
    expect(finished?.outcome).toBe("terminada-antes");
    expect(finished?.creditedMinutes).toBe(12); // 12:40 → 12 min completos
    expect(state.elapsedFocusSeconds).toBe(12 * 60 + 40);
  });

  it("también es válido terminar antes estando en pausa", () => {
    const { state: paused } = transition(pomodoro(), "pausar", at(8));
    const { finished } = transition(paused, "terminar-antes", at(30));
    expect(finished?.creditedMinutes).toBe(8);
  });
});

describe("completar el enfoque y descanso", () => {
  it("al completar pasa a enfoque-listo sin cerrar (hay descanso disponible)", () => {
    const { state, finished } = transition(pomodoro(), "completar-enfoque", at(25));
    expect(state.phase).toBe("enfoque-listo");
    expect(finished).toBeUndefined();
  });

  it("Arranque (sin descanso) cierra completo directamente al completar", () => {
    const s = initialState(5, 0, T0);
    const { finished } = transition(s, "completar-enfoque", at(5));
    expect(finished?.outcome).toBe("completa");
    expect(finished?.creditedMinutes).toBe(5);
  });

  it("saltar el descanso cierra el ciclo completo", () => {
    const { state: done } = transition(pomodoro(), "completar-enfoque", at(25));
    const { finished } = transition(done, "saltar-descanso", at(25, 5));
    expect(finished?.outcome).toBe("completa");
    expect(finished?.creditedMinutes).toBe(25);
  });

  it("el descanso completo también cierra con outcome completa", () => {
    const { state: done } = transition(pomodoro(), "completar-enfoque", at(25));
    const { state: resting } = transition(done, "empezar-descanso", at(26));
    const { finished } = transition(resting, "terminar-descanso", at(31));
    expect(finished?.outcome).toBe("completa");
  });

  it("el descanso nunca abona minutos a la planta", () => {
    const { state: done } = transition(pomodoro(), "completar-enfoque", at(25));
    const { state: resting } = transition(done, "empezar-descanso", at(26));
    const { finished } = transition(resting, "terminar-descanso", at(31));
    expect(finished?.creditedMinutes).toBe(25); // solo el enfoque
  });
});

describe("recuperación tras cerrar Safari", () => {
  it("si el bloque expiró cerrado, pasa a enfoque-listo acreditando SOLO lo planeado", () => {
    // sesión de 25 abierta hace 3 horas
    const { state, finished } = recover(pomodoro(), at(180));
    expect(state.phase).toBe("enfoque-listo");
    expect(state.elapsedFocusSeconds).toBe(25 * 60); // honesto: nunca más de lo planeado
    expect(finished).toBeUndefined(); // hay descanso disponible: la sesión sigue viva
  });

  it("sin descanso planeado, la recuperación cierra la sesión completa", () => {
    const s = initialState(5, 0, T0);
    const { finished } = recover(s, at(240));
    expect(finished?.outcome).toBe("completa");
    expect(finished?.creditedMinutes).toBe(5);
  });

  it("un descanso que terminó solo mientras el navegador estaba cerrado cierra el ciclo", () => {
    const { state: done } = transition(pomodoro(), "completar-enfoque", at(25));
    const { state: resting } = transition(done, "empezar-descanso", at(25));
    const { finished } = recover(resting, at(120));
    expect(finished?.outcome).toBe("completa");
  });

  it("una sesión pausada se conserva tal cual: pausar es válido y no caduca", () => {
    const { state: paused } = transition(pomodoro(), "pausar", at(10));
    const { state, finished } = recover(paused, at(600)); // 10 horas después
    expect(state.phase).toBe("pausado");
    expect(finished).toBeUndefined();
    expect(focusElapsedSeconds(state, at(600))).toBe(600);
  });

  it("una sesión en curso sin expirar continúa donde iba", () => {
    const { state } = recover(pomodoro(), at(10));
    expect(state.phase).toBe("enfoque");
    expect(focusRemainingSeconds(state, at(10))).toBe(15 * 60);
  });
});

describe("cambios de reloj y límites de tiempo", () => {
  it("un reloj que retrocede nunca produce tiempo negativo", () => {
    const s = pomodoro();
    const antes = "2026-07-16T09:00:00.000Z"; // una hora ANTES de empezar
    expect(focusElapsedSeconds(s, antes)).toBe(0);
    expect(focusRemainingSeconds(s, antes)).toBe(25 * 60);
  });

  it("un salto de reloj gigante se acota al tiempo planeado", () => {
    const s = pomodoro();
    expect(focusElapsedSeconds(s, "2027-01-01T00:00:00.000Z")).toBe(25 * 60);
  });

  it("timestamps corruptos no rompen el cálculo", () => {
    const s: FocusState = { ...pomodoro(), phaseStartedAt: "no-es-fecha" };
    expect(focusElapsedSeconds(s, at(10))).toBe(0);
  });

  it("el acumulado consolidado también se acota al plan (defensa en profundidad)", () => {
    const s: FocusState = { ...pomodoro(), phase: "pausado", elapsedFocusSeconds: 99999 };
    expect(creditedMinutes(s, T0)).toBe(25);
  });

  it("las acciones inválidas para la fase lanzan error explícito", () => {
    expect(() => transition(pomodoro(), "empezar-descanso", at(1))).toThrow(/inválida/);
    const { state: paused } = transition(pomodoro(), "pausar", at(5));
    expect(() => transition(paused, "pausar", at(6))).toThrow(/inválida/);
  });
});

describe("crecimiento de la planta", () => {
  it("las cinco etapas aprobadas: 0/25/75/150/300", () => {
    expect(STAGES.map((s) => s.minMinutes)).toEqual([0, 25, 75, 150, 300]);
    expect(plantStage(0)).toBe("semilla");
    expect(plantStage(24)).toBe("semilla");
    expect(plantStage(25)).toBe("brote");
    expect(plantStage(75)).toBe("hojas");
    expect(plantStage(149)).toBe("hojas");
    expect(plantStage(150)).toBe("planta-joven");
    expect(plantStage(300)).toBe("planta-completa");
    expect(plantStage(9999)).toBe("planta-completa");
  });

  it("explica con transparencia cuánto falta para la siguiente etapa", () => {
    expect(nextStageInfo(0)).toEqual({ key: "brote", missingMinutes: 25 });
    expect(nextStageInfo(110)).toEqual({ key: "planta-joven", missingMinutes: 40 });
    expect(nextStageInfo(300)).toBeNull();
  });

  it("acumula sin reiniciar: el progreso nunca retrocede ni caduca", () => {
    let acc = 0;
    for (const add of [10, 0, 40, 5]) acc = applyMinutesToPlant(acc, add).accumulated;
    expect(acc).toBe(55);
    expect(plantStage(acc)).toBe("brote");
  });

  it("los minutos negativos o fraccionales no corrompen la planta", () => {
    expect(applyMinutesToPlant(50, -10).accumulated).toBe(50);
    expect(applyMinutesToPlant(50, 9.9).accumulated).toBe(59);
  });
});

describe("formatClock (presentación del contador)", () => {
  it("formatea m:ss con cero a la izquierda en segundos", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(59)).toBe("0:59");
    expect(formatClock(60)).toBe("1:00");
    expect(formatClock(25 * 60)).toBe("25:00");
    expect(formatClock(90 * 60)).toBe("90:00");
    expect(formatClock(754)).toBe("12:34");
  });

  it("nunca muestra tiempo negativo", () => {
    expect(formatClock(-30)).toBe("0:00");
  });
});

describe("planta completa y semilla nueva", () => {
  it("al llegar a 300 se completa y nace una semilla con el excedente", () => {
    const res = applyMinutesToPlant(290, 25);
    expect(res.completed).toBe(true);
    expect(res.accumulated).toBe(PLANT_COMPLETE_MINUTES); // se guarda con exactamente 300
    expect(res.overflow).toBe(15); // ningún minuto se pierde: pasa a la nueva
  });

  it("llegar exacto a 300 completa con excedente cero", () => {
    const res = applyMinutesToPlant(275, 25);
    expect(res.completed).toBe(true);
    expect(res.overflow).toBe(0);
  });

  it("por debajo del umbral no se completa", () => {
    const res = applyMinutesToPlant(200, 99);
    expect(res.completed).toBe(false);
    expect(res.accumulated).toBe(299);
  });
});
