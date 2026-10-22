import { describe, expect, it } from "vitest";
import {
  LEAD_OPTIONS,
  avisoEventBody,
  avisoPausedReason,
  cardIdFromRef,
  desiredAviso,
  googleErrorMessage,
  normalizeLead,
  reviewAvisos,
  type CalendarEventLite,
  type ReviewCard,
} from "../src/lib/avisos/logic";

/* Bloque 3 (oct 2026): avisos de tareas en «Mafer OS · Avisos». */

const HOY = "2026-10-21";
const URL = "https://mafer-os-app.vercel.app";

function card(id: string, extra: Partial<ReviewCard> = {}): ReviewCard {
  return {
    id,
    title: `Tarea ${id}`,
    dueDate: "2026-10-23",
    startTime: "10:30",
    completedAt: null,
    archived: false,
    reminder: null,
    gcalEventId: null,
    ...extra,
  };
}

const ev = (id: string, ref: string | null, extra: Partial<CalendarEventLite> = {}): CalendarEventLite => ({
  id,
  summary: `Evento ${id}`,
  start: "2026-10-23T10:30:00",
  ref,
  aviso: false,
  ...extra,
});

describe("anticipación", () => {
  it("las cinco opciones aprobadas, «A la hora» por defecto", () => {
    expect(LEAD_OPTIONS.map((o) => o.minutes)).toEqual([0, 10, 30, 60, 1440]);
    expect(LEAD_OPTIONS[0].label).toBe("A la hora");
    expect(normalizeLead(undefined)).toBe(0);
    expect(normalizeLead("30")).toBe(30);
    expect(normalizeLead(45)).toBe(0); // fuera de la lista → a la hora
  });
});

describe("¿debe existir el aviso en Google?", () => {
  it("solo con «Avisarme», tarea abierta, fecha y hora", () => {
    const row = { leadMinutes: 10 };
    expect(desiredAviso(card("a"), row)).toEqual({ date: "2026-10-23", time: "10:30", lead: 10 });
    expect(desiredAviso(card("a"), null)).toBeNull(); // poner fecha/hora no enciende el aviso
    expect(desiredAviso(card("a", { completedAt: "2026-10-21T10:00:00Z" }), row)).toBeNull();
    expect(desiredAviso(card("a", { archived: true }), row)).toBeNull();
    expect(desiredAviso(card("a", { dueDate: null }), row)).toBeNull();
    expect(desiredAviso(card("a", { startTime: null }), row)).toBeNull();
  });

  it("explica por qué un aviso está en pausa", () => {
    expect(avisoPausedReason(card("a", { completedAt: "x" }))).toMatch(/completada/);
    expect(avisoPausedReason(card("a", { dueDate: null }))).toMatch(/Sin fecha/);
    expect(avisoPausedReason(card("a", { startTime: null }))).toMatch(/Sin hora/);
    expect(avisoPausedReason(card("a"))).toBeNull();
  });
});

describe("evento del aviso", () => {
  it("evento corto de 15 min, hora de México, alerta explícita y marcas verificables", () => {
    const b = avisoEventBody({ id: "c1", title: "Pagar la renta" }, { date: "2026-10-23", time: "10:30", lead: 30 }, URL);
    expect(b.summary).toBe("🔔 Pagar la renta");
    expect(b.start).toEqual({ dateTime: "2026-10-23T10:30:00", timeZone: "America/Mexico_City" });
    expect(b.end).toEqual({ dateTime: "2026-10-23T10:45:00", timeZone: "America/Mexico_City" });
    // nunca las alertas predeterminadas: en un calendario de la app suelen ser ninguna
    expect(b.reminders).toEqual({ useDefault: false, overrides: [{ method: "popup", minutes: 30 }] });
    expect(b.extendedProperties.private).toEqual({ maferOsRef: "card:c1", maferOsAviso: "1" });
    expect(b.transparency).toBe("transparent");
    expect(b.description).toContain(`${URL}/?abrir=c1`);
  });

  it("«A la hora» es alerta de 0 minutos y el fin cruza la medianoche sin romperse", () => {
    const b = avisoEventBody({ id: "c2", title: "x" }, { date: "2026-10-31", time: "23:50", lead: 0 }, URL);
    expect(b.reminders.overrides).toEqual([{ method: "popup", minutes: 0 }]);
    expect(b.end.dateTime).toBe("2026-11-01T00:05:00");
  });
});

