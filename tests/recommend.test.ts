import { describe, it, expect } from "vitest";
import { recommendNow, buildForgetAlerts, diasEntre, type RecommendTask } from "../src/lib/recommend";

const HOY = "2026-07-14";

function tarea(partial: Partial<RecommendTask> & { id: string; title: string }): RecommendTask {
  return {
    duration: null,
    energy: null,
    dueDate: null,
    priority: "media",
    columnKind: "proximo",
    blockedReason: null,
    waitingFor: null,
    createdAt: "2026-07-01T10:00:00.000Z",
    ...partial,
  };
}

describe("recommendNow — «Haz esto ahora»", () => {
  it("la prioridad #1 manual gana y lo explica", () => {
    const r = recommendNow({
      tasks: [
        tarea({ id: "a", title: "Cualquiera", dueDate: HOY }),
        tarea({ id: "b", title: "Mi prioridad" }),
      ],
      dayEnergy: "media",
      priorityIds: ["b"],
      today: HOY,
    });
    expect(r[0].id).toBe("b");
    expect(r[0].reasons).toContain("es tu prioridad #1 de hoy");
  });

  it("lo vencido pesa más que lo normal y dice la fecha", () => {
    const r = recommendNow({
      tasks: [tarea({ id: "n", title: "Normal" }), tarea({ id: "v", title: "Vencida", dueDate: "2026-07-10" })],
      dayEnergy: "",
      priorityIds: [],
      today: HOY,
    });
    expect(r[0].id).toBe("v");
    expect(r[0].reasons.join(" ")).toContain("venció el 2026-07-10");
  });

  it("con energía baja prefiere tareas ligeras y cortas, y castiga las de energía alta", () => {
    const r = recommendNow({
      tasks: [
        tarea({ id: "pesada", title: "Redactar estrategia", energy: "high", duration: "over_60" }),
        tarea({ id: "ligera", title: "Enviar correo", energy: "low", duration: "under_10" }),
      ],
      dayEnergy: "baja",
      priorityIds: [],
      today: HOY,
    });
    expect(r[0].id).toBe("ligera");
    expect(r[0].reasons.join(" ")).toContain("energía baja");
    expect(r[0].reasons.join(" ")).toContain("menos de 10 minutos");
  });

  it("con energía alta prefiere trabajo profundo", () => {
    const r = recommendNow({
      tasks: [
        tarea({ id: "pesada", title: "Diseñar flujo", energy: "high", duration: "over_60" }),
        tarea({ id: "ligera", title: "Enviar correo", energy: "low", duration: "under_10" }),
      ],
      dayEnergy: "alta",
      priorityIds: [],
      today: HOY,
    });
    expect(r[0].id).toBe("pesada");
    expect(r[0].reasons.join(" ")).toContain("energía alta");
  });

  it("nunca recomienda bloqueadas, en espera ni pospuestas", () => {
    const r = recommendNow({
      tasks: [
        tarea({ id: "b", title: "Bloqueada", blockedReason: "espera pago", dueDate: "2026-07-01" }),
        tarea({ id: "w", title: "Esperando", waitingFor: "laboratorio", dueDate: "2026-07-01" }),
        tarea({ id: "d", title: "Pospuesta", columnKind: "despues", dueDate: "2026-07-01" }),
        tarea({ id: "ok", title: "Accionable" }),
      ],
      dayEnergy: "media",
      priorityIds: [],
      today: HOY,
    });
    expect(r.map((x) => x.id)).toEqual(["ok"]);
  });

  it("siempre hay al menos una razón, y sin tareas devuelve vacío", () => {
    const r = recommendNow({ tasks: [tarea({ id: "x", title: "Neutra" })], dayEnergy: "", priorityIds: [], today: HOY });
    expect(r[0].reasons.length).toBeGreaterThan(0);
    expect(recommendNow({ tasks: [], dayEnergy: "alta", priorityIds: [], today: HOY })).toEqual([]);
  });
});

