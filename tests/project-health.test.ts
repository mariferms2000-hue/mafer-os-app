import { describe, it, expect } from "vitest";
import { projectIssues, humanDate, type ProjectSignal } from "../src/lib/project-health";

const base: ProjectSignal = {
  hasNextAction: true,
  nextActionCompleted: false,
  overdue: 0,
  blocked: 0,
  oldestWaitingDays: null,
  inactiveDays: 0,
};

describe("projectIssues — qué necesita atención y por qué", () => {
  it("proyecto sano: sin problemas", () => {
    expect(projectIssues(base)).toEqual([]);
  });

  it("orden de urgencia: vencida > bloqueado > esperando > sin acción > inactivo", () => {
    const issues = projectIssues({
      hasNextAction: false,
      nextActionCompleted: false,
      overdue: 2,
      blocked: 1,
      oldestWaitingDays: 9,
      inactiveDays: 20,
    });
    expect(issues.map((i) => i.kind)).toEqual([
      "tarea-vencida",
      "bloqueado",
      "esperando-mucho",
      "sin-accion",
      "inactivo",
    ]);
    expect(issues[0].label).toBe("2 tareas vencidas");
  });

  it("umbrales: esperando avisa desde 7 días, inactivo desde 14", () => {
    expect(projectIssues({ ...base, oldestWaitingDays: 6 })).toEqual([]);
    expect(projectIssues({ ...base, oldestWaitingDays: 7 })[0].kind).toBe("esperando-mucho");
    expect(projectIssues({ ...base, inactiveDays: 13 })).toEqual([]);
    expect(projectIssues({ ...base, inactiveDays: 14 })[0].kind).toBe("inactivo");
  });

  it("siguiente acción completada: pide elegir otra (nunca se elige sola)", () => {
    const issues = projectIssues({ ...base, hasNextAction: false, nextActionCompleted: true });
    expect(issues[0].kind).toBe("sin-accion");
    expect(issues[0].label).toContain("se completó — elige otra");
  });

  it("una sola tarea vencida en singular", () => {
    expect(projectIssues({ ...base, overdue: 1 })[0].label).toBe("1 tarea vencida");
  });
});

describe("humanDate — fechas humanas", () => {
  const HOY = "2026-07-14";
  it("Hoy, Ayer, Hace N días y fecha corta", () => {
    expect(humanDate("2026-07-14T09:00:00Z", HOY)).toBe("Hoy");
    expect(humanDate("2026-07-13T22:00:00Z", HOY)).toBe("Ayer");
    expect(humanDate("2026-07-09T10:00:00Z", HOY)).toBe("Hace 5 días");
    expect(humanDate("2026-05-02T10:00:00Z", HOY)).toBe("2 may 2026");
    expect(humanDate(null, HOY)).toBe("sin registro");
  });
});
