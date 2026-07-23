/* Lógica pura de tamaño de fuente configurable — sin DOM, sin localStorage,
   sin dependencias. Misma filosofía que focus-logic.ts: testeable sin
   mockear nada, la UI y la persistencia viven en otros archivos.

   Dos categorías (Títulos, Texto de cuerpo) reusan variables CSS que
   Tailwind v4 ya expone globalmente (--text-lg…--text-3xl, --text-xs…
   --text-base) — confirmado en el CSS compilado del proyecto:
   `.text-2xl{font-size:var(--text-2xl)}`. Las otras tres categorías usan
   variables propias, nuevas, referenciadas en globals.css. */

export type FontLevel = "pequeno" | "normal" | "grande";

export type FontCategory = "titulos" | "botones" | "cuerpo" | "etiquetas" | "campos";

export type FontSizePrefs = Record<FontCategory, FontLevel>;

export const FONT_SIZE_SCALE: Record<FontLevel, number> = {
  pequeno: 0.88,
  normal: 1,
  grande: 1.15,
};

export const FONT_SIZE_LEVELS: FontLevel[] = ["pequeno", "normal", "grande"];

type CategoryVarSpec = { cssVar: string; baseRem: number };

/** Bases = el tamaño que ya existe hoy en el sitio (ver globals.css y las
 *  variables --text-* que Tailwind v4 ya define). "Normal" nunca cambia
 *  nada visualmente porque su factor es 1. */
export const FONT_CATEGORY_VARS: Record<FontCategory, CategoryVarSpec[]> = {
  titulos: [
    { cssVar: "--text-lg", baseRem: 1.125 },
    { cssVar: "--text-xl", baseRem: 1.25 },
    { cssVar: "--text-2xl", baseRem: 1.5 },
    { cssVar: "--text-3xl", baseRem: 1.875 },
  ],
  botones: [{ cssVar: "--btn-font-size", baseRem: 0.875 }],
  cuerpo: [
    { cssVar: "--text-xs", baseRem: 0.75 },
    { cssVar: "--text-sm", baseRem: 0.875 },
    { cssVar: "--text-base", baseRem: 1 },
  ],
  etiquetas: [
    { cssVar: "--label-font-size", baseRem: 0.75 },
    { cssVar: "--chip-font-size", baseRem: 0.72 },
    { cssVar: "--eyebrow-font-size", baseRem: 0.72 },
  ],
  campos: [{ cssVar: "--field-font-size", baseRem: 0.9 }],
};

export const FONT_CATEGORY_LABEL: Record<FontCategory, string> = {
  titulos: "Títulos",
  botones: "Botones",
  cuerpo: "Texto de cuerpo",
  etiquetas: "Etiquetas y chips",
  campos: "Campos de formulario",
};

export const DEFAULT_FONT_SIZE_PREFS: FontSizePrefs = {
  titulos: "normal",
  botones: "normal",
  cuerpo: "normal",
  etiquetas: "normal",
  campos: "normal",
};

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Dado un nivel por categoría, calcula el valor final (en rem) de cada
 *  variable CSS involucrada. Función pura: misma entrada, misma salida. */
export function computeFontSizeVars(prefs: FontSizePrefs): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const category of Object.keys(FONT_CATEGORY_VARS) as FontCategory[]) {
    const factor = FONT_SIZE_SCALE[prefs[category]];
    for (const { cssVar, baseRem } of FONT_CATEGORY_VARS[category]) {
      vars[cssVar] = `${round3(baseRem * factor)}rem`;
    }
  }
  return vars;
}
