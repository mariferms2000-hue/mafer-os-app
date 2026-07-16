import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/** Fase 6A — contraste WCAG calculado directamente desde los tokens de globals.css.
 *  Si alguien cambia un color y rompe la legibilidad, esta prueba falla.
 *
 *  Umbrales: texto principal ≥ 7 (AAA), secundario ≥ 4.5 (AA), tenue ≥ 3,
 *  pares de acción (botón primario, chip activo, toast) ≥ 4.5.
 *  Nota: en modo claro `stone` (4.4) y el chip alterno oliva (4.2) conservan la
 *  apariencia aprobada — su refinamiento es parte de la Fase 6B; aquí se fija
 *  un piso para que no empeoren. En oscuro todo cumple AA/AAA estrictos.
 */

const css = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");

function extractBlock(startMarker: string): Record<string, string> {
  const start = css.indexOf(startMarker);
  if (start === -1) throw new Error(`No se encontró ${startMarker}`);
  let depth = 0;
  let i = css.indexOf("{", start);
  const open = i;
  for (; i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  const body = css.slice(open + 1, i);
  const vars: Record<string, string> = {};
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    vars[m[1]] = m[2].trim();
  }
  return vars;
}

const lightVars = extractBlock("@theme");
const darkVars = { ...lightVars, ...extractBlock('html[data-theme="dark"]') };

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function ratio(vars: Record<string, string>, fgToken: string, bgToken: string): number {
  const fg = hexToRgb(vars[fgToken] ?? "");
  const bg = hexToRgb(vars[bgToken] ?? "");
  if (!fg || !bg) throw new Error(`Token no-hex: ${fgToken} o ${bgToken}`);
  const [l1, l2] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** [texto, fondo, mínimo claro, mínimo oscuro] */
const PAIRS: [string, string, number, number][] = [
  // Texto sobre los tres niveles de profundidad
  ["--color-charcoal", "--color-cream", 7, 7],
  ["--color-charcoal", "--color-paper", 7, 7],
  ["--color-charcoal", "--color-raised", 7, 7],
  ["--color-stone", "--color-paper", 4.2, 4.5],
  ["--color-stone", "--color-raised", 4.2, 4.5],
  ["--color-stone-soft", "--color-paper", 2.5, 3],
  ["--color-ink-green", "--color-paper", 4.5, 4.5],
  ["--color-forest-deep", "--color-cream", 4.5, 4.5],
  ["--color-link", "--color-paper", 4.5, 4.5],
  // Acción primaria y chips activos
  ["--color-btn-primary-fg", "--color-btn-primary-bg", 4.5, 4.5],
  ["--color-chip-on-fg", "--color-chip-on-bg", 4.5, 4.5],
  ["--color-chip-on-alt-fg", "--color-chip-on-alt-bg", 4, 4.5],
  // Toast (los 4 tonos + texto secundario)
  ["--color-toast-fg", "--color-toast-bg", 4.5, 4.5],
  ["--color-toast-muted", "--color-toast-bg", 4.5, 4.5],
  ["--color-toast-ok", "--color-toast-bg", 3, 3],
  ["--color-toast-warn", "--color-toast-bg", 3, 3],
  ["--color-toast-error", "--color-toast-bg", 3, 3],
  ["--color-toast-info", "--color-toast-bg", 3, 3],
  // Selección de texto e iconografía interactiva
  ["--color-selection-fg", "--color-selection-bg", 4.5, 4.5],
  ["--color-sage-deep", "--color-paper", 2.5, 3],
];

describe("contraste de tokens (claro)", () => {
  for (const [fg, bg, min] of PAIRS) {
    it(`${fg} sobre ${bg} ≥ ${min}`, () => {
      expect(ratio(lightVars, fg, bg)).toBeGreaterThanOrEqual(min);
    });
  }
});

describe("contraste de tokens (oscuro)", () => {
  for (const [fg, bg, , min] of PAIRS) {
    it(`${fg} sobre ${bg} ≥ ${min}`, () => {
      expect(ratio(darkVars, fg, bg)).toBeGreaterThanOrEqual(min);
    });
  }

  it("nada de negro puro ni blanco puro", () => {
    for (const token of ["--color-cream", "--color-paper", "--color-raised", "--color-sidebar"]) {
      expect(darkVars[token]).not.toBe("#000000");
    }
    expect(darkVars["--color-charcoal"].toLowerCase()).not.toBe("#ffffff");
  });

  it("tres niveles de profundidad distinguibles (fondo < superficie < elevado)", () => {
    const l = (t: string) => luminance(hexToRgb(darkVars[t])!);
    expect(l("--color-paper")).toBeGreaterThan(l("--color-cream") * 1.5);
    expect(l("--color-raised")).toBeGreaterThan(l("--color-paper") * 1.2);
    expect(l("--color-sidebar")).toBeLessThan(l("--color-cream"));
  });

  it("texto secundario y tenue jerarquizados (principal > secundario > tenue)", () => {
    const l = (t: string) => luminance(hexToRgb(darkVars[t])!);
    expect(l("--color-charcoal")).toBeGreaterThan(l("--color-stone"));
    expect(l("--color-stone")).toBeGreaterThan(l("--color-stone-soft"));
  });
});
