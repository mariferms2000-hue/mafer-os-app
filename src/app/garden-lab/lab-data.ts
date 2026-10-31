/* Laboratorio visual del Jardín (F4 · Bloque 1) — datos de demostración.

   Nada de esto lee ni escribe la base: es un jardín ficticio y fijo para comparar
   las cuatro direcciones con exactamente las mismas plantas.

   ESCALA FÍSICA
   Cada especie tiene un alto real aproximado (planta + maceta, en cm) y una
   categoría que dice dónde vive naturalmente. La escena convierte cm a alto de
   pantalla con la profundidad: lo que está al fondo se encoge. Así una suculenta
   nunca mide lo mismo que un bambú. */

import type { StageKey } from "@/lib/focus-logic";
import type { IllustratedPlantSpecies } from "@/lib/plant-assets";

export type Species = IllustratedPlantSpecies;

export type ScaleTier = "mini" | "mesa" | "colgante" | "pedestal" | "suelo" | "alta";

export const TIER_LABEL: Record<ScaleTier, string> = {
  mini: "Mini",
  mesa: "Mesa",
  colgante: "Colgante",
  pedestal: "Pedestal",
  suelo: "Suelo",
  alta: "Alta",
};

/** Alto total (planta + maceta) y maceta, en cm. `pot: null` = la lámina ya
 *  trae su recipiente (potos, pilea). */
export type SpeciesScale = {
  tier: ScaleTier;
  cm: number;
  pot: { h: number; w: number; shape: "cuenco" | "media" | "alta" } | null;
};

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

export const SPECIES_ORDER: Species[] = [
  "suculenta", "cactus", "pilea", "lavanda", "potos", "helecho",
  "sansevieria", "monstera", "palmera", "eucalipto", "olivo", "bambu",
];

/** Altura del cuarto que cabe en pantalla en primer plano (z = 0). */
export const ROOM_CM = 236;
/** Cuánto encoge lo que está al fondo del todo (z = 1). */
export const DEPTH_SHRINK = 0.42;

/** cqh (alto de escena) por cm a la profundidad z. */
export const cqhPerCm = (z: number) => (100 / ROOM_CM) * (1 - DEPTH_SHRINK * z);

// ── El jardín de demostración ─────────────────────────────────────

export type DemoPlant = { id: string; species: Species; completedAt: string; minutes: number };

/** Las 11 completadas del ejemplo (la actual se elige en el lab). */
export const DEMO_COMPLETED: DemoPlant[] = [
  { id: "p-suculenta", species: "suculenta", completedAt: "2 sep", minutes: 152 },
  { id: "p-cactus", species: "cactus", completedAt: "9 sep", minutes: 160 },
  { id: "p-pilea", species: "pilea", completedAt: "14 sep", minutes: 151 },
  { id: "p-lavanda", species: "lavanda", completedAt: "20 sep", minutes: 155 },
  { id: "p-potos", species: "potos", completedAt: "25 sep", minutes: 150 },
  { id: "p-helecho", species: "helecho", completedAt: "1 oct", minutes: 158 },
  { id: "p-sansevieria", species: "sansevieria", completedAt: "6 oct", minutes: 150 },
  { id: "p-palmera", species: "palmera", completedAt: "12 oct", minutes: 163 },
  { id: "p-eucalipto", species: "eucalipto", completedAt: "17 oct", minutes: 150 },
  { id: "p-olivo", species: "olivo", completedAt: "23 oct", minutes: 171 },
  { id: "p-bambu", species: "bambu", completedAt: "28 oct", minutes: 150 },
];

export const HERO_ID = "actual";

// ── Composición ───────────────────────────────────────────────────

export type Support =
  | { kind: "none" }
  | { kind: "pedestal"; cm: number; w: number } // cilindro de yeso / travertino
  | { kind: "plinth"; cm: number; w: number } // cubo
  | { kind: "stool"; cm: number; w: number } // banquito de madera
  | { kind: "hang"; drop: number }; // colgada del techo; drop = % de escena hasta la base

export type Slot = {
  /** id de planta (HERO_ID para la actual, «misterio» para la próxima) */
  plant: string;
  /** centro horizontal, % */
  x: number;
  /** punto de apoyo en el suelo (o sobre la repisa/peldaño), % desde arriba */
  y: number;
  /** profundidad 0 (delante) → 1 (fondo) */
  z: number;
  support?: Support;
};

export type Direction = "A" | "B" | "C" | "D";

export const DIRECTIONS: { key: Direction; name: string; line: string }[] = [
  { key: "A", name: "Atelier Invernadero", line: "Estudio de trabajo con muro de cristal y mesa de trasplante." },
  { key: "B", name: "Botanical Sunroom", line: "Sala soleada y residencial: ventanal, alfombra, alturas mezcladas." },
  { key: "C", name: "Botanical Studio", line: "Estudio editorial: ciclorama, pedestales y una luz principal." },
  { key: "D", name: "Conservatory Alcove", line: "Nicho de cristal envolvente con gradas y follaje en primer plano." },
];

