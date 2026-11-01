import type { StageKey } from "@/lib/focus-logic";
import { PLANT_ASSET_DIMS, plantAssetPath } from "@/lib/plant-assets";
import type { Species } from "./species";

/* Qué lámina se pinta para cada planta del invernadero y con qué tratamiento
   (F4). Es la ÚNICA puerta entre el estado (sed, especial) y el arte:

   - Hoy existen solo las láminas base. La sed se pinta con un tratamiento
     (caída y color apagado) y la versión especial con un montaje por especie
     (más follaje con copias de la lámina, flores, tono).
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

/** Copia de la lámina detrás de la principal: desplazamiento y giro en % del
 *  lienzo, escala, espejo y recorte opcional. */
export type LeafCopy = { x: number; y: number; s: number; r: number; flip?: boolean; clip?: string };

/** Montaje de la versión especial con las láminas actuales. Cada especie
 *  exagera lo que tiene sentido botánico: follaje en las de hoja, floración en
 *  cactus, suculenta y lavanda, copa más densa en el olivo. */
export type SpecialFx = { copies: LeafCopy[]; blooms?: [x: number, y: number, size: number][]; tint?: string };

export const SPECIAL_FX: Record<Species, SpecialFx> = {
  monstera: { copies: [{ x: -26, y: 4, s: 0.84, r: -10, flip: true }, { x: 26, y: 6, s: 0.8, r: 9 }, { x: 0, y: -12, s: 0.7, r: 0, flip: true }] },
  lavanda: { copies: [{ x: -22, y: 3, s: 0.9, r: -7, flip: true }, { x: 22, y: 3, s: 0.88, r: 7 }], tint: "saturate(2.2) hue-rotate(-6deg)" },
  cactus: { copies: [], blooms: [[50, 4, 13], [29, 27, 11], [77, 37, 11], [62, 12, 8]] },
  helecho: { copies: [{ x: -20, y: 6, s: 0.9, r: -12, flip: true }, { x: 20, y: 6, s: 0.9, r: 12 }] },
  suculenta: { copies: [{ x: -38, y: 28, s: 0.42, r: -4 }, { x: 40, y: 30, s: 0.38, r: 6, flip: true }], blooms: [[50, 8, 9]] },
  olivo: { copies: [{ x: -14, y: -4, s: 0.85, r: -6, flip: true, clip: "inset(0 0 45% 0)" }, { x: 16, y: -2, s: 0.8, r: 6, clip: "inset(0 0 45% 0)" }] },
  bambu: { copies: [{ x: -20, y: 0, s: 0.92, r: -2, flip: true }, { x: 20, y: 2, s: 0.86, r: 3 }] },
  potos: { copies: [{ x: -8, y: 26, s: 0.95, r: -4, clip: "inset(48% 0 0 0)" }, { x: 10, y: 40, s: 0.9, r: 5, flip: true, clip: "inset(48% 0 0 0)" }] },
  sansevieria: { copies: [{ x: -18, y: 4, s: 0.82, r: -6, flip: true }, { x: 18, y: 5, s: 0.78, r: 6 }] },
  pilea: { copies: [{ x: -20, y: -6, s: 0.8, r: -8, clip: "inset(0 0 42% 0)" }, { x: 20, y: -8, s: 0.78, r: 8, flip: true, clip: "inset(0 0 42% 0)" }, { x: 0, y: -18, s: 0.66, r: 0, clip: "inset(0 0 42% 0)" }] },
  palmera: { copies: [{ x: -22, y: 8, s: 0.78, r: -10, flip: true }, { x: 22, y: 10, s: 0.74, r: 10 }] },
  eucalipto: { copies: [{ x: -18, y: 2, s: 0.88, r: -8, flip: true }, { x: 18, y: 4, s: 0.84, r: 8 }] },
};

export type PlantVisual = {
  art: ArtRef;
  /** tratamiento CSS de sed (solo si no hay lámina propia de sed) */
  droop: boolean;
  /** montaje especial (solo si no hay lámina propia especial) */
  special: SpecialFx | null;
};

export function baseArt(species: Species, stage: StageKey): ArtRef {
  const hi = HIRES_ART[species]?.[stage];
  if (hi) return hi;
  const d = PLANT_ASSET_DIMS[species].large;
  return { src: plantAssetPath(species, stage, "light", "large"), w: d.w, h: d.h };
}

export function plantVisual(species: Species, stage: StageKey, look: PlantLook): PlantVisual {
  const own = look === "normal" ? undefined : VARIANT_ART[species]?.[look];
  if (own) return { art: own, droop: false, special: null };
  return {
    art: baseArt(species, stage),
    droop: look === "sed",
    special: look === "especial" && stage === "planta-completa" ? SPECIAL_FX[species] : null,
  };
}
