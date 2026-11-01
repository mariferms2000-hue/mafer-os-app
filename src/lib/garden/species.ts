import type { IllustratedPlantSpecies } from "@/lib/plant-assets";

/* Escala física de cada especie en el invernadero (F4). Cada especie tiene un
   alto real aproximado (planta + maceta, en cm) y una categoría que dice dónde
   vive naturalmente; la escena convierte cm a pantalla con la profundidad, así
   que una suculenta nunca mide lo mismo que un bambú. */

export type Species = IllustratedPlantSpecies;
export type ScaleTier = "mini" | "mesa" | "colgante" | "pedestal" | "suelo" | "alta";
export type PotShape = "cuenco" | "media" | "alta";

/** Alto total y maceta, en cm. `pot: null` = la lámina ya trae su recipiente. */
export type SpeciesScale = { tier: ScaleTier; cm: number; pot: { h: number; w: number; shape: PotShape } | null };

export const SPECIES_SCALE: Record<Species, SpeciesScale> = {
  suculenta: { tier: "mini", cm: 17, pot: { h: 7, w: 15, shape: "cuenco" } },
  cactus: { tier: "mesa", cm: 36, pot: { h: 10, w: 17, shape: "cuenco" } },
  pilea: { tier: "mesa", cm: 30, pot: null },
  lavanda: { tier: "mesa", cm: 42, pot: { h: 12, w: 22, shape: "cuenco" } },
  potos: { tier: "colgante", cm: 44, pot: null },
  helecho: { tier: "pedestal", cm: 58, pot: { h: 20, w: 25, shape: "media" } },
  sansevieria: { tier: "pedestal", cm: 72, pot: { h: 26, w: 22, shape: "alta" } },
  monstera: { tier: "suelo", cm: 112, pot: { h: 32, w: 38, shape: "media" } },
  palmera: { tier: "suelo", cm: 148, pot: { h: 38, w: 40, shape: "media" } },
  eucalipto: { tier: "alta", cm: 160, pot: { h: 40, w: 30, shape: "alta" } },
  olivo: { tier: "alta", cm: 168, pot: { h: 44, w: 42, shape: "alta" } },
  bambu: { tier: "alta", cm: 186, pot: { h: 42, w: 32, shape: "alta" } },
};

export const LATIN: Record<Species, string> = {
  monstera: "Monstera deliciosa",
  lavanda: "Lavandula angustifolia",
  cactus: "Cereus peruvianus",
  helecho: "Nephrolepis exaltata",
  suculenta: "Echeveria elegans",
  olivo: "Olea europaea",
  bambu: "Phyllostachys aurea",
  potos: "Epipremnum aureum",
  sansevieria: "Dracaena trifasciata",
  pilea: "Pilea peperomioides",
  eucalipto: "Eucalyptus gunnii",
  palmera: "Chamaerops humilis",
};

export function isSpecies(s: string): s is Species {
  return s in SPECIES_SCALE;
}

/** Cualquier especie desconocida en la base se dibuja como helecho (igual que
 *  el resto del jardín). */
export function asSpecies(s: string): Species {
  return isSpecies(s) ? s : "helecho";
}
