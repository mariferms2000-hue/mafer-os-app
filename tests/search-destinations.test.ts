import { describe, it, expect } from "vitest";
import { matchDestinations, fold, DESTINATIONS } from "../src/lib/search-destinations";

const hrefs = (q: string) => matchDestinations(q).map((d) => d.href);

describe("matchDestinations — Sueño en Buscar", () => {
  it("lo encuentran «sueño», «sueno», «dormir», «despertar»", () => {
    for (const q of ["sueño", "sueno", "dormir", "despertar"]) expect(hrefs(q)).toEqual(["/sueno"]);
  });

  it("ignora mayúsculas, acentos y espacios de más", () => {
    for (const q of ["SUEÑO", "Sueno", "  dormir  ", "Despértar"]) expect(hrefs(q)).toEqual(["/sueno"]);
  });

  it("frases: «hora de dormir», «ciclo de sueño», «hora de despertar»", () => {
    for (const q of ["hora de dormir", "ciclo de sueño", "ciclo de sueno", "hora de despertar"]) {
      expect(hrefs(q)).toEqual(["/sueno"]);
    }
  });

  it("no aparece con búsquedas ajenas ni vacías", () => {
    for (const q of ["", "   ", "proyecto", "dormir proyecto", "pomodoro"]) expect(hrefs(q)).toEqual([]);
  });

  it("tiene la forma de los demás resultados y va a /sueno sin parámetros", () => {
    const [d] = DESTINATIONS;
    expect(d).toMatchObject({ title: "Sueño", href: "/sueno", category: "herramienta" });
    expect(d.sub.length).toBeGreaterThan(0);
  });

  it("fold quita acentos y mayúsculas", () => {
    expect(fold("Sueño Despértate")).toBe("sueno despertate");
  });
});
