import { describe, expect, it } from "vitest";
import {
  FONT_SIZE_SCALE,
  FONT_SIZE_LEVELS,
  DEFAULT_FONT_SIZE_PREFS,
  computeFontSizeVars,
  type FontSizePrefs,
} from "../src/lib/font-size";

describe("escalones de tamaño", () => {
  it("los tres factores aprobados: pequeño ×0.88, normal ×1, grande ×1.15", () => {
    expect(FONT_SIZE_SCALE).toEqual({ pequeno: 0.88, normal: 1, grande: 1.15 });
    expect(FONT_SIZE_LEVELS).toEqual(["pequeno", "normal", "grande"]);
  });
});

describe("computeFontSizeVars", () => {
  it("con todo en 'normal', cada variable es exactamente el tamaño actual (100%, sin cambio visual)", () => {
    const vars = computeFontSizeVars(DEFAULT_FONT_SIZE_PREFS);
    expect(vars).toEqual({
      "--text-lg": "1.125rem",
      "--text-xl": "1.25rem",
      "--text-2xl": "1.5rem",
      "--text-3xl": "1.875rem",
      "--btn-font-size": "0.875rem",
      "--text-xs": "0.75rem",
      "--text-sm": "0.875rem",
      "--text-base": "1rem",
      "--label-font-size": "0.75rem",
      "--chip-font-size": "0.72rem",
      "--eyebrow-font-size": "0.72rem",
      "--field-font-size": "0.9rem",
    });
  });

  it("solo escala la categoría que cambia — las demás quedan en su tamaño actual", () => {
    const prefs: FontSizePrefs = { ...DEFAULT_FONT_SIZE_PREFS, titulos: "grande" };
    const vars = computeFontSizeVars(prefs);
    expect(vars["--text-2xl"]).toBe("1.725rem"); // 1.5 * 1.15
    expect(vars["--text-3xl"]).toBe("2.156rem"); // 1.875 * 1.15, redondeado a 3 decimales
    expect(vars["--btn-font-size"]).toBe("0.875rem"); // botones no cambió: sigue en 100%
    expect(vars["--text-xs"]).toBe("0.75rem"); // cuerpo no cambió
  });

  it("'pequeño' reduce todas las variables de esa categoría por igual", () => {
    const prefs: FontSizePrefs = { ...DEFAULT_FONT_SIZE_PREFS, cuerpo: "pequeno" };
    const vars = computeFontSizeVars(prefs);
    expect(vars["--text-xs"]).toBe("0.66rem"); // 0.75 * 0.88
    expect(vars["--text-sm"]).toBe("0.77rem"); // 0.875 * 0.88
    expect(vars["--text-base"]).toBe("0.88rem"); // 1 * 0.88
  });

  it("etiquetas y chips escalan sus tres variables juntas con el mismo factor", () => {
    const prefs: FontSizePrefs = { ...DEFAULT_FONT_SIZE_PREFS, etiquetas: "grande" };
    const vars = computeFontSizeVars(prefs);
    expect(vars["--label-font-size"]).toBe("0.862rem"); // 0.75 * 1.15, redondeado a 3 decimales
    expect(vars["--chip-font-size"]).toBe("0.828rem"); // 0.72 * 1.15
    expect(vars["--eyebrow-font-size"]).toBe("0.828rem");
  });

  it("campos de formulario escala su única variable", () => {
    const prefs: FontSizePrefs = { ...DEFAULT_FONT_SIZE_PREFS, campos: "grande" };
    const vars = computeFontSizeVars(prefs);
    expect(vars["--field-font-size"]).toBe("1.035rem"); // 0.9 * 1.15
  });
});
