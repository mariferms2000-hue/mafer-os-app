import { describe, it, expect } from "vitest";
import {
  diasDeRepeticion,
  fechasDelEvento,
  finRepeticion,
  ocurreEl,
  repeatUntilDeFormulario,
  MAX_DIAS_REPETICION,
} from "../src/lib/event-repeat";

const perrita = { date: "2026-09-29", repeatUntil: "2026-10-04" }; // martes → domingo

describe("evento de varios días", () => {
  it("aparece cada día de martes a domingo, ambos incluidos", () => {
    expect(fechasDelEvento(perrita)).toEqual([
      "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04",
    ]);
    expect(diasDeRepeticion(perrita)).toBe(6);
  });

  it("ocurreEl respeta los bordes", () => {
    expect(ocurreEl(perrita, "2026-09-28")).toBe(false);
    expect(ocurreEl(perrita, "2026-09-29")).toBe(true);
    expect(ocurreEl(perrita, "2026-10-01")).toBe(true); // cruza de mes
    expect(ocurreEl(perrita, "2026-10-04")).toBe(true);
    expect(ocurreEl(perrita, "2026-10-05")).toBe(false);
  });

  it("sin repetición (o con fecha final inválida) es un solo día", () => {
    for (const repeatUntil of [null, undefined, "", "2026-09-29", "2026-09-01"]) {
      const e = { date: "2026-09-29", repeatUntil };
      expect(finRepeticion(e)).toBeNull();
      expect(fechasDelEvento(e)).toEqual(["2026-09-29"]);
      expect(diasDeRepeticion(e)).toBe(1);
    }
  });

  it("nunca se repite más de un año", () => {
    const e = { date: "2026-01-01", repeatUntil: "2030-01-01" };
    expect(diasDeRepeticion(e)).toBe(MAX_DIAS_REPETICION);
  });
});

describe("repeatUntilDeFormulario", () => {
  const fd = (o: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(o)) f.set(k, v);
    return f;
  };
  it("solo cuenta con la casilla marcada y una fecha posterior", () => {
    expect(repeatUntilDeFormulario(fd({ repeat: "on", repeatUntil: "2026-10-04" }), "2026-09-29")).toBe("2026-10-04");
    expect(repeatUntilDeFormulario(fd({ repeatUntil: "2026-10-04" }), "2026-09-29")).toBeNull();
    expect(repeatUntilDeFormulario(fd({ repeat: "on", repeatUntil: "2026-09-29" }), "2026-09-29")).toBeNull();
    expect(repeatUntilDeFormulario(fd({ repeat: "on", repeatUntil: "" }), "2026-09-29")).toBeNull();
  });
});