/* Superficies compartidas entre la decoración y los sitios: si una repisa se
   mueve, sus plantas se mueven con ella. */
export const SURF = {
  A: { etagere: [44, 61, 78] as const, bench: 72 },
  B: { ladder: [50, 64, 78] as const, sill: 55 },
  C: { shelf: 36 },
  D: { steps: [64, 72, 80] as const },
};

type Layout = { wide: Slot[]; narrow: Slot[] };

export const LAYOUTS: Record<Direction, Layout> = {
  // ── A · Atelier Invernadero ──
  A: {
    wide: [
      { plant: "p-bambu", x: 9, y: 70, z: 0.62 },
      { plant: "p-olivo", x: 25, y: 68, z: 0.78 },
      { plant: "p-potos", x: 34, y: 0, z: 0.5, support: { kind: "hang", drop: 30 } },
      { plant: "p-palmera", x: 63, y: 69, z: 0.72 },
      { plant: "p-eucalipto", x: 94, y: 74, z: 0.46 },
      { plant: "p-suculenta", x: 78, y: SURF.A.etagere[0], z: 0.4 },
      { plant: "p-cactus", x: 75, y: SURF.A.etagere[1], z: 0.35 },
      { plant: "p-pilea", x: 81, y: SURF.A.etagere[1], z: 0.35 },
      { plant: "p-lavanda", x: 78, y: SURF.A.etagere[2], z: 0.3 },
      { plant: "p-helecho", x: 15, y: 96, z: 0.12, support: { kind: "pedestal", cm: 42, w: 22 } },
      { plant: "p-sansevieria", x: 88, y: 99, z: 0.04 },
      { plant: HERO_ID, x: 47, y: 93, z: -0.3, support: { kind: "stool", cm: 34, w: 58 } },
      { plant: "misterio", x: 60, y: 82, z: 0.18 },
    ],
    narrow: [
      { plant: "p-bambu", x: 14, y: 64, z: 0.7 },
      { plant: "p-palmera", x: 84, y: 64, z: 0.72 },
      { plant: "p-potos", x: 70, y: 0, z: 0.5, support: { kind: "hang", drop: 24 } },
      { plant: "p-lavanda", x: 26, y: 84, z: 0.25, support: { kind: "stool", cm: 22, w: 30 } },
      { plant: "p-cactus", x: 82, y: 86, z: 0.2, support: { kind: "pedestal", cm: 28, w: 20 } },
      { plant: "p-suculenta", x: 64, y: 90, z: 0.12 },
      { plant: HERO_ID, x: 46, y: 97, z: -0.3, support: { kind: "stool", cm: 26, w: 52 } },
    ],
  },

  // ── B · Botanical Sunroom ──
  B: {
    wide: [
      { plant: "p-olivo", x: 36, y: 67, z: 0.8 },
      { plant: "p-palmera", x: 8, y: 80, z: 0.42 },
      { plant: "p-potos", x: 24, y: 0, z: 0.4, support: { kind: "hang", drop: 28 } },
      { plant: "p-pilea", x: 86, y: SURF.B.ladder[0], z: 0.45 },
      { plant: "p-suculenta", x: 84, y: SURF.B.ladder[1], z: 0.42 },
      { plant: "p-cactus", x: 89, y: SURF.B.ladder[1], z: 0.42 },
      { plant: "p-lavanda", x: 86, y: SURF.B.ladder[2], z: 0.38 },
      { plant: "p-bambu", x: 66, y: 70, z: 0.7 },
      { plant: "p-eucalipto", x: 76, y: 72, z: 0.62 },
      { plant: "p-helecho", x: 23, y: 95, z: 0.14, support: { kind: "stool", cm: 40, w: 28 } },
      { plant: "p-sansevieria", x: 70, y: 96, z: 0.1 },
      { plant: HERO_ID, x: 47, y: 92, z: -0.3, support: { kind: "plinth", cm: 30, w: 44 } },
      { plant: "misterio", x: 58, y: 84, z: 0.28 },
    ],
    narrow: [
      { plant: "p-olivo", x: 74, y: 64, z: 0.8 },
      { plant: "p-potos", x: 22, y: 0, z: 0.4, support: { kind: "hang", drop: 24 } },
      { plant: "p-eucalipto", x: 90, y: 70, z: 0.55 },
      { plant: "p-helecho", x: 16, y: 88, z: 0.2, support: { kind: "stool", cm: 34, w: 26 } },
      { plant: "p-pilea", x: 78, y: 92, z: 0.12 },
      { plant: "p-suculenta", x: 64, y: 95, z: 0.04 },
      { plant: HERO_ID, x: 46, y: 96, z: -0.3, support: { kind: "plinth", cm: 26, w: 42 } },
    ],
  },

  // ── C · Botanical Studio ──
  C: {
    wide: [
      { plant: "p-suculenta", x: 8, y: SURF.C.shelf, z: 0.5 },
      { plant: "p-cactus", x: 15, y: SURF.C.shelf, z: 0.5 },
      { plant: "p-pilea", x: 23, y: SURF.C.shelf, z: 0.5 },
      { plant: "p-bambu", x: 31, y: 74, z: 0.74 },
      { plant: "p-olivo", x: 40, y: 72, z: 0.86 },
      { plant: "p-eucalipto", x: 63, y: 72, z: 0.86 },
      { plant: "p-palmera", x: 84, y: 80, z: 0.55 },
      { plant: "p-lavanda", x: 71, y: 84, z: 0.42, support: { kind: "pedestal", cm: 62, w: 24 } },
      { plant: "p-helecho", x: 23, y: 90, z: 0.26, support: { kind: "plinth", cm: 46, w: 32 } },
      { plant: "p-potos", x: 95, y: 94, z: 0.2, support: { kind: "pedestal", cm: 88, w: 26 } },
      { plant: "p-sansevieria", x: 8, y: 98, z: 0.08, support: { kind: "plinth", cm: 14, w: 30 } },
      { plant: HERO_ID, x: 50, y: 96, z: -0.3, support: { kind: "pedestal", cm: 36, w: 46 } },
      { plant: "misterio", x: 62, y: 91, z: 0.2, support: { kind: "plinth", cm: 22, w: 22 } },
    ],
    narrow: [
      { plant: "p-cactus", x: 14, y: 33, z: 0.5 },
      { plant: "p-suculenta", x: 26, y: 33, z: 0.5 },
      { plant: "p-olivo", x: 82, y: 70, z: 0.7 },
      { plant: "p-lavanda", x: 16, y: 88, z: 0.3, support: { kind: "pedestal", cm: 50, w: 22 } },
      { plant: "p-potos", x: 84, y: 92, z: 0.18, support: { kind: "pedestal", cm: 66, w: 24 } },
      { plant: HERO_ID, x: 48, y: 97, z: -0.3, support: { kind: "pedestal", cm: 30, w: 44 } },
    ],
  },

  // ── D · Conservatory Alcove ──
  D: {
    wide: [
      { plant: "p-bambu", x: 22, y: SURF.D.steps[0], z: 0.78 },
      { plant: "p-palmera", x: 50, y: SURF.D.steps[0] - 1, z: 0.84 },
      { plant: "p-eucalipto", x: 77, y: SURF.D.steps[0], z: 0.78 },
      { plant: "p-olivo", x: 34, y: SURF.D.steps[1], z: 0.6 },
      { plant: "p-sansevieria", x: 65, y: SURF.D.steps[1], z: 0.6 },
      { plant: "p-helecho", x: 15, y: SURF.D.steps[2], z: 0.42 },
      { plant: "p-lavanda", x: 31, y: SURF.D.steps[2], z: 0.42 },
      { plant: "p-cactus", x: 70, y: SURF.D.steps[2], z: 0.42 },
      { plant: "p-pilea", x: 84, y: SURF.D.steps[2], z: 0.42 },
      { plant: "p-potos", x: 85, y: 0, z: 0.35, support: { kind: "hang", drop: 26 } },
      { plant: "p-suculenta", x: 62, y: 93, z: 0.14, support: { kind: "plinth", cm: 18, w: 22 } },
      { plant: HERO_ID, x: 46, y: 96, z: -0.3, support: { kind: "pedestal", cm: 30, w: 50 } },
      { plant: "misterio", x: 30, y: 92, z: 0.16, support: { kind: "plinth", cm: 14, w: 20 } },
    ],
    narrow: [
      { plant: "p-palmera", x: 50, y: 62, z: 0.86 },
      { plant: "p-bambu", x: 16, y: 66, z: 0.75 },
      { plant: "p-olivo", x: 84, y: 66, z: 0.72 },
      { plant: "p-helecho", x: 18, y: 82, z: 0.4 },
      { plant: "p-cactus", x: 82, y: 82, z: 0.4 },
      { plant: HERO_ID, x: 48, y: 97, z: -0.3, support: { kind: "pedestal", cm: 26, w: 46 } },
    ],
  },
};

export const STAGE_OPTIONS: { key: StageKey; label: string; minutes: number }[] = [
  { key: "semilla", label: "Semilla", minutes: 5 },
  { key: "brote", label: "Brote", minutes: 22 },
  { key: "hojas", label: "Hojas", minutes: 55 },
  { key: "planta-joven", label: "Planta joven", minutes: 104 },
  { key: "planta-completa", label: "Planta completa", minutes: 150 },
];
