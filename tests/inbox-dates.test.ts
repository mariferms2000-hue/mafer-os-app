import { describe, expect, it } from "vitest";
import { captureAge, quickDueDates } from "../src/lib/inbox-dates";

/* Inbox (Bloque 2): antigüedad legible en vez de «2026-10-11» y fechas rápidas
 * para convertir una captura en tarea con un toque. Todo en hora de México. */

describe("captureAge", () => {
  const HOY = "2026-10-11"; // domingo

  it("hoy, ayer y hace N días", () => {
    expect(captureAge("2026-10-11T15:00:00.000Z", HOY)).toBe("hoy");
    expect(captureAge("2026-10-10T15:00:00.000Z", HOY)).toBe("ayer");
    expect(captureAge("2026-10-06T15:00:00.000Z", HOY)).toBe("hace 5 días");
  });

  it("usa la fecha de México, no la UTC (capturada de noche en México)", () => {
    // 10 oct 23:30 en CDMX = 11 oct 05:30 UTC → fue AYER para Mafer
    expect(captureAge("2026-10-11T05:30:00.000Z", HOY)).toBe("ayer");
  });

  it("de dos semanas en adelante, fecha corta", () => {
    expect(captureAge("2026-09-21T15:00:00.000Z", HOY)).toBe("21 sep");
  });
});

describe("quickDueDates", () => {
  const fechas = (hoy: string) => Object.fromEntries(quickDueDates(hoy).map((q) => [q.key, q.date]));

  it("ofrece Sin fecha, Hoy, Mañana y Próx. semana en ese orden", () => {
    expect(quickDueDates("2026-10-11").map((q) => q.label)).toEqual(["Sin fecha", "Hoy", "Mañana", "Próx. semana"]);
  });

  it("calcula hoy y mañana cruzando fin de mes", () => {
    expect(fechas("2026-10-31")).toMatchObject({ sin: null, hoy: "2026-10-31", manana: "2026-11-01" });
  });

  it("próxima semana = el lunes siguiente", () => {
    expect(fechas("2026-10-11").semana).toBe("2026-10-12"); // domingo → lunes
    expect(fechas("2026-10-12").semana).toBe("2026-10-19"); // lunes → lunes que viene
    expect(fechas("2026-10-14").semana).toBe("2026-10-19"); // miércoles
    expect(fechas("2026-10-17").semana).toBe("2026-10-19"); // sábado
  });
});
