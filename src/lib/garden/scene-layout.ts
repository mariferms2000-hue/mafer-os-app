import { SPECIES_SCALE, type ScaleTier, type Species } from "./species";

/* Composición del invernadero (F4, dirección A2 · Luz de invernadero).

   Cada escena es una plantilla fija de sitios —banco, suelo, pedestal,
   colgante— y cada sitio acepta solo ciertas escalas: una suculenta va al banco,
   un bambú al suelo del fondo. Las plantas reales se reparten por prioridad
   (la especial, luego las que tienen sed, luego las más recientes) y la que no
   cabe en un sitio compatible se queda en la colección completa de abajo. Así
   la escena se ve bien igual con 3 plantas que con 600.

   Coordenadas en unidades del SVG de la escena: alto 1000 y el ancho W de su
   proporción. `y` es donde la pieza toca su superficie; `z` es la profundidad
   (0 = primer plano, 1 = fondo). */

export const SCENE_H = 1000;
/** Alto del cuarto visible en primer plano (z = 0), en cm. */
export const ROOM_CM = 270;
const DEPTH_SHRINK = 0.42;
/** cqh (alto de escena) por cm a la profundidad z. */
export const cqhPerCm = (z: number, scale = 1) => (100 / ROOM_CM) * (1 - DEPTH_SHRINK * z) * scale;

export type Material = "marfil" | "barro" | "salvia" | "piedra" | "esmalte";
export type Support = { kind: "none" } | { kind: "plinth"; cm: number; w: number } | { kind: "stand"; cm: number; w: number } | { kind: "hang" };
/** Luz secundaria de noche: foco al pie que sube por el follaje, o charco bajo la maceta. */
export type Glow = "up" | "pool";

export type SlotTemplate = {
  x: number;
  y: number;
  z: number;
  accepts: ScaleTier[];
  /** especies aceptadas además de las escalas (p. ej. el helecho colgado) */
  alsoSpecies?: Species[];
  support?: Support;
  /** sobre banco: sin sombra proyectada al suelo */
  raised?: boolean;
  glow?: Glow;
};

export type Bench = { l: number; r: number; y: number; floor: number };
export type Lamp = { x: number; y: number; small?: boolean };
export type Anchor = { x: number; y: number; z: number; support?: Support };

export type SceneTemplate = {
  W: number;
  /** multiplica la escala cm → pantalla */
  scale?: number;
  benches: Bench[];
  lamps: Lamp[];
  hero?: Anchor;
  mystery?: Anchor;
  slots: SlotTemplate[];
};

const plinth = (cm = 30, w = 32): Support => ({ kind: "plinth", cm, w });
const stand = (cm = 46, w = 22): Support => ({ kind: "stand", cm, w });
const hang: Support = { kind: "hang" };
const SMALL: ScaleTier[] = ["mini", "mesa"];
const TALL: ScaleTier[] = ["alta", "suelo"];

/** Escritorio (16:10): planta actual al centro; banco de trasplante, plantas
 *  de suelo al fondo, pedestal y una colgada. Aforo: 9. */
export const DESKTOP_SCENE: SceneTemplate = {
  W: 1600,
  benches: [{ l: 150, r: 620, y: 772, floor: 882 }],
  lamps: [{ x: 385, y: 330, small: true }],
  hero: { x: 800, y: 932, z: -0.24, support: plinth() },
  mystery: { x: 1000, y: 955, z: -0.12 },
  slots: [
    { x: 1110, y: 735, z: 0.55, accepts: ["suelo", "alta"], glow: "up" },
    { x: 1390, y: 760, z: 0.4, accepts: TALL, glow: "up" },
    { x: 250, y: 772, z: 0.26, accepts: SMALL, raised: true },
    { x: 395, y: 772, z: 0.26, accepts: SMALL, raised: true },
    { x: 520, y: 772, z: 0.26, accepts: SMALL, raised: true },
    { x: 1210, y: 915, z: 0, accepts: ["pedestal", "mesa", "mini"], support: stand(), glow: "pool" },
    { x: 610, y: 330, z: 0.3, accepts: ["colgante"], alsoSpecies: ["helecho"], support: hang },
    { x: 1490, y: 960, z: -0.08, accepts: ["pedestal", "suelo"], glow: "up" },
    { x: 70, y: 745, z: 0.5, accepts: TALL, glow: "up" },
  ],
};

