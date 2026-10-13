import { describe, expect, it } from "vitest";
import { buildWeekAgenda, currentWeekTaskIds, parseWeekParam, weekStartOf, type AgendaEvent } from "../src/lib/week-agenda";
import { buildKeepUp } from "../src/lib/keep-up";
import type { CardRow } from "../src/lib/queries/today";

/* Agenda semanal de Hoy (oct 2026): de lunes a domingo, eventos + tareas
 * pendientes con fecha, sin repetir lo que ya está en «Para que nada se caiga». */

const HOY = "2026-10-14"; // miércoles
const LUNES = "2026-10-12";

function card(id: string, extra: Partial<CardRow> = {}): CardRow {
  return {
    id,
    title: `Tarea ${id}`,
    dueDate: null,
    startTime: null,
    gcalEventId: null,
    blockedReason: "",
    waitingFor: "",
    columnKind: "proximo",
    updatedAt: `${HOY}T10:00:00.000Z`,
    projectTitle: null,
    ...extra,
  } as CardRow;
}

function ev(id: string, date: string, extra: Partial<AgendaEvent> = {}): AgendaEvent {
  return { id, title: `Evento ${id}`, date, startTime: null, endTime: null, type: "evento", gcalEventId: null, ...extra };
}

const ids = (items: { kind: string; event?: { id: string }; card?: { id: string } }[]) =>
  items.map((i) => (i.kind === "evento" ? `e:${i.event!.id}` : `t:${i.card!.id}`));

describe("weekStartOf / parseWeekParam", () => {
  it("la semana empieza en lunes, también si hoy es domingo", () => {
    expect(weekStartOf("2026-10-14")).toBe(LUNES);
    expect(weekStartOf("2026-10-12")).toBe(LUNES);
    expect(weekStartOf("2026-10-18")).toBe(LUNES);
    expect(weekStartOf("2026-10-19")).toBe("2026-10-19");
  });

  it("un parámetro inválido vuelve a la semana actual; uno válido se lleva a su lunes", () => {
    expect(parseWeekParam(undefined, HOY)).toBe(LUNES);
    expect(parseWeekParam("hola", HOY)).toBe(LUNES);
    expect(parseWeekParam("2026-10-21", HOY)).toBe("2026-10-19");
  });
});

