import { describe, expect, it } from "vitest";
import { isValidTripRange, isTripActiveOn, tripWeekOverlap } from "../src/lib/trip-logic";

describe("isValidTripRange", () => {
  it("acepta un rango de un solo día (inicio == fin)", () => {
    expect(isValidTripRange("2026-08-01", "2026-08-01")).toBe(true);
  });

  it("acepta fin posterior a inicio", () => {
    expect(isValidTripRange("2026-08-01", "2026-08-10")).toBe(true);
  });

  it("rechaza fin anterior a inicio", () => {
    expect(isValidTripRange("2026-08-10", "2026-08-01")).toBe(false);
  });

  it("rechaza fechas vacías", () => {
    expect(isValidTripRange("", "2026-08-10")).toBe(false);
    expect(isValidTripRange("2026-08-01", "")).toBe(false);
    expect(isValidTripRange("", "")).toBe(false);
  });
});

describe("isTripActiveOn", () => {
  const trip = { startDate: "2026-08-05", endDate: "2026-08-09" };

  it("es activo en el primer día (inclusivo)", () => {
    expect(isTripActiveOn(trip, "2026-08-05")).toBe(true);
  });

  it("es activo en el último día (inclusivo)", () => {
    expect(isTripActiveOn(trip, "2026-08-09")).toBe(true);
  });

  it("es activo en un día intermedio", () => {
    expect(isTripActiveOn(trip, "2026-08-07")).toBe(true);
  });

  it("no es activo un día antes de empezar", () => {
    expect(isTripActiveOn(trip, "2026-08-04")).toBe(false);
  });

  it("no es activo un día después de terminar", () => {
    expect(isTripActiveOn(trip, "2026-08-10")).toBe(false);
  });

  it("un viaje de un solo día es activo exactamente ese día", () => {
    const oneDay = { startDate: "2026-08-05", endDate: "2026-08-05" };
    expect(isTripActiveOn(oneDay, "2026-08-05")).toBe(true);
    expect(isTripActiveOn(oneDay, "2026-08-04")).toBe(false);
    expect(isTripActiveOn(oneDay, "2026-08-06")).toBe(false);
  });
});

describe("tripWeekOverlap", () => {
  const week = [
    "2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06",
    "2026-08-07", "2026-08-08", "2026-08-09",
  ];

  it("viaje completamente dentro de la semana: columnas exactas", () => {
    const trip = { startDate: "2026-08-05", endDate: "2026-08-07" };
    expect(tripWeekOverlap(week, trip)).toEqual({ startCol: 2, endCol: 4 });
  });

  it("viaje que empieza antes de la semana: se recorta al inicio de la semana", () => {
    const trip = { startDate: "2026-07-30", endDate: "2026-08-05" };
    expect(tripWeekOverlap(week, trip)).toEqual({ startCol: 0, endCol: 2 });
  });

  it("viaje que termina después de la semana: se recorta al final de la semana", () => {
    const trip = { startDate: "2026-08-08", endDate: "2026-08-15" };
    expect(tripWeekOverlap(week, trip)).toEqual({ startCol: 5, endCol: 6 });
  });

  it("viaje que abarca toda la semana y más", () => {
    const trip = { startDate: "2026-07-01", endDate: "2026-09-01" };
    expect(tripWeekOverlap(week, trip)).toEqual({ startCol: 0, endCol: 6 });
  });

  it("viaje que no toca la semana: null", () => {
    const trip = { startDate: "2026-09-01", endDate: "2026-09-05" };
    expect(tripWeekOverlap(week, trip)).toBeNull();
  });

  it("respeta celdas null (relleno fuera de mes) sin romperse", () => {
    const weekWithPadding = [null, null, "2026-08-05", "2026-08-06", "2026-08-07", "2026-08-08", "2026-08-09"];
    const trip = { startDate: "2026-08-01", endDate: "2026-08-06" };
    expect(tripWeekOverlap(weekWithPadding, trip)).toEqual({ startCol: 2, endCol: 3 });
  });
});
