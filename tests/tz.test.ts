import { describe, it, expect, afterEach, vi } from "vitest";
import { TIMEZONE, today, toLocalDate, addDays } from "../src/lib/tz";

/**
 * Estas pruebas corren con TZ=UTC (ver `test:unit` en package.json) para
 * reproducir exactamente el entorno de Vercel, que fue donde apareció el bug:
 * la app mostraba los pendientes de mañana como de hoy a partir de las 6 p.m.
 */

afterEach(() => {
  vi.useRealTimers();
});

const enUtc = (iso: string) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
};

describe("TIMEZONE — la app vive en hora de México", () => {
  it("usa America/Mexico_City por defecto", () => {
    expect(TIMEZONE).toBe("America/Mexico_City");
  });
});

describe("today() — el día de México, no el del servidor", () => {
  it("antes de las 6 p.m. de México, UTC y México coinciden", () => {
    enUtc("2026-09-24T23:30:00Z"); // 17:30 en México
    expect(today()).toBe("2026-09-24");
  });

  it("a las 23:00 de México (05:00 UTC del día siguiente) sigue siendo el día anterior", () => {
    enUtc("2026-09-25T05:00:00Z");
    expect(today()).toBe("2026-09-24");
  });

  it("cambia de día a la medianoche de México (06:00 UTC)", () => {
    enUtc("2026-09-25T06:00:00Z");
    expect(today()).toBe("2026-09-25");
  });

  it("regresión: entre las 6 p.m. y la medianoche de México, NO usa el día UTC", () => {
    // Ésta es la ventana donde se veía el bug: de 18:00 a 23:59 hora de México
    // el servidor en UTC ya está en el día siguiente.
    enUtc("2026-09-25T03:00:00Z"); // 21:00 del 24 en México
    expect(new Date().toISOString().slice(0, 10)).toBe("2026-09-25"); // lo que devolvía antes
    expect(today()).toBe("2026-09-24"); // lo que debe devolver
  });

  it("cruza bien el fin de mes y el fin de año", () => {
    enUtc("2026-10-01T05:00:00Z"); // 30 sep, 23:00 en México
    expect(today()).toBe("2026-09-30");
    enUtc("2027-01-01T05:59:00Z"); // 31 dic, 23:59 en México
    expect(today()).toBe("2026-12-31");
  });

  it("México no tiene horario de verano: el desfase es −6 todo el año", () => {
    enUtc("2026-07-15T05:30:00Z"); // en julio, si hubiera DST sería −5 y daría el 15
    expect(today()).toBe("2026-07-14");
  });
});

describe("toLocalDate() — a qué día de México pertenece un timestamp guardado", () => {
  it("acepta un Date y un string ISO", () => {
    expect(toLocalDate(new Date("2026-09-25T02:00:00Z"))).toBe("2026-09-24");
    expect(toLocalDate("2026-09-25T02:00:00Z")).toBe("2026-09-24");
    expect(toLocalDate("2026-09-25T18:00:00Z")).toBe("2026-09-25");
  });
});

describe("addDays() — aritmética sobre la fecha, no sobre el instante", () => {
  it("suma y resta días", () => {
    expect(addDays("2026-09-24", 7)).toBe("2026-10-01");
    expect(addDays("2026-09-24", -1)).toBe("2026-09-23");
    expect(addDays("2026-09-24", 0)).toBe("2026-09-24");
  });

  it("cruza mes, año y año bisiesto", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
  });

  it("no se salta días en un cambio de horario de verano ajeno", () => {
    expect(addDays("2026-03-07", 1)).toBe("2026-03-08"); // DST en EE. UU.
    expect(addDays("2026-10-24", 1)).toBe("2026-10-25"); // DST en Europa
  });

  it("tolera que le pasen un timestamp completo", () => {
    expect(addDays("2026-09-24T23:30:00Z", 1)).toBe("2026-09-25");
  });
});