describe("buildWeekAgenda", () => {
  it("siete días de lunes a domingo, con hoy marcado", () => {
    const a = buildWeekAgenda({ today: HOY, weekStart: LUNES, events: [], open: [] });
    expect(a.days.map((d) => d.date)).toEqual([
      "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18",
    ]);
    expect(a.days.filter((d) => d.isToday).map((d) => d.date)).toEqual([HOY]);
    expect(a.days.filter((d) => d.isPast).length).toBe(2);
    expect(a.isCurrentWeek).toBe(true);
  });

  it("incluye eventos y tareas de la semana, y nada de fuera", () => {
    const a = buildWeekAgenda({
      today: HOY,
      weekStart: LUNES,
      events: [ev("jue", "2026-10-15"), ev("fuera", "2026-10-20")],
      open: [card("vie", { dueDate: "2026-10-16" }), card("sinfecha"), card("lejos", { dueDate: "2026-10-25" })],
    });
    const todo = a.days.flatMap((d) => ids(d.items));
    expect(todo).toEqual(["e:jue", "t:vie"]);
  });

  it("las tareas vencidas no salen (viven en «Vencidas»); los eventos pasados sí", () => {
    const a = buildWeekAgenda({
      today: HOY,
      weekStart: LUNES,
      events: [ev("lunes", "2026-10-12")],
      open: [card("vencida", { dueDate: "2026-10-12" })],
    });
    expect(ids(a.days[0].items)).toEqual(["e:lunes"]);
  });

  it("orden del día: todo el día, luego por hora (evento antes que tarea a la misma hora), luego tareas sin hora", () => {
    const a = buildWeekAgenda({
      today: HOY,
      weekStart: LUNES,
      events: [ev("diez", HOY, { startTime: "10:00" }), ev("tododia", HOY), ev("nueve", HOY, { startTime: "09:00" })],
      open: [
        card("sinhora", { dueDate: HOY }),
        card("ocho", { dueDate: HOY, startTime: "08:30" }),
        card("diezT", { dueDate: HOY, startTime: "10:00" }),
      ],
    });
    expect(ids(a.days[2].items)).toEqual(["e:tododia", "t:ocho", "e:nueve", "e:diez", "t:diezT", "t:sinhora"]);
  });

  it("no duplica: el evento de Google de una tarea, o el mismo título el mismo día, se muestra solo como tarea", () => {
    const a = buildWeekAgenda({
      today: HOY,
      weekStart: LUNES,
      events: [
        ev("espejo", HOY, { gcalEventId: "g1", title: "Otro nombre" }),
        ev("gemelo", "2026-10-15", { title: "  Llamar a  Michael " }),
        ev("distinto", "2026-10-16", { title: "Llamar a Michael" }),
      ],
      open: [
        card("t1", { dueDate: HOY, gcalEventId: "g1" }),
        card("t2", { dueDate: "2026-10-15", title: "llamar a michael" }),
      ],
    });
    expect(a.days.flatMap((d) => ids(d.items))).toEqual(["t:t1", "t:t2", "e:distinto"]);
  });

  it("otra semana: no es la actual y no marca hoy", () => {
    const a = buildWeekAgenda({
      today: HOY,
      weekStart: "2026-10-19",
      events: [ev("lun", "2026-10-19")],
      open: [card("mar", { dueDate: "2026-10-20" })],
    });
    expect(a.isCurrentWeek).toBe(false);
    expect(a.days.some((d) => d.isToday)).toBe(false);
    expect(a.days.flatMap((d) => ids(d.items))).toEqual(["e:lun", "t:mar"]);
  });
});

describe("Agenda y «Para que nada se caiga» no se repiten", () => {
  it("lo de esta semana (de hoy al domingo) sale en la Agenda y no en Próximas, Bloqueadas ni Esperando", () => {
    const open = [
      card("hoy", { dueDate: HOY }),
      card("dom", { dueDate: "2026-10-18" }),
      card("lunSig", { dueDate: "2026-10-19" }),
      card("bloq", { dueDate: "2026-10-16", blockedReason: "Falta info" }),
      card("esp", { dueDate: "2026-10-17", waitingFor: "Ana" }),
      card("vencida", { dueDate: "2026-10-12" }),
      card("bloqSinFecha", { blockedReason: "x" }),
    ];
    const inAgenda = currentWeekTaskIds(HOY, open);
    expect([...inAgenda].sort()).toEqual(["bloq", "dom", "esp", "hoy"]);

    const k = buildKeepUp({ today: HOY, open, projects: [], inAgenda });
    expect(k.overdue.map((c) => c.id)).toEqual(["vencida"]);
    expect(k.upcoming.map((c) => c.id)).toEqual(["lunSig"]);
    expect(k.blocked.map((c) => c.id)).toEqual(["bloqSinFecha"]);
    expect(k.waiting).toHaveLength(0);

    const agenda = buildWeekAgenda({ today: HOY, weekStart: LUNES, events: [], open });
    const enAgenda = agenda.days.flatMap((d) => d.items.map((i) => (i.kind === "tarea" ? i.card.id : "")));
    const enKeepUp = [...k.overdue, ...k.blocked, ...k.waiting, ...k.upcoming].map((c) => c.id);
    expect(enAgenda.filter((id) => enKeepUp.includes(id))).toEqual([]);
  });

  it("el domingo, Próximas muestra los siguientes 7 días (la Agenda ya solo tiene hoy)", () => {
    const domingo = "2026-10-18";
    const open = [card("lun", { dueDate: "2026-10-19" }), card("dom2", { dueDate: "2026-10-25" })];
    const k = buildKeepUp({ today: domingo, open, projects: [], inAgenda: currentWeekTaskIds(domingo, open) });
    expect(k.upcoming.map((c) => c.id)).toEqual(["lun", "dom2"]);
  });
});
