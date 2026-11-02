import type { StageKey } from "@/lib/focus-logic";
import { PLANT_ASSET_DIMS, plantAssetPath } from "@/lib/plant-assets";
import type { Species } from "./species";

/* Qué lámina se pinta para cada planta del invernadero y con qué tratamiento
   (F4). Es la ÚNICA puerta entre el estado (sed, especial) y el arte:

   - Hoy existen solo las láminas base. La sed y el riego se pintan con un
     tratamiento (caída, color, puntas secas, rocío) y la versión especial con
     un acabado genérico provisional (borde dorado y maceta esmaltada) hasta
     que llegue su lámina propia (docs/arte-plantas.md).
   - Cuando llegue arte propio, se registra en VARIANT_ART y la lámina nueva
     sustituye al tratamiento sin tocar la lógica ni la escena. Lo mismo para
     el arte a doble resolución: se registra en HIRES_ART.

   Las medidas de colocación (asset-bounds.ts) se regeneran con
   scripts/measure-plant-assets.py si cambian los lienzos. */

export type PlantLook = "normal" | "sed" | "especial";

export type ArtRef = { src: string; w: number; h: number };

/** Arte propio por especie y estado (vacío hasta que se apruebe el arte final). */
export const VARIANT_ART: Partial<Record<Species, Partial<Record<Exclude<PlantLook, "normal">, ArtRef>>>> = {};

/** Arte a doble resolución por especie y etapa (vacío hasta que exista). Debe
 *  conservar el lienzo y la proporción de la lámina actual. */
export const HIRES_ART: Partial<Record<Species, Partial<Record<StageKey, ArtRef>>>> = {};

export type PlantVisual = {
  art: ArtRef;
  /** tratamiento CSS de sed (solo si no hay lámina propia de sed) */
  droop: boolean;
  /** acabado especial genérico (solo si no hay lámina propia especial) */
  special: boolean;
};

export function baseArt(species: Species, stage: StageKey): ArtRef {
  const hi = HIRES_ART[species]?.[stage];
  if (hi) return hi;
  const d = PLANT_ASSET_DIMS[species].large;
  return { src: plantAssetPath(species, stage, "light", "large"), w: d.w, h: d.h };
}

export function plantVisual(species: Species, stage: StageKey, look: PlantLook): PlantVisual {
  const own = look === "normal" ? undefined : VARIANT_ART[species]?.[look];
  if (own) return { art: own, droop: false, special: false };
  return {
    art: baseArt(species, stage),
    droop: look === "sed",
    special: look === "especial" && stage === "planta-completa",
  };
}
