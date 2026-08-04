/* Disposición de la escena de «Mi jardín» — el cuarto botánico ilustrado.

   Módulo puro: sin React, sin base de datos, sin acceso al DOM. Define DÓNDE
   puede posarse una planta sobre el fondo ilustrado y CUÁNTO puede medir ahí,
   y reparte las plantas completadas entre esos sitios de forma determinista.

   Las coordenadas NO son inventadas: salen de medir la ilustración real
   (public/garden/cuarto-{claro,oscuro}.webp, lienzo 1586×991). Cada línea de
   apoyo es el promedio de la variante clara y la oscura, así ninguna de las
   dos queda desalineada al cambiar de tema.

   La habitación tiene perspectiva: la repisa alta sube 2.1 % de izquierda a
   derecha y el suelo baja hacia el frente. Por eso cada sitio lleva su PROPIA
   línea de apoyo y su propio alto — no hay «filas» rectas.

   Principios que no cambian:
   - El cuarto es una VITRINA con aforo, no un contenedor. La colección
     completa vive en el invernadero.
   - Solo las plantas COMPLETADAS se posan en repisas y suelo: son las únicas
     cuyo asset incluye maceta. La planta actual, en etapa de espécimen y con
     raíces al aire, vive en el banco de propagación bajo la ventana.
   - Nadie se deforma ni invade a su vecina.

   Coordenadas: porcentajes de la escena. `x` es el centro horizontal y
   `baseline` la línea de apoyo medida desde arriba. */

import { PLANT_ASSET_DIMS, isIllustratedPlantSpecies } from "./plant-assets";

// ── Escena ───────────────────────────────────────────────────────

/** Dos composiciones sobre la MISMA ilustración: escritorio usa las tres
 *  repisas y el suelo; móvil se queda con las superficies que conservan altura
 *  legible a 390 px de ancho. */
export type GardenBreakpoint = "wide" | "narrow";

/** Cada lienzo de fondo con su propio sistema de coordenadas. En escritorio la
 *  habitación cabe entera; en móvil se recorre en dos vistas apiladas del mismo
 *  cuarto — arriba la ventana con su banco, abajo las repisas y el suelo. */
export type GardenScene = "wide" | "movil-a" | "movil-b";

/** Qué lienzos se pintan en cada composición, en orden de arriba abajo. */
export const SCENES_FOR: Record<GardenBreakpoint, GardenScene[]> = {
  wide: ["wide"],
  narrow: ["movil-a", "movil-b"],
};

export type GardenSurface = "alfeizar" | "repisa-alta" | "repisa-media" | "repisa-baja" | "piso";

/** Proporción del lienzo ilustrado (1586 × 991). Debe coincidir con el
 *  aspect-ratio del contenedor o los sitios dejarían de caer sobre las
 *  superficies pintadas. Ambas composiciones comparten fondo. */
export const SCENE_ASPECT: Record<GardenScene, number> = {
  wide: 1586 / 991,
  "movil-a": 700 / 780,
  "movil-b": 986 / 940,
};

export type GardenSlot = {
  id: string;
  surface: GardenSurface;
  /** lienzo al que pertenecen sus coordenadas */
  scene: GardenScene;
  /** centro horizontal, % del ancho de la escena */
  x: number;
  /** línea de apoyo, % del alto de la escena medido desde arriba */
  baseline: number;
  /** alto objetivo del lienzo de la planta, % del alto de la escena */
  height: number;
  /** ancho máximo permitido, % del ancho de la escena */
  maxWidth: number;
  /** orden visual de lectura (arriba→abajo, izquierda→derecha) para el tabulador */
  order: number;
};

const slot = (
  scene: GardenScene,
  id: string,
  surface: GardenSurface,
  x: number,
  baseline: number,
  height: number,
  maxWidth: number,
  order: number
): GardenSlot => ({ id, surface, scene, x, baseline, height, maxWidth, order });

/** Escritorio: la habitación entera. Las repisas de esta ilustración llegan
 *  desde el 38.8 % hasta el borde derecho —un 50 % más largas que las de la
 *  versión anterior—, así que caben seis por repisa con holgura en vez de
 *  apretarlas. Líneas de apoyo medidas sobre la ilustración y promediadas
 *  entre la variante clara y la oscura. */
