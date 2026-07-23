"use client";

import {
  computeFontSizeVars,
  DEFAULT_FONT_SIZE_PREFS,
  FONT_SIZE_LEVELS,
  type FontLevel,
  type FontSizePrefs,
} from "@/lib/font-size";

const STORAGE_KEY = "mafer-font-sizes";

/** Valida que un valor sea un nivel válido de tamaño de fuente.
 *  Se usa para rechazar valores corruptos/inválidos del localStorage. */
function isValidLevel(v: unknown): v is FontLevel {
  return typeof v === "string" && (FONT_SIZE_LEVELS as string[]).includes(v);
}

/** Lee la preferencia guardada. Si no hay nada, está corrupta, o falta
 *  alguna categoría (versión vieja del formato), completa con "normal".
 *  Valida que cada nivel sea válido; rechaza valores inválidos y usa el
 *  default en su lugar — nunca lanza, nunca deja una categoría sin valor. */
export function readFontSizePrefs(): FontSizePrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FONT_SIZE_PREFS;
    const parsed = JSON.parse(raw) as Partial<FontSizePrefs>;

    // Valida cada categoría y rechaza valores inválidos
    const validated: FontSizePrefs = { ...DEFAULT_FONT_SIZE_PREFS };
    for (const category of Object.keys(validated) as (keyof FontSizePrefs)[]) {
      if (category in parsed && isValidLevel(parsed[category])) {
        validated[category] = parsed[category] as FontLevel;
      }
    }
    return validated;
  } catch {
    return DEFAULT_FONT_SIZE_PREFS;
  }
}

/** Guarda la preferencia y la aplica de inmediato en toda la app: al ser
 *  variables CSS puras en <html>, el cambio se refleja en cascada sin
 *  re-render de React en otros componentes. */
export function applyFontSizes(prefs: FontSizePrefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {}
  const vars = computeFontSizeVars(prefs);
  const html = document.documentElement;
  for (const [name, value] of Object.entries(vars)) {
    html.style.setProperty(name, value);
  }
}