describe("buildForgetAlerts — antiolvido", () => {
  const base = { today: HOY, tasks: [], projects: [], inbox: [], priorityIds: [] };

  it("tarea vencida única enlaza directo a la tarea", () => {
    const alerts = buildForgetAlerts({
      ...base,
      tasks: [{ ...tarea({ id: "v", title: "Pagar tenencia", dueDate: "2026-07-01" }), updatedAt: "2026-07-01T00:00:00Z" }],
    });
    expect(alerts[0].kind).toBe("tarea-vencida");
    expect(alerts[0].text).toContain("Pagar tenencia");
    expect(alerts[0].href).toBe("/tareas?abrir=v");
  });

  it("esperando ≥7 días avisa con los días; menos de 7 no", () => {
    const conDias = (updatedAt: string) =>
      buildForgetAlerts({
        ...base,
        tasks: [{ ...tarea({ id: "w", title: "Respuesta del lab", waitingFor: "laboratorio" }), updatedAt }],
      });
    expect(conDias("2026-07-01T00:00:00Z")[0]?.kind).toBe("esperando-mucho");
    expect(conDias("2026-07-01T00:00:00Z")[0]?.text).toContain("13 días");
    expect(conDias("2026-07-10T00:00:00Z")).toHaveLength(0);
  });

  it("proyecto activo sin siguiente acción y proyecto inactivo ≥14 días", () => {
    const alerts = buildForgetAlerts({
      ...base,
      projects: [
        { id: "p1", title: "Sin rumbo", nextAction: "", lastActivity: "2026-07-13T00:00:00Z" },
        { id: "p2", title: "Dormido", nextAction: "Escribir guion", lastActivity: "2026-06-20T00:00:00Z" },
      ],
    });
    const kinds = alerts.map((a) => a.kind);
    expect(kinds).toContain("proyecto-sin-accion");
    expect(kinds).toContain("proyecto-inactivo");
    expect(alerts.find((a) => a.kind === "proyecto-inactivo")?.text).toContain("Dormido");
  });

  it("tarea de hoy (o prioridad) sin duración o energía", () => {
    const alerts = buildForgetAlerts({
      ...base,
      tasks: [
        { ...tarea({ id: "h", title: "De hoy", dueDate: HOY, duration: null, energy: "low" }), updatedAt: `${HOY}T08:00:00Z` },
        { ...tarea({ id: "p", title: "Prioridad sin nada" }), updatedAt: `${HOY}T08:00:00Z` },
      ],
      priorityIds: ["p"],
    });
    const a = alerts.find((x) => x.kind === "hoy-sin-estimar");
    expect(a?.text).toContain("2 tareas de hoy");
  });

  it("inbox: solo avisa cuando la captura más antigua tiene ≥3 días", () => {
    const vieja = buildForgetAlerts({ ...base, inbox: [{ id: "i", createdAt: "2026-07-10T00:00:00Z" }] });
    expect(vieja[0]?.kind).toBe("inbox-olvidado");
    expect(vieja[0]?.text).toContain("4 días");
    const nueva = buildForgetAlerts({ ...base, inbox: [{ id: "i", createdAt: `${HOY}T08:00:00Z` }] });
    expect(nueva).toHaveLength(0);
  });

  it("limita y ordena por urgencia (vencidas primero) sin saturar", () => {
    const alerts = buildForgetAlerts({
      today: HOY,
      tasks: [
        { ...tarea({ id: "v", title: "Vencida", dueDate: "2026-07-01" }), updatedAt: "2026-07-01T00:00:00Z" },
        { ...tarea({ id: "w1", title: "Espera 1", waitingFor: "a" }), updatedAt: "2026-06-01T00:00:00Z" },
        { ...tarea({ id: "w2", title: "Espera 2", waitingFor: "b" }), updatedAt: "2026-06-01T00:00:00Z" },
      ],
      projects: [
        { id: "p1", title: "Sin acción 1", nextAction: "", lastActivity: "2026-06-01T00:00:00Z" },
        { id: "p2", title: "Sin acción 2", nextAction: "", lastActivity: "2026-06-01T00:00:00Z" },
      ],
      inbox: [{ id: "i", createdAt: "2026-07-01T00:00:00Z" }],
      priorityIds: [],
    });
    expect(alerts.length).toBeLessThanOrEqual(5);
    expect(alerts[0].kind).toBe("tarea-vencida");
  });

  it("diasEntre cuenta días de calendario", () => {
    expect(diasEntre("2026-07-10T23:00:00Z", HOY)).toBe(4);
    expect(diasEntre(`${HOY}T01:00:00Z`, HOY)).toBe(0);
  });
});
