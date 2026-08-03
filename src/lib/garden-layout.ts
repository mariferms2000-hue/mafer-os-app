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
  "movil-a": 800 / 820,
  "movil-b": 806 / 930,
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

/** Escritorio: 15 sitios en las tres repisas + 3 en el suelo.
 *  Líneas de apoyo medidas sobre la ilustración, siguiendo su inclinación. */
const WIDE: GardenSlot[] = [
  // Repisa alta — sube 2.1 % hacia la derecha
  slot("wide", "repisa-alta-1", "repisa-alta", 63, 16.07, 13, 7.8, 0),
  slot("wide", "repisa-alta-2", "repisa-alta", 71, 15.44, 13, 7.8, 1),
  slot("wide", "repisa-alta-3", "repisa-alta", 79, 14.81, 13, 7.8, 2),
  slot("wide", "repisa-alta-4", "repisa-alta", 87, 14.17, 13, 7.8, 3),
  slot("wide", "repisa-alta-5", "repisa-alta", 95, 13.54, 13, 7.8, 4),
  // Repisa media — casi horizontal
  slot("wide", "repisa-media-1", "repisa-media", 63, 32.41, 13, 7.8, 5),
  slot("wide", "repisa-media-2", "repisa-media", 71, 32.25, 13, 7.8, 6),
  slot("wide", "repisa-media-3", "repisa-media", 79, 32.09, 13, 7.8, 7),
  slot("wide", "repisa-media-4", "repisa-media", 87, 31.93, 13, 7.8, 8),
  slot("wide", "repisa-media-5", "repisa-media", 95, 31.77, 13, 7.8, 9),
  // Repisa baja — horizontal
  slot("wide", "repisa-baja-1", "repisa-baja", 63, 49.11, 14, 7.8, 10),
  slot("wide", "repisa-baja-2", "repisa-baja", 71, 49.20, 14, 7.8, 11),
  slot("wide", "repisa-baja-3", "repisa-baja", 79, 49.29, 14, 7.8, 12),
  slot("wide", "repisa-baja-4", "repisa-baja", 87, 49.38, 14, 7.8, 13),
  slot("wide", "repisa-baja-5", "repisa-baja", 95, 49.47, 14, 7.8, 14),
  // Suelo — más cerca del frente = más grandes. A la izquierda de la regadera
  // y la caja de madera, que viven a partir del 78 % del ancho.
  slot("wide", "piso-1", "piso", 37, 87, 23, 16, 15),
  slot("wide", "piso-2", "piso", 54, 85, 22, 16, 16),
  slot("wide", "piso-3", "piso", 70, 80, 19, 14, 17),
];

/** Móvil: la misma habitación recorrida en dos vistas apiladas.
 *
 *  Un recorte 4:5 de la ilustración horizontal mide exactamente media imagen:
 *  o conserva la ventana y pierde las repisas, o al revés. Por eso móvil no es
 *  un recorte sino DOS lienzos del mismo cuarto — arriba la ventana con su
 *  alféizar y su banco, abajo las tres repisas y el suelo.
 *
 *  Coordenadas medidas dentro de cada recorte, promediando claro y oscuro.
 *  A 390 px de ancho las plantas quedan entre 55 y 90 px: legibles y tocables,
 *  frente a los 38 px que daba la composición de una sola escena. */
const NARROW: GardenSlot[] = [
  // ── Panel A · ventana, alféizar y banco ──
  // El alféizar sube hacia la derecha con la perspectiva. Sus dos sitios van a
  // la derecha del panel para dejarle a la planta actual el hueco de la
  // izquierda: el banco está DELANTE del alféizar, así que una planta alta
  // sobre él invadiría el alféizar si compartieran columna.
  slot("movil-a", "alfeizar-1", "alfeizar", 40, 63.8, 20, 11, 0),
  slot("movil-a", "alfeizar-2", "alfeizar", 52, 62.9, 20, 11, 1),
  // ── Panel B · tres repisas y suelo ──
  slot("movil-b", "repisa-alta-1", "repisa-alta", 35, 15.46, 13, 22, 2),
  slot("movil-b", "repisa-alta-2", "repisa-alta", 58, 14.57, 13, 22, 3),
  slot("movil-b", "repisa-alta-3", "repisa-alta", 81, 13.67, 13, 22, 4),
  slot("movil-b", "repisa-media-1", "repisa-media", 35, 33.43, 16, 22, 5),
  slot("movil-b", "repisa-media-2", "repisa-media", 58, 33.13, 16, 22, 6),
  slot("movil-b", "repisa-media-3", "repisa-media", 81, 32.83, 16, 22, 7),
  slot("movil-b", "repisa-baja-1", "repisa-baja", 35, 51.26, 17, 22, 8),
  slot("movil-b", "repisa-baja-2", "repisa-baja", 58, 51.43, 17, 22, 9),
  slot("movil-b", "repisa-baja-3", "repisa-baja", 81, 51.60, 17, 22, 10),
  // El suelo se queda a la izquierda de la regadera y la caja (68 % en adelante)
  slot("movil-b", "piso-1", "piso", 30, 88, 22, 26, 11),
  slot("movil-b", "piso-2", "piso", 54, 82, 19, 22, 12),
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
  wide: { id: "propagacion", scene: "wide", x: 17, baseline: 73.3, height: 24, maxWidth: 24 },
  // En móvil el banco vive en el panel A, medido dentro de ese recorte.
  narrow: { id: "propagacion", scene: "movil-a", x: 18, baseline: 83.2, height: 26, maxWidth: 26 },
};

/** Orden de llenado, distinto del orden visual: reparte entre superficies para
 *  que la escena se vea COMPUESTA con pocas plantas. Determinista: recargar
 *  nunca mueve nada. */
const FILL_ORDER: Record<GardenBreakpoint, string[]> = {
  wide: [
    "repisa-media-2", "piso-2", "repisa-alta-3", "repisa-baja-4", "piso-1",
    "repisa-media-4", "repisa-baja-1", "repisa-alta-1", "piso-3", "repisa-media-1",
    "repisa-baja-3", "repisa-alta-5", "repisa-media-5", "repisa-baja-5", "repisa-alta-2",
    "repisa-media-3", "repisa-baja-2", "repisa-alta-4",
  ],
  narrow: [
    "alfeizar-1", "repisa-media-2", "piso-1", "repisa-alta-2", "repisa-baja-2",
    "alfeizar-2", "piso-2", "repisa-media-1", "repisa-alta-1", "repisa-baja-3",
    "repisa-media-3", "repisa-alta-3", "repisa-baja-1",
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
