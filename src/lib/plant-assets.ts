/* Mapeo de assets botánicos ilustrados — Fase 4C (conexión a la app).
   Puro y sin dependencias de React: especie + etapa + tema + tamaño → ruta
   del WebP aprobado en public/plants/ (los mismos 60 archivos del catálogo,
   derivados de botanical-reference-01.png; aquí NO se dibuja ni se genera
   nada nuevo).

   Solo las 3 especies del piloto tienen assets; el resto sigue dibujándose
   con el motor SVG v2 (ver PlantArt): isIllustratedPlantSpecies() es la
   única puerta de decisión, así el fallback es trivial de razonar y probar.

   No toca identidad ni persistencia: species/visual_seed/renderer_version
   guardados no cambian; el seed simplemente no participa aquí (los assets
   son fijos por especie+etapa — decisión aprobada en el piloto 4B). */

import type { StageKey } from "./focus-logic";

export const ILLUSTRATED_PLANT_SPECIES = ["monstera", "lavanda", "cactus", "helecho", "suculenta", "olivo"] as const;
export type IllustratedPlantSpecies = (typeof ILLUSTRATED_PLANT_SPECIES)[number];

export type PlantAssetTheme = "light" | "dark";
export type PlantAssetSize = "small" | "large";

export function isIllustratedPlantSpecies(species: string): species is IllustratedPlantSpecies {
  return (ILLUSTRATED_PLANT_SPECIES as readonly string[]).includes(species);
}

/** Dimensiones intrínsecas de cada asset (lienzo uniforme por especie: todas
 *  las etapas de una especie comparten lienzo, y así la escala relativa del
 *  crecimiento es la real de la lámina). small = 320 px de lado mayor,
 *  suficiente para contenedores de hasta 160 px @2x; large = resolución
 *  nativa de la referencia. */
export const PLANT_ASSET_DIMS: Record<IllustratedPlantSpecies, Record<PlantAssetSize, { w: number; h: number }>> = {
  monstera: { large: { w: 411, h: 318 }, small: { w: 320, h: 248 } },
  lavanda: { large: { w: 411, h: 324 }, small: { w: 320, h: 252 } },
  cactus: { large: { w: 411, h: 340 }, small: { w: 320, h: 265 } },
  // Bloque 1 (Fase 4D, desde botanical-reference-03.png)
  helecho: { large: { w: 459, h: 313 }, small: { w: 320, h: 218 } },
  suculenta: { large: { w: 404, h: 274 }, small: { w: 320, h: 217 } },
  olivo: { large: { w: 439, h: 354 }, small: { w: 320, h: 258 } },
};

/** Ruta pública del asset exacto (sirve tal cual desde public/plants/). */
export function plantAssetPath(
  species: IllustratedPlantSpecies,
  stage: StageKey,
  theme: PlantAssetTheme,
  size: PlantAssetSize
): string {
  return `/plants/${species}-${stage}-${theme}-${size}.webp`;
}
