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

export type GardenSurface = "alfeizar" | "repisa-alta" | "repisa-media" | "repisa-baja" | "piso";

/** Proporción del lienzo ilustrado (1586 × 991). Debe coincidir con el
 *  aspect-ratio del contenedor o los sitios dejarían de caer sobre las
 *  superficies pintadas. Ambas composiciones comparten fondo. */
export const SCENE_ASPECT: Record<GardenBreakpoint, number> = {
  wide: 1586 / 991,
  narrow: 1586 / 991,
};

export type GardenSlot = {
  id: string;
  surface: GardenSurface;
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
  id: string,
  surface: GardenSurface,
  x: number,
  baseline: number,
  height: number,
  maxWidth: number,
  order: number
): GardenSlot => ({ id, surface, x, baseline, height, maxWidth, order });

/** Escritorio: 15 sitios en las tres repisas + 3 en el suelo.
 *  Líneas de apoyo medidas sobre la ilustración, siguiendo su inclinación. */
const WIDE: GardenSlot[] = [
  // Repisa alta — sube 2.1 % hacia la derecha
  slot("repisa-alta-1", "repisa-alta", 63, 15.72, 13, 7.8, 0),
  slot("repisa-alta-2", "repisa-alta", 71, 15.19, 13, 7.8, 1),
  slot("repisa-alta-3", "repisa-alta", 79, 14.65, 13, 7.8, 2),
  slot("repisa-alta-4", "repisa-alta", 87, 14.11, 13, 7.8, 3),
  slot("repisa-alta-5", "repisa-alta", 95, 13.58, 13, 7.8, 4),
  // Repisa media — casi horizontal
  slot("repisa-media-1", "repisa-media", 63, 32.29, 13, 7.8, 5),
  slot("repisa-media-2", "repisa-media", 71, 32.12, 13, 7.8, 6),
  slot("repisa-media-3", "repisa-media", 79, 31.96, 13, 7.8, 7),
  slot("repisa-media-4", "repisa-media", 87, 31.79, 13, 7.8, 8),
  slot("repisa-media-5", "repisa-media", 95, 31.62, 13, 7.8, 9),
  // Repisa baja — horizontal
  slot("repisa-baja-1", "repisa-baja", 63, 49.07, 14, 7.8, 10),
  slot("repisa-baja-2", "repisa-baja", 71, 49.16, 14, 7.8, 11),
  slot("repisa-baja-3", "repisa-baja", 79, 49.25, 14, 7.8, 12),
  slot("repisa-baja-4", "repisa-baja", 87, 49.34, 14, 7.8, 13),
  slot("repisa-baja-5", "repisa-baja", 95, 49.43, 14, 7.8, 14),
  // Suelo — más cerca del frente = más grandes. A la izquierda de la regadera
  // y la caja de madera, que viven a partir del 78 % del ancho.
  slot("piso-1", "piso", 37, 87, 23, 16, 15),
  slot("piso-2", "piso", 54, 85, 22, 16, 16),
  slot("piso-3", "piso", 70, 80, 19, 14, 17),
];

/** Móvil: la misma ilustración a 390 px de ancho deja la escena en ~244 px de
 *  alto, y las repisas están a solo un 17 % de altura entre sí — ahí una planta
 *  mediría 38 px. Así que en móvil solo se usan las superficies con altura
 *  suficiente: la repisa baja y el suelo. El resto de la colección sigue
 *  entero en el invernadero.
 *  PROVISIONAL: una ilustración vertical propia permitiría más sitios. */
const NARROW: GardenSlot[] = [
  slot("repisa-baja-2", "repisa-baja", 70, 49.15, 14, 16, 0),
  slot("repisa-baja-4", "repisa-baja", 88, 49.35, 14, 16, 1),
  slot("piso-2", "piso", 50, 86, 24, 22, 2),
  slot("piso-3", "piso", 72, 79, 20, 18, 3),
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
  wide: { id: "propagacion", x: 17, baseline: 71.5, height: 24, maxWidth: 24 },
  narrow: { id: "propagacion", x: 17, baseline: 71.5, height: 24, maxWidth: 24 },
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
  narrow: ["repisa-baja-2", "piso-2", "repisa-baja-4", "piso-3"],
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
  slot: { height: number; maxWidth: number },
  breakpoint: GardenBreakpoint
): PlantBox {
  const aspect = plantAspect(species);
  const height = slot.height;
  const width = (height * aspect) / SCENE_ASPECT[breakpoint];
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