/** iPhone, arriba: la planta actual sola, grande y bajo su lámpara. */
export const PHONE_HERO_SCENE: SceneTemplate = {
  W: 1000,
  scale: 1.75,
  benches: [],
  lamps: [],
  hero: { x: 500, y: 945, z: 0, support: plinth(16, 30) },
  slots: [],
};

/** iPhone, abajo: «Tu invernadero», la colección en su propia escena (4:3).
 *  Aforo: 11. */
export const PHONE_COLLECTION_SCENE: SceneTemplate = {
  W: 1333,
  scale: 1.05,
  benches: [{ l: 260, r: 1070, y: 700, floor: 790 }],
  lamps: [{ x: 660, y: 250, small: true }],
  mystery: { x: 880, y: 962, z: -0.1 },
  slots: [
    { x: 70, y: 760, z: 0.45, accepts: TALL, glow: "up" },
    { x: 1250, y: 760, z: 0.45, accepts: TALL, glow: "up" },
    { x: 360, y: 700, z: 0.4, accepts: SMALL, raised: true },
    { x: 560, y: 700, z: 0.4, accepts: SMALL, raised: true },
    { x: 760, y: 700, z: 0.4, accepts: SMALL, raised: true },
    { x: 960, y: 700, z: 0.4, accepts: SMALL, raised: true },
    { x: 330, y: 300, z: 0.3, accepts: ["colgante"], alsoSpecies: ["helecho"], support: hang },
    { x: 1000, y: 280, z: 0.3, accepts: ["colgante"], alsoSpecies: ["helecho"], support: hang },
    { x: 1175, y: 945, z: 0, accepts: ["suelo", "alta", "pedestal"], glow: "up" },
    { x: 235, y: 952, z: -0.02, accepts: ["alta", "suelo", "pedestal"], glow: "up" },
    { x: 660, y: 950, z: 0.02, accepts: ["pedestal", "mesa", "mini"], glow: "pool" },
  ],
};

export type ScenePlant = { id: string; species: Species; seed: number };
export type PlacedPlant = SlotTemplate & { plant: ScenePlant; material: Material };

const MATERIALS: Exclude<Material, "esmalte">[] = ["marfil", "barro", "piedra", "salvia"];

/** Maceta estable por planta: depende de su semilla visual, nunca del sitio. */
export function materialFor(seed: number): Exclude<Material, "esmalte"> {
  return MATERIALS[Math.abs(Math.trunc(seed)) % MATERIALS.length];
}

function fits(slot: SlotTemplate, species: Species): boolean {
  return slot.accepts.includes(SPECIES_SCALE[species].tier) || !!slot.alsoSpecies?.includes(species);
}

/** Reparte las plantas (ya ordenadas por prioridad) en los sitios de la
 *  plantilla. Cada planta toma el primer sitio libre compatible; la que no
 *  encuentra sitio no sale en la escena. Determinista. */
export function placePlants(template: SceneTemplate, plants: readonly ScenePlant[], specialId: string | null = null): PlacedPlant[] {
  const free = template.slots.map((_, i) => i);
  const out: PlacedPlant[] = [];
  for (const plant of plants) {
    if (free.length === 0) break;
    const at = free.findIndex((i) => fits(template.slots[i], plant.species));
    if (at === -1) continue;
    const slot = template.slots[free[at]];
    free.splice(at, 1);
    out.push({ ...slot, plant, material: plant.id === specialId ? "esmalte" : materialFor(plant.seed) });
  }
  return out;
}

/** Prioridad de aparición: la especial, luego las que tienen sed (para que
 *  siempre se vean), luego el resto en el orden recibido (más recientes primero). */
export function byScenePriority<T extends { id: string }>(plants: readonly T[], specialId: string | null, thirsty: ReadonlySet<string>): T[] {
  const rank = (p: T) => (p.id === specialId ? 0 : thirsty.has(p.id) ? 1 : 2);
  return plants
    .map((p, i) => ({ p, i }))
    .sort((a, b) => rank(a.p) - rank(b.p) || a.i - b.i)
    .map((x) => x.p);
}
