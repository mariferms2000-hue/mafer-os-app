import { describe, it, expect } from "vitest";
import { mondayOf, dailyPending, weeklyPending, reviewNudge } from "../src/lib/review-logic";

describe("mondayOf — semana lunes a domingo", () => {
  it("calcula el lunes de la semana", () => {
    expect(mondayOf("2026-07-15")).toBe("2026-07-13"); // miércoles
    expect(mondayOf("2026-07-13")).toBe("2026-07-13"); // lunes
    expect(mondayOf("2026-07-19")).toBe("2026-07-13"); // domingo pertenece a la semana anterior al lunes 20
    expect(mondayOf("2026-07-20")).toBe("2026-07-20");
  });
});

describe("dailyPending — una vez al día, sin insistir", () => {
  it("pendiente si hoy no se ha completado", () => {
    expect(dailyPending("2026-07-15", null)).toBe(true);
    expect(dailyPending("2026-07-15", "2026-07-14")).toBe(true);
    expect(dailyPending("2026-07-15", "2026-07-15")).toBe(false);
  });
});

describe("weeklyPending — una vez por semana, con día configurable", () => {
  const HOY_MIERCOLES = "2026-07-15";
  it("sin día configurado: pendiente si no se hizo esta semana", () => {
    expect(weeklyPending(HOY_MIERCOLES, null, null)).toBe(true);
    expect(weeklyPending(HOY_MIERCOLES, "2026-07-10", null)).toBe(true); // semana pasada
    expect(weeklyPending(HOY_MIERCOLES, "2026-07-13", null)).toBe(false); // este lunes
  });
  it("con día configurado: solo se sugiere a partir de ese día", () => {
    // hoy miércoles (3): configurado viernes (5) → aún no
    expect(weeklyPending(HOY_MIERCOLES, null, 5)).toBe(false);
    // configurado lunes (1) → sí
    expect(weeklyPending(HOY_MIERCOLES, null, 1)).toBe(true);
    // configurado miércoles (3) → sí (hoy mismo)
    expect(weeklyPending(HOY_MIERCOLES, null, 3)).toBe(true);
    // configurado domingo (0): el domingo es el último día de la semana → aún no en miércoles
    expect(weeklyPending(HOY_MIERCOLES, null, 0)).toBe(false);
    expect(weeklyPending("2026-07-19", null, 0)).toBe(true); // domingo
  });
  it("hecha esta semana gana aunque el día configurado ya pasó", () => {
    expect(weeklyPending(HOY_MIERCOLES, "2026-07-14", 1)).toBe(false);
  });
});

describe("reviewNudge — UN solo aviso en Hoy", () => {
  it("prioridad: incompleta > semanal pendiente > diaria pendiente", () => {
    expect(
      reviewNudge({ unfinishedDaily: true, unfinishedWeekly: true, dailyIsPending: true, weeklyIsPending: true })
    ).toBe("continuar-semanal");
    expect(
      reviewNudge({ unfinishedDaily: true, unfinishedWeekly: false, dailyIsPending: true, weeklyIsPending: true })
    ).toBe("continuar-diaria");
    expect(
      reviewNudge({ unfinishedDaily: false, unfinishedWeekly: false, dailyIsPending: true, weeklyIsPending: true })
    ).toBe("semanal");
    expect(
      reviewNudge({ unfinishedDaily: false, unfinishedWeekly: false, dailyIsPending: true, weeklyIsPending: false })
    ).toBe("diaria");
    expect(
      reviewNudge({ unfinishedDaily: false, unfinishedWeekly: false, dailyIsPending: false, weeklyIsPending: false })
    ).toBe(null);
  });
});
