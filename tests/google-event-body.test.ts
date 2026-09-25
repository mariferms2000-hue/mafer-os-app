import { describe, it, expect } from "vitest";
import { toRequestBody, defaultEndTime } from "../src/lib/google/event-body";

/* Cómo se traduce un evento de Mafer OS al cuerpo de la API de Google.
 *
 * Google rechaza con 400 cualquier evento de duración cero, y todos los
 * callers de sync hacen `.catch(() => {})`: un cuerpo mal armado no da error
 * visible, simplemente el evento nunca aparece en el celular. De ahí que esto
 * tenga pruebas. */

const base = { title: "Comida con Jorge", sourceRef: "event:abc" };

describe("eventos de día completo", () => {
  it("end.date es el día SIGUIENTE (Google lo trata como exclusivo)", () => {
    const body = toRequestBody({ ...base, date: "2026-09-24" });
    expect(body.start).toEqual({ date: "2026-09-24" });
    expect(body.end).toEqual({ date: "2026-09-25" });
  });

  it("regresión: nunca manda start y end el mismo día (duración cero → 400)", () => {
    for (const date of ["2026-09-30", "2026-12-31", "2028-02-28"]) {
      const body = toRequestBody({ ...base, date });
      expect(body.end).not.toEqual(body.start);
    }
  });

  it("cruza bien el fin de mes y el fin de año", () => {
    expect(toRequestBody({ ...base, date: "2026-09-30" }).end).toEqual({ date: "2026-10-01" });
    expect(toRequestBody({ ...base, date: "2026-12-31" }).end).toEqual({ date: "2027-01-01" });
  });
});

describe("eventos con hora", () => {
  it("manda la zona horaria de México explícita", () => {
    const body = toRequestBody({ ...base, date: "2026-09-24", startTime: "14:00" });
    expect(body.start).toEqual({ dateTime: "2026-09-24T14:00:00", timeZone: "America/Mexico_City" });
    expect(body.end).toEqual({ dateTime: "2026-09-24T15:00:00", timeZone: "America/Mexico_City" });
  });

  it("respeta la hora de fin cuando se dio", () => {
    const body = toRequestBody({ ...base, date: "2026-09-24", startTime: "14:00", endTime: "16:30" });
    expect(body.end).toEqual({ dateTime: "2026-09-24T16:30:00", timeZone: "America/Mexico_City" });
  });

  it("ignora una hora de fin igual o anterior al inicio", () => {
    const igual = toRequestBody({ ...base, date: "2026-09-24", startTime: "14:00", endTime: "14:00" });
    expect(igual.end).toEqual({ dateTime: "2026-09-24T15:00:00", timeZone: "America/Mexico_City" });
    const antes = toRequestBody({ ...base, date: "2026-09-24", startTime: "14:00", endTime: "09:00" });
    expect(antes.end).toEqual({ dateTime: "2026-09-24T15:00:00", timeZone: "America/Mexico_City" });
  });

  it("no desborda el día: un evento a las 23:30 termina a las 23:59", () => {
    expect(defaultEndTime("23:30")).toBe("23:59");
    expect(defaultEndTime("23:00")).toBe("23:59");
    expect(defaultEndTime("22:15")).toBe("23:15");
    expect(defaultEndTime("09:05")).toBe("10:05");
    expect(defaultEndTime("00:00")).toBe("01:00");
  });

  it("regresión: a las 23:30 ya no manda fin = inicio (antes daba 23:30)", () => {
    const body = toRequestBody({ ...base, date: "2026-09-24", startTime: "23:30" });
    expect(body.end).not.toEqual(body.start);
  });
});

describe("datos comunes", () => {
  it("conserva título, notas y la referencia a Mafer OS", () => {
    const body = toRequestBody({ ...base, date: "2026-09-24", notes: "Llevar el contrato" });
    expect(body.summary).toBe("Comida con Jorge");
    expect(body.description).toBe("Llevar el contrato");
    expect(body.extendedProperties.private.maferOsRef).toBe("event:abc");
  });

  it("omite la descripción cuando no hay notas", () => {
    expect(toRequestBody({ ...base, date: "2026-09-24", notes: "" }).description).toBeUndefined();
  });
});
