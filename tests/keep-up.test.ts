import { describe, expect, it } from "vitest";
import { buildKeepUp, PROJECT_IDLE_DAYS } from "../src/lib/keep-up";
import type { CardRow } from "../src/lib/queries/today";

/* «Para que nada se caiga» en Hoy (Bloque 2): cada tarea aparece UNA vez, en
 * su grupo más urgente. Antes «Testimonial» salía en alertas y en Bloqueado, y
 * «Avisar a Michael» en alertas y en Esperando. */

const HOY = "2026-10-11";

function card(id: string, extra: Partial<CardRow> = {}): CardRow {
  return {
    id,
    title: `Tarea ${id}`,
    dueDate: null,
    blockedReason: "",
    waitingFor: "",
    columnKind: "proximo",
    updatedAt: `${HOY}T10:00:00.000Z`,
    projectTitle: null,
    ...extra,
  } as CardRow;
}

describe("buildKeepUp", () => {
  it("una tarea vencida Y bloqueada Y en espera aparece solo en Vencidas", () => {
    const r = buildKeepUp({
      today: HOY,
      open: [card("a", { dueDate: "2026-10-09", blockedReason: "x", waitingFor: "Ana" })],
      projects: [],
    });
    expect(r.overdue.map((c) => c.id)).toEqual(["a"]);
    expect(r.blocked).toHaveLength(0);
    expect(r.waiting).toHaveLength(0);
  });

  it("bloqueada gana a esperando (el caso «Testimonial»)", () => {
    const r = buildKeepUp({
      today: HOY,
      open: [card("t", { blockedReason: "No contactar todavía", waitingFor: "José Luis" })],
      projects: [],
    });
    expect(r.blocked.map((c) => c.id)).toEqual(["t"]);
    expect(r.waiting).toHaveLength(0);
  });

  it("la lista Bloqueado y la lista Esperando cuentan aunque no haya texto", () => {
    const r = buildKeepUp({
      today: HOY,
      open: [card("b", { columnKind: "bloqueado" }), card("w", { columnKind: "esperando" })],
      projects: [],
    });
    expect(r.blocked.map((c) => c.id)).toEqual(["b"]);
    expect(r.waiting.map((c) => c.id)).toEqual(["w"]);
  });

  it("esperando: días de espera calculados y las más antiguas primero", () => {
    const r = buildKeepUp({
      today: HOY,
      open: [
        card("nueva", { waitingFor: "A", updatedAt: "2026-10-10T10:00:00.000Z" }),
        card("vieja", { waitingFor: "B", updatedAt: "2026-09-07T10:00:00.000Z" }),
      ],
      projects: [],
    });
    expect(r.waiting.map((c) => [c.id, c.waitingDays])).toEqual([
      ["vieja", 34],
      ["nueva", 1],
    ]);
  });

  it("próximas: de mañana a 7 días, ordenadas; lo de hoy queda para la Agenda", () => {
    const r = buildKeepUp({
      today: HOY,
      open: [
        card("hoy", { dueDate: HOY }),
        card("en5", { dueDate: "2026-10-16" }),
        card("manana", { dueDate: "2026-10-12" }),
        card("en9", { dueDate: "2026-10-20" }),
      ],
      projects: [],
    });
    expect(r.upcoming.map((c) => c.id)).toEqual(["manana", "en5"]);
    expect(r.overdue).toHaveLength(0);
  });

  it("vencidas ordenadas de la más antigua a la más reciente", () => {
    const r = buildKeepUp({
      today: HOY,
      open: [card("b", { dueDate: "2026-10-10" }), card("a", { dueDate: "2026-10-01" })],
      projects: [],
    });
    expect(r.overdue.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("un proyecto sin siguiente acción y quieto sale UNA vez con ambos motivos", () => {
    const r = buildKeepUp({
      today: HOY,
      open: [],
      projects: [
        { id: "j", title: "Journal", hasNextAction: false, lastActivity: "2026-07-11T10:00:00.000Z" },
        { id: "ok", title: "Al día", hasNextAction: true, lastActivity: `${HOY}T08:00:00.000Z` },
        { id: "s", title: "Sin acción", hasNextAction: false, lastActivity: `${HOY}T08:00:00.000Z` },
      ],
    });
    expect(r.projects).toEqual([
      { id: "j", title: "Journal", noNextAction: true, idleDays: 92 },
      { id: "s", title: "Sin acción", noNextAction: true, idleDays: null },
    ]);
  });

  it(`un proyecto con actividad hace menos de ${PROJECT_IDLE_DAYS} días no se marca como quieto`, () => {
    const r = buildKeepUp({
      today: HOY,
      open: [],
      projects: [{ id: "p", title: "P", hasNextAction: true, lastActivity: "2026-09-30T10:00:00.000Z" }],
    });
    expect(r.projects).toHaveLength(0);
  });

  it("sin nada que vigilar, todo vacío", () => {
    const r = buildKeepUp({ today: HOY, open: [card("x")], projects: [] });
    expect(r).toEqual({ overdue: [], blocked: [], waiting: [], upcoming: [], projects: [] });
  });
});
