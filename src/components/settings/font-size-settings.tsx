"use client";

import { useEffect, useState } from "react";
import {
  FONT_SIZE_LEVELS,
  FONT_CATEGORY_LABEL,
  DEFAULT_FONT_SIZE_PREFS,
  type FontCategory,
  type FontLevel,
  type FontSizePrefs,
} from "@/lib/font-size";
import { applyFontSizes, readFontSizePrefs } from "@/components/shell/font-size";

const LEVEL_LABEL: Record<FontLevel, string> = {
  pequeno: "Pequeño",
  normal: "Normal",
  grande: "Grande",
};

const CATEGORIES = Object.keys(FONT_CATEGORY_LABEL) as FontCategory[];

/** Ajustes → Tamaño de texto: 5 filas, una por categoría, cada una un
 *  segmented control Pequeño/Normal/Grande (mismo lenguaje visual que
 *  ThemeSelector). Lee localStorage solo en el cliente (useEffect) para
 *  no romper el render del servidor; antes de montar muestra "Normal"
 *  en las 5 sin parpadeo visible porque el script inline ya aplicó el
 *  tamaño real a nivel CSS antes de que React hidrate. */
export function FontSizeSettings() {
  const [prefs, setPrefs] = useState<FontSizePrefs>(DEFAULT_FONT_SIZE_PREFS);

  useEffect(() => {
    setPrefs(readFontSizePrefs());
  }, []);

  function setLevel(category: FontCategory, level: FontLevel) {
    const next = { ...prefs, [category]: level };
    setPrefs(next);
    applyFontSizes(next);
  }

  return (
    <div className="flex flex-col gap-3">
      {CATEGORIES.map((category) => (
        <div key={category} className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-charcoal">{FONT_CATEGORY_LABEL[category]}</p>
          <div
            role="radiogroup"
            aria-label={`Tamaño de ${FONT_CATEGORY_LABEL[category].toLowerCase()}`}
            className="inline-flex rounded-xl border border-sand bg-beige p-1 gap-1"
          >
            {FONT_SIZE_LEVELS.map((level) => {
              const active = prefs[category] === level;
              return (
                <button
                  key={level}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  data-testid={`font-size-${category}-${level}`}
                  onClick={() => setLevel(category, level)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    active ? "bg-forest text-cream" : "text-ink-green hover:bg-sand"
                  }`}
                >
                  {LEVEL_LABEL[level]}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