const WIDE: GardenSlot[] = [
  // Repisa alta — sube 5 % hacia la derecha; poco techo, plantas más bajas
  slot("wide", "repisa-alta-1", "repisa-alta", 45, 16.26, 11, 9, 0),
  slot("wide", "repisa-alta-2", "repisa-alta", 55, 15.36, 11, 9, 1),
  slot("wide", "repisa-alta-3", "repisa-alta", 65, 14.46, 11, 9, 2),
  slot("wide", "repisa-alta-4", "repisa-alta", 75, 13.56, 11, 9, 3),
  slot("wide", "repisa-alta-5", "repisa-alta", 85, 12.66, 11, 9, 4),
  slot("wide", "repisa-alta-6", "repisa-alta", 95, 11.76, 11, 9, 5),
  // Repisa media — casi horizontal
  slot("wide", "repisa-media-1", "repisa-media", 45, 34.02, 14, 9, 6),
  slot("wide", "repisa-media-2", "repisa-media", 55, 33.75, 14, 9, 7),
  slot("wide", "repisa-media-3", "repisa-media", 65, 33.48, 14, 9, 8),
  slot("wide", "repisa-media-4", "repisa-media", 75, 33.22, 14, 9, 9),
  slot("wide", "repisa-media-5", "repisa-media", 85, 32.95, 14, 9, 10),
  slot("wide", "repisa-media-6", "repisa-media", 95, 32.68, 14, 9, 11),
  // Repisa baja — baja hacia la derecha y termina antes (94.5 %)
  slot("wide", "repisa-baja-1", "repisa-baja", 45, 49.32, 14, 9, 12),
  slot("wide", "repisa-baja-2", "repisa-baja", 55, 49.91, 14, 9, 13),
  slot("wide", "repisa-baja-3", "repisa-baja", 65, 50.50, 14, 9, 14),
  slot("wide", "repisa-baja-4", "repisa-baja", 75, 51.09, 14, 9, 15),
  slot("wide", "repisa-baja-5", "repisa-baja", 85, 51.68, 14, 9, 16),
  // Suelo — entre el banco (termina en el 40 %) y la caja de madera (empieza
  // en el 74 %). Más cerca del frente = más grandes.
  slot("wide", "piso-1", "piso", 47, 89, 17, 9, 17),
  slot("wide", "piso-2", "piso", 57, 92, 19, 9, 18),
  slot("wide", "piso-3", "piso", 67, 87, 16, 9, 19),
];

/** Móvil: el mismo cuarto recorrido en dos vistas apiladas.
 *
 *  Panel A — ventana y banco de propagación           (recorte x 0-700, y 120-900)
 *  Panel B — las tres repisas y el suelo             (recorte x 600-1586, y 0-940)
 *
 *  Cuatro o cinco sitios por repisa en vez de seis: a 390 px de ancho eso deja
 *  plantas de 64-75 px, claramente visibles y tocables. */
const NARROW: GardenSlot[] = [
  // ── Panel A · la planta actual en su banco, bajo la ventana ──
  // Sin sitios extra: en esta habitación el banco está pegado a la ventana y
  // tapa el alféizar, así que no queda superficie donde posar nada más. El
  // panel es el retrato de la planta que estás cuidando.
  // ── Panel B · la colección ──
  slot("movil-b", "repisa-alta-1", "repisa-alta", 16, 16.87, 12, 21, 0),
  slot("movil-b", "repisa-alta-2", "repisa-alta", 40, 15.46, 12, 21, 1),
  slot("movil-b", "repisa-alta-3", "repisa-alta", 64, 14.05, 12, 21, 2),
  slot("movil-b", "repisa-alta-4", "repisa-alta", 86, 12.76, 12, 21, 3),
  slot("movil-b", "repisa-media-1", "repisa-media", 12, 35.86, 16, 18, 4),
  slot("movil-b", "repisa-media-2", "repisa-media", 31, 35.52, 16, 18, 5),
  slot("movil-b", "repisa-media-3", "repisa-media", 50, 35.19, 16, 18, 6),
  slot("movil-b", "repisa-media-4", "repisa-media", 69, 34.86, 16, 18, 7),
  slot("movil-b", "repisa-media-5", "repisa-media", 88, 34.53, 16, 18, 8),
  slot("movil-b", "repisa-baja-1", "repisa-baja", 12, 52.02, 15, 18, 9),
  slot("movil-b", "repisa-baja-2", "repisa-baja", 31, 52.75, 15, 18, 10),
  slot("movil-b", "repisa-baja-3", "repisa-baja", 50, 53.48, 15, 18, 11),
  slot("movil-b", "repisa-baja-4", "repisa-baja", 69, 54.21, 15, 18, 12),
  slot("movil-b", "repisa-baja-5", "repisa-baja", 88, 54.95, 15, 18, 13),
  // La caja de madera empieza en el 58 % de este recorte
  slot("movil-b", "piso-1", "piso", 18, 92, 20, 20, 14),
  slot("movil-b", "piso-2", "piso", 40, 88, 18, 20, 15),
];

export const GARDEN_SLOTS: Record<GardenBreakpoint, GardenSlot[]> = { wide: WIDE, narrow: NARROW };

/** Sitio de la planta actual: el banco de propagación bajo la ventana. No es un
 *  slot normal — no entra en el reparto ni recibe plantas completadas.
 *
 *  La línea de apoyo va DEBAJO del tablero del banco (que a esta altura está en
 *  el 67.8 %) a propósito: las etapas de espécimen no llenan su lienzo — el
 *  dibujo del brote termina hacia el 82 % de su alto —, así que anclando el
 *  lienzo un poco más abajo el dibujo aterriza sobre la madera en vez de
 *  flotar. Calculado como 67.8 + 0.18 × alto. */