describe("marcas", () => {
  it("solo `card:<id>` identifica una tarea", () => {
    expect(cardIdFromRef("card:abc")).toBe("abc");
    expect(cardIdFromRef("event:abc")).toBeNull();
    expect(cardIdFromRef("card:")).toBeNull();
    expect(cardIdFromRef(null)).toBeNull();
    expect(cardIdFromRef("test:123")).toBeNull();
  });
});

describe("revisión de recordatorios anteriores y fantasmas", () => {
  const cards = [
    card("vigente", { reminder: "gcal-timed", gcalEventId: "g1" }),
    card("sinhora", { reminder: "gcal-allday", startTime: null, gcalEventId: "g2" }),
    card("nunca", { reminder: "gcal-timed" }), // el error de antes: nunca llegó a Google
    card("pasada", { reminder: "gcal-timed", dueDate: "2026-10-01", gcalEventId: "g3" }),
    card("hecha", { reminder: "gcal-timed", completedAt: "2026-10-20T10:00:00Z", gcalEventId: "g4" }),
    card("archivada", { reminder: "gcal-timed", archived: true, gcalEventId: "g5" }),
    card("quitado", { reminder: null, gcalEventId: "g6" }),
    card("nuevo"), // ya usa «Avisarme»
  ];
  const maferOs = [
    ev("g1", "card:vigente"),
    ev("g2", "card:sinhora", { start: "2026-10-23" }),
    ev("g3", "card:pasada"),
    ev("g4", "card:hecha"),
    ev("g5", "card:archivada"),
    ev("g6", "card:quitado"),
    ev("g7", "card:borrada"),
    ev("g8", "card:vigente"), // repetido
    ev("compromiso", "event:e1"),
    ev("manual", null),
  ];
  const avisos = [
    ev("a1", "card:nuevo", { aviso: true }),
    ev("a2", "card:nuevo", { aviso: true }), // repetido
    ev("a3", "card:borrada", { aviso: true }),
    ev("prueba", "test:1", { aviso: true }),
  ];
  const r = reviewAvisos({
    today: HOY,
    cards,
    reminders: [{ cardId: "nuevo", gcalEventId: "a1" }],
    maferOsEvents: maferOs,
    avisosEvents: avisos,
  });

  it("mueve solo tareas abiertas con recordatorio anterior, con su evento actual", () => {
    expect(r.moves.map((m) => m.cardId)).toEqual(["vigente", "sinhora", "nunca", "pasada"]);
    const byId = Object.fromEntries(r.moves.map((m) => [m.cardId, m]));
    expect(byId.vigente.oldEvent?.id).toBe("g1");
    expect(byId.sinhora.setsTime).toBe(true); // se le propondrá 9:00
    expect(byId.nunca.oldEvent).toBeNull();
    expect(byId.pasada.paused).toBe(true);
  });

  it("fantasmas: solo eventos con marca de tarea, cada uno con su motivo", () => {
    const g = Object.fromEntries(r.ghosts.map((x) => [x.event.id, x.reason]));
    expect(Object.keys(g).sort()).toEqual(["a2", "a3", "g4", "g5", "g6", "g7", "g8"]);
    expect(g.g4).toMatch(/completada/);
    expect(g.g5).toMatch(/archivada/);
    expect(g.g6).toMatch(/ya no tiene recordatorio/);
    expect(g.g7).toMatch(/ya no existe/);
    expect(g.g8).toMatch(/repetido/i);
    expect(g.a2).toMatch(/repetido/i);
  });

  it("nunca propone compromisos, eventos sin marca, la prueba ni lo que se va a mover", () => {
    const ids = r.ghosts.map((x) => x.event.id);
    for (const id of ["compromiso", "manual", "prueba", "g1", "g2", "g3", "a1"]) expect(ids).not.toContain(id);
    expect(r.untouched).toEqual({ maferOs: 5, avisos: 2 }); // g1 g2 g3 compromiso manual · a1 prueba
  });

  it("describe cómo están guardados hoy los recordatorios", () => {
    expect(r.stats).toEqual({ legacyTimed: 5, legacyAllDay: 1, legacyWithGoogleId: 5, avisos: 1 });
  });
});

describe("mensajes de error", () => {
  it("entendibles y sin datos sensibles", () => {
    expect(googleErrorMessage({ message: "invalid_grant" })).toMatch(/volver a conectar/);
    expect(googleErrorMessage({ response: { status: 403 } })).toMatch(/limitó/);
    expect(googleErrorMessage({ message: "fetch failed" })).toMatch(/conexión/);
    expect(googleErrorMessage({ response: { status: 500 } })).toMatch(/código 500/);
    expect(googleErrorMessage(new Error("Fallo simulado de Google (modo de prueba)."))).toMatch(/simulado/);
  });
});
