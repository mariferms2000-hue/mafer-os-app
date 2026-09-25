import { describe, it, expect } from "vitest";
import { tokenValido, parseInbox, parseEvento, MAX_TEXTO } from "../src/lib/siri-logic";

const CLAVE = "a".repeat(64);

describe("tokenValido — la puerta de Siri", () => {
  it("acepta la clave correcta", () => {
    expect(tokenValido(`Bearer ${CLAVE}`, CLAVE)).toBe(true);
  });
  it("rechaza clave incorrecta, vacía o sin «Bearer»", () => {
    expect(tokenValido(`Bearer ${"b".repeat(64)}`, CLAVE)).toBe(false);
    expect(tokenValido(null, CLAVE)).toBe(false);
    expect(tokenValido(CLAVE, CLAVE)).toBe(false);
    expect(tokenValido("Bearer ", CLAVE)).toBe(false);
  });
  it("queda cerrada si SIRI_TOKEN falta o es corto", () => {
    expect(tokenValido("Bearer x", undefined)).toBe(false);
    expect(tokenValido("Bearer corta", "corta")).toBe(false);
  });
});

describe("parseInbox", () => {
  it("toma el texto dictado", () => {
    expect(parseInbox({ texto: "  Llamar al dentista " })).toEqual({ ok: true, datos: { content: "Llamar al dentista" } });
  });
  it("rechaza vacío, cuerpo inválido o texto enorme", () => {
    expect(parseInbox({ texto: "" }).ok).toBe(false);
    expect(parseInbox(null).ok).toBe(false);
    expect(parseInbox({ texto: 123 }).ok).toBe(false);
    expect(parseInbox({ texto: "x".repeat(MAX_TEXTO + 1) }).ok).toBe(false);
  });
});

describe("parseEvento", () => {
  it("fecha sola = evento de todo el día", () => {
    expect(parseEvento({ titulo: "Cumple de mamá", fecha: "2026-10-03" })).toEqual({
      ok: true,
      datos: { title: "Cumple de mamá", date: "2026-10-03", startTime: null, endTime: null },
    });
  });
  it("con hora dura 60 minutos por defecto", () => {
    const r = parseEvento({ titulo: "Dentista", fecha: "2026-10-03", hora: "17:30" });
    expect(r).toMatchObject({ ok: true, datos: { startTime: "17:30", endTime: "18:30" } });
  });
  it("respeta la duración y no cruza la medianoche", () => {
    expect(parseEvento({ titulo: "Junta", fecha: "2026-10-03", hora: "09:00", duracion: 30 }))
      .toMatchObject({ datos: { endTime: "09:30" } });
    expect(parseEvento({ titulo: "Cena", fecha: "2026-10-03", hora: "23:00", duracion: "120" }))
      .toMatchObject({ datos: { endTime: "23:59" } });
  });
  it("lee el ISO de Atajos en hora local del teléfono, sin pasarlo a UTC", () => {
    expect(parseEvento({ titulo: "Vuelo", fecha: "2026-09-26T19:00:00-06:00" }))
      .toMatchObject({ ok: true, datos: { date: "2026-09-26", startTime: "19:00", endTime: "20:00" } });
  });
  it("rechaza datos que no entiende", () => {
    expect(parseEvento({ fecha: "2026-10-03" }).ok).toBe(false);
    expect(parseEvento({ titulo: "X", fecha: "mañana" }).ok).toBe(false);
    expect(parseEvento({ titulo: "X", fecha: "2026-02-30" }).ok).toBe(false);
    expect(parseEvento({ titulo: "X", fecha: "2026-10-03", hora: "5pm" }).ok).toBe(false);
    expect(parseEvento({ titulo: "X", fecha: "2026-10-03", hora: "10:00", duracion: -5 }).ok).toBe(false);
  });
});