export const PROPAGATION_SPOT: Record<GardenBreakpoint, Omit<GardenSlot, "surface" | "order">> = {
  wide: { id: "propagacion", scene: "wide", x: 22, baseline: 62.98, height: 26, maxWidth: 26 },
  // En móvil el banco vive en el panel A, medido dentro de ese recorte.
  narrow: { id: "propagacion", scene: "movil-a", x: 30, baseline: 67.7, height: 26, maxWidth: 32 },
};

/** Orden de llenado, distinto del orden visual: reparte entre superficies para
 *  que la escena se vea COMPUESTA con pocas plantas. Determinista: recargar
 *  nunca mueve nada. */
const FILL_ORDER: Record<GardenBreakpoint, string[]> = {
  wide: [
    "repisa-media-2", "piso-2", "repisa-alta-4", "repisa-baja-1", "repisa-media-5",
    "piso-1", "repisa-alta-1", "repisa-baja-3", "repisa-media-3", "piso-3",
    "repisa-alta-6", "repisa-baja-5", "repisa-media-1", "repisa-alta-2", "repisa-baja-2",
    "repisa-media-6", "repisa-alta-5", "repisa-baja-4", "repisa-media-4", "repisa-alta-3",
  ],
  narrow: [
    "repisa-media-3", "piso-1", "repisa-alta-2", "repisa-baja-4", "repisa-media-1",
    "piso-2", "repisa-alta-4", "repisa-baja-2", "repisa-media-5", "repisa-alta-1",
    "repisa-baja-5", "repisa-media-2", "repisa-alta-3", "repisa-baja-1",
    "repisa-media-4", "repisa-baja-3",
  ],
};

/** Cuántas plantas caben en el cuarto. El resto NO se pierde: sigue en el
 *  invernadero, que siempre lista la colección completa. */
export function roomCapacity(breakpoint: GardenBreakpoint): number {
  return FILL_ORDER[breakpoint].length;
}

/** Capacidad de la composición más amplia — cuántas plantas hay que pedir
 *  para poder poblar el cuarto en cualquier tamaño de pantalla. */
export const MAX_ROOM_PLANTS = Math.max(roomCapacity("wide"), roomCapacity("narrow"));

// ── Tamaño de cada planta ────────────────────────────────────────

/** Proporción ancho/alto del lienzo real de la especie. Las especies sin asset
 *  ilustrado caen al lienzo del motor SVG (96×88), igual que en PlantArt. */
export function plantAspect(species: string): number {
  if (!isIllustratedPlantSpecies(species)) return 96 / 88;
  const { w, h } = PLANT_ASSET_DIMS[species].large;
  return w / h;
}

export type PlantBox = { width: number; height: number };

/** Convierte el alto objetivo del slot en una caja con la proporción REAL de
 *  la especie, recortada al ancho máximo del slot. Nunca deforma: si hay que
 *  recortar, se reduce el alto en la misma proporción. */
export function fitPlant(
  species: string,
  slot: { height: number; maxWidth: number; scene: GardenScene },
  scene?: GardenScene
): PlantBox {
  const aspect = plantAspect(species);
  const height = slot.height;
  const width = (height * aspect) / SCENE_ASPECT[scene ?? slot.scene];
  if (width <= slot.maxWidth) return { width: round(width), height: round(height) };
  const scale = slot.maxWidth / width;
  return { width: round(slot.maxWidth), height: round(height * scale) };
}

const round = (n: number) => Number(n.toFixed(4));

// ── Reparto ──────────────────────────────────────────────────────

export type PlacedPlant<T> = { slot: GardenSlot; plant: T };

/** Reparte las plantas (ya ordenadas: la más reciente primero) entre los
 *  sitios del cuarto, siguiendo el orden de llenado. Las que no caben quedan
 *  fuera del cuarto — el invernadero las sigue mostrando todas. */
export function placePlants<T>(plants: T[], breakpoint: GardenBreakpoint): PlacedPlant<T>[] {
  const byId = new Map(GARDEN_SLOTS[breakpoint].map((s) => [s.id, s]));
  const out: PlacedPlant<T>[] = [];
  FILL_ORDER[breakpoint].forEach((slotId, i) => {
    const plant = plants[i];
    const slot = byId.get(slotId);
    if (plant === undefined || !slot) return;
    out.push({ slot, plant });
  });
  return out;
}

/** Índice de llenado de un slot (su posición en FILL_ORDER). Sirve para saber
 *  qué plantas existen en ambas composiciones y cuáles solo en escritorio. */
export function fillIndex(slotId: string, breakpoint: GardenBreakpoint): number {
  return FILL_ORDER[breakpoint].indexOf(slotId);
}
