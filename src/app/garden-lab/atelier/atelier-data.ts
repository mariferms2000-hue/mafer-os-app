/* Laboratorio del jardín · Ronda 3 — A2 (Luz de invernadero) en escritorio y
   tres propuestas de iPhone.

   Mismo jardín ficticio de siempre. Coordenadas en unidades del SVG de cada
   escena: alto 1000 y el ancho que dicte su proporción. `y` es el punto donde la
   pieza toca su superficie. */

import type { Species } from "../lab-data";

/** Alto del cuarto visible en primer plano (z = 0), en cm. */
export const ROOM_CM = 270;
export const DEPTH_SHRINK = 0.42;
export const cqhPerCm = (z: number, scale = 1) => (100 / ROOM_CM) * (1 - DEPTH_SHRINK * z) * scale;

export type Material = "marfil" | "barro" | "salvia" | "piedra";

export type Support =
  | { kind: "none" }
  | { kind: "plinth"; cm: number; w: number }
  | { kind: "stand"; cm: number; w: number }
  | { kind: "hang" };

/** Luz secundaria de noche: foco al pie que sube por el follaje, o charco bajo la maceta. */
export type Glow = "up" | "pool";

export type Slot = {
  what: Species | "hero" | "mystery";
  x: number;
  y: number;
  z: number;
  support?: Support;
  material?: Material;
  /** Sobre banco o grada: sin sombra proyectada al suelo. */
  raised?: boolean;
  glow?: Glow;
};

/** Tablero de banco o escalón de grada: tapa en `y`, patas hasta `floor`. */
export type Bench = { l: number; r: number; y: number; floor: number };
export type Lamp = { x: number; y: number; small?: boolean };

export type Layout = {
  W: number;
  /** Multiplica la escala cm → pantalla (una escena alta muestra más cuarto). */
  scale?: number;
  slots: Slot[];
  benches: Bench[];
  lamps: Lamp[];
};

const plinth = (cm = 30, w = 32): Support => ({ kind: "plinth", cm, w });
const stand = (cm = 46, w = 22): Support => ({ kind: "stand", cm, w });
const hang: Support = { kind: "hang" };

/** Escritorio (16:10). */
export const DESKTOP: Layout = {
  W: 1600,
  slots: [
    { what: "palmera", x: 1110, y: 735, z: 0.55, material: "barro", glow: "up" },
    { what: "bambu", x: 1390, y: 760, z: 0.4, material: "piedra", glow: "up" },
    { what: "lavanda", x: 250, y: 772, z: 0.26, material: "barro", raised: true },
    { what: "cactus", x: 395, y: 772, z: 0.26, material: "marfil", raised: true },
    { what: "suculenta", x: 520, y: 772, z: 0.26, material: "barro", raised: true },
    { what: "potos", x: 610, y: 330, z: 0.3, support: hang },
    { what: "helecho", x: 1210, y: 915, z: 0.0, support: stand(), material: "salvia", glow: "pool" },
    { what: "sansevieria", x: 1490, y: 960, z: -0.08, material: "marfil", glow: "up" },
    { what: "hero", x: 800, y: 932, z: -0.24, support: plinth() },
    { what: "mystery", x: 1000, y: 955, z: -0.12 },
  ],
  benches: [{ l: 150, r: 620, y: 772, floor: 882 }],
  lamps: [{ x: 385, y: 330, small: true }],
};

/** M1 · Vitrina alta: una sola escena vertical; gradas al fondo y plantas colgadas arriba. */
export const M1: Layout = {
  W: 560,
  scale: 0.8,
  slots: [
    { what: "bambu", x: 40, y: 742, z: 0.5, material: "piedra", glow: "up" },
    { what: "palmera", x: 520, y: 742, z: 0.55, material: "barro", glow: "up" },
    { what: "potos", x: 150, y: 330, z: 0.3, support: hang },
    { what: "helecho", x: 420, y: 300, z: 0.3, support: hang, material: "barro" },
    { what: "cactus", x: 125, y: 688, z: 0.42, material: "marfil", raised: true },
    { what: "suculenta", x: 438, y: 688, z: 0.42, material: "barro", raised: true },
    { what: "lavanda", x: 105, y: 752, z: 0.32, material: "barro", raised: true },
    { what: "pilea", x: 455, y: 752, z: 0.32, raised: true },
    { what: "sansevieria", x: 455, y: 905, z: 0.04, material: "marfil", glow: "pool" },
    { what: "hero", x: 280, y: 950, z: -0.6, support: plinth(24, 30) },
    { what: "mystery", x: 95, y: 958, z: -0.12 },
  ],
  benches: [
    { l: 40, r: 520, y: 688, floor: 742 },
    { l: 20, r: 540, y: 752, floor: 812 },
  ],
  lamps: [],
};

/** M3 · Protagonista + invernadero: dos escenas, una para la planta actual y otra para la colección. */
export const M3_HERO: Layout = {
  W: 1000,
  scale: 1.75,
  slots: [{ what: "hero", x: 500, y: 945, z: 0, support: plinth(16, 30) }],
  benches: [],
  lamps: [],
};
export const M3_COLLECTION: Layout = {
  W: 1333,
  scale: 1.05,
  slots: [
    { what: "bambu", x: 70, y: 760, z: 0.45, material: "piedra", glow: "up" },
    { what: "olivo", x: 1250, y: 760, z: 0.45, material: "piedra", glow: "up" },
    { what: "potos", x: 330, y: 300, z: 0.3, support: hang },
    { what: "helecho", x: 1000, y: 280, z: 0.3, support: hang, material: "barro" },
    { what: "cactus", x: 360, y: 700, z: 0.4, material: "marfil", raised: true },
    { what: "pilea", x: 560, y: 700, z: 0.4, raised: true },
    { what: "suculenta", x: 760, y: 700, z: 0.4, material: "barro", raised: true },
    { what: "lavanda", x: 960, y: 700, z: 0.4, material: "barro", raised: true },
    { what: "palmera", x: 1175, y: 945, z: 0.0, material: "barro", glow: "up" },
    { what: "sansevieria", x: 660, y: 950, z: 0.02, material: "marfil", glow: "pool" },
    { what: "eucalipto", x: 235, y: 952, z: -0.02, material: "marfil", glow: "up" },
    { what: "mystery", x: 880, y: 962, z: -0.1 },
  ],
  benches: [{ l: 260, r: 1070, y: 700, floor: 790 }],
  lamps: [{ x: 660, y: 250, small: true }],
};

export const PHONE_VARIANTS = [
  { id: "M1", name: "M1 · Vitrina alta", line: "Una escena vertical: gradas, plantas colgadas y la actual al frente." },
  { id: "M2", name: "M2 · Panorama", line: "El invernadero completo; se desliza de lado para recorrerlo." },
  { id: "M3", name: "M3 · Protagonista + invernadero", line: "La planta actual en su propia escena y, abajo, la colección entera." },
] as const;
export type PhoneVariant = (typeof PHONE_VARIANTS)[number]["id"];

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
