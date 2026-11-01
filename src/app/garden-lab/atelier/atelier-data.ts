/* Laboratorio del jardín · Ronda 2 — tres variantes de A (Atelier Invernadero).

   Mismo jardín ficticio que la ronda 1, pero con menos plantas y más espacio.
   Coordenadas en unidades del SVG de la escena: alto 1000, ancho 1600 (escritorio)
   u 800 (iPhone). `y` es el punto donde la pieza toca su superficie. */

import type { Species } from "../lab-data";

export type Variant = "1" | "2" | "3";

export const VARIANTS: { id: Variant; name: string; line: string }[] = [
  { id: "1", name: "A1 · Editorial", line: "Un solo ventanal en arco, yeso marfil y piedra clara. Calma de galería." },
  { id: "2", name: "A2 · Luz de invernadero", line: "Casa de cristal completa: el sol dibuja la herrería en el suelo; de noche, guirnaldas y lámparas." },
  { id: "3", name: "A3 · Profundidad", line: "Pasillo de arcos que se pierde al fondo, bruma y hojas desenfocadas en primer plano." },
];

/** Alto del cuarto visible en primer plano (z = 0), en cm. Más alto que en la
 *  ronda 1: las plantas ocupan menos y la arquitectura respira. */
export const ROOM_CM = 270;
export const DEPTH_SHRINK = 0.42;
export const cqhPerCm = (z: number) => (100 / ROOM_CM) * (1 - DEPTH_SHRINK * z);

export type Material = "marfil" | "barro" | "salvia" | "piedra";

export type Support =
  | { kind: "none" }
  | { kind: "plinth"; cm: number; w: number }
  | { kind: "stand"; cm: number; w: number }
  | { kind: "hang"; rope: number };

export type Slot = {
  what: Species | "hero" | "mystery";
  x: number;
  y: number;
  z: number;
  support?: Support;
  material?: Material;
  /** Sobre repisa o banco: sin sombra proyectada al suelo. */
  raised?: boolean;
  /** Desenfoque de profundidad (A3). */
  dof?: number;
};

/** Hojas fuera de foco que enmarcan la escena (A3). */
export type Frame = { species: Species; x: number; y: number; h: number; flip?: boolean; rot?: number };

export type Layout = { slots: Slot[]; frames?: Frame[] };

const plinth = (cm = 30, w = 32): Support => ({ kind: "plinth", cm, w });
const stand = (cm = 46, w = 22): Support => ({ kind: "stand", cm, w });

export const LAYOUTS: Record<Variant, { wide: Layout; narrow: Layout }> = {
  "1": {
    wide: {
      slots: [
        { what: "olivo", x: 470, y: 745, z: 0.42, material: "piedra" },
        { what: "palmera", x: 1150, y: 750, z: 0.4, material: "marfil" },
        { what: "cactus", x: 1270, y: 520, z: 0.36, material: "barro", raised: true },
        { what: "suculenta", x: 1365, y: 520, z: 0.36, material: "marfil", raised: true },
        { what: "sansevieria", x: 300, y: 905, z: 0.02, material: "marfil" },
        { what: "helecho", x: 1340, y: 925, z: -0.04, support: stand(), material: "salvia" },
        { what: "hero", x: 800, y: 930, z: -0.24, support: plinth() },
        { what: "mystery", x: 1045, y: 952, z: -0.12 },
      ],
    },
    narrow: {
      slots: [
        { what: "olivo", x: 120, y: 745, z: 0.42, material: "piedra" },
        { what: "palmera", x: 690, y: 755, z: 0.42, material: "marfil" },
        { what: "helecho", x: 665, y: 935, z: -0.04, support: stand(40, 20), material: "salvia" },
        { what: "hero", x: 375, y: 930, z: -0.24, support: plinth() },
        { what: "mystery", x: 120, y: 955, z: -0.12 },
      ],
    },
  },
  "2": {
    wide: {
      slots: [
        { what: "palmera", x: 1110, y: 735, z: 0.55, material: "barro" },
        { what: "bambu", x: 1390, y: 760, z: 0.4, material: "piedra" },
        { what: "lavanda", x: 250, y: 772, z: 0.26, material: "barro", raised: true },
        { what: "cactus", x: 395, y: 772, z: 0.26, material: "marfil", raised: true },
        { what: "suculenta", x: 520, y: 772, z: 0.26, material: "barro", raised: true },
        { what: "potos", x: 610, y: 330, z: 0.3, support: { kind: "hang", rope: 0 } },
        { what: "helecho", x: 1210, y: 915, z: 0.0, support: stand(), material: "salvia" },
        { what: "sansevieria", x: 1490, y: 960, z: -0.08, material: "marfil" },
        { what: "hero", x: 800, y: 932, z: -0.24, support: plinth() },
        { what: "mystery", x: 1000, y: 955, z: -0.12 },
      ],
    },
    narrow: {
      slots: [
        { what: "palmera", x: 640, y: 740, z: 0.55, material: "barro" },
        { what: "lavanda", x: 85, y: 772, z: 0.26, material: "barro", raised: true },
        { what: "cactus", x: 215, y: 772, z: 0.26, material: "marfil", raised: true },
        { what: "potos", x: 610, y: 330, z: 0.3, support: { kind: "hang", rope: 0 } },
        { what: "hero", x: 400, y: 932, z: -0.24, support: plinth() },
        { what: "mystery", x: 680, y: 958, z: -0.12 },
      ],
    },
  },
  "3": {
    wide: {
      slots: [
        { what: "bambu", x: 655, y: 668, z: 0.86, material: "piedra", dof: 1.6 },
        { what: "eucalipto", x: 955, y: 668, z: 0.86, material: "marfil", dof: 1.6 },
        { what: "olivo", x: 420, y: 770, z: 0.5, material: "piedra", dof: 0.6 },
        { what: "palmera", x: 1185, y: 770, z: 0.5, material: "barro", dof: 0.6 },
        { what: "potos", x: 1040, y: 360, z: 0.45, support: { kind: "hang", rope: 0 }, dof: 0.4 },
        { what: "sansevieria", x: 255, y: 935, z: 0.0, material: "marfil" },
        { what: "helecho", x: 1350, y: 940, z: -0.02, support: stand(), material: "salvia" },
        { what: "hero", x: 800, y: 935, z: -0.24, support: plinth() },
        { what: "mystery", x: 1010, y: 958, z: -0.12 },
      ],
      frames: [
        { species: "monstera", x: 40, y: 1090, h: 520 },
        { species: "helecho", x: 1600, y: 250, h: 380, flip: true, rot: 180 },
      ],
    },
    narrow: {
      slots: [
        { what: "bambu", x: 335, y: 655, z: 0.86, material: "piedra", dof: 1.6 },
        { what: "eucalipto", x: 470, y: 655, z: 0.86, material: "marfil", dof: 1.6 },
        { what: "palmera", x: 560, y: 775, z: 0.5, material: "barro", dof: 0.6 },
        { what: "hero", x: 390, y: 935, z: -0.24, support: plinth() },
        { what: "mystery", x: 640, y: 960, z: -0.12 },
      ],
      frames: [
        { species: "monstera", x: -40, y: 1090, h: 430 },
        { species: "helecho", x: 800, y: 210, h: 300, flip: true, rot: 180 },
      ],
    },
  },
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
