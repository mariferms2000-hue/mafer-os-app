"use client";

import { computeFontSizeVars, DEFAULT_FONT_SIZE_PREFS, type FontSizePrefs } from "@/lib/font-size";

const STORAGE_KEY = "mafer-font-sizes";

/** Lee la preferencia guardada. Si no hay nada, está corrupta, o falta
 *  alguna categoría (versión vieja del formato), completa con "normal"
 *  — nunca lanza, nunca deja una categoría sin valor. */
export function readFontSizePrefs(): FontSizePrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FONT_SIZE_PREFS;
    const parsed = JSON.parse(raw) as Partial<FontSizePrefs>;
    return { ...DEFAULT_FONT_SIZE_PREFS, ...parsed };
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
