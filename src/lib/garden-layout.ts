/* Disposición de la escena de «Mi jardín» — el cuarto botánico (PR 1).

   Módulo puro: sin React, sin base de datos, sin acceso al DOM. Define DÓNDE
   puede posarse una planta dentro de la escena y CUÁNTO puede medir ahí, y
   reparte las plantas completadas entre esos sitios de forma determinista.

   Principios:
   - El cuarto es una VITRINA, no un contenedor. Muestra una selección; la
     colección completa vive en el invernadero (la cuadrícula de siempre).
     Así la escena se ve igual de bien con 6 plantas que con 600.
   - Solo las plantas COMPLETADAS se posan en repisas: son las únicas cuyo
     asset incluye maceta. Las etapas intermedias (semilla, brote, hojas,
     planta joven) son láminas de espécimen —con raíces al aire— y por eso la
     planta actual tiene su propio sitio: la mesa de propagación.
   - Nadie se deforma: el alto objetivo del slot se convierte en ancho usando
     la proporción REAL del lienzo de cada especie, y se recorta al ancho
     máximo del slot para que una monstera no invada a su vecina.

   Coordenadas: porcentajes de la escena. `x` es el centro horizontal y
   `baseline` la línea de apoyo medida desde arriba, de modo que la planta se
   ancla con translate(-50%, -100%) y queda POSADA en la superficie. */

import { PLANT_ASSET_DIMS, isIllustratedPlantSpecies } from "./plant-assets";

// ── Escena ───────────────────────────────────────────────────────

/** Dos composiciones. Los ids de slot son estables entre ambas: una planta
 *  colocada en escritorio conserva su sitio, y en móvil simplemente se muestran
 *  menos superficies (el resto sigue accesible en el invernadero). */
export type GardenBreakpoint = "wide" | "narrow";

export type GardenSurface = "alfeizar" | "repisa-alta" | "repisa-media" | "repisa-baja" | "piso";

/** Proporción del lienzo de cada composición (ancho / alto). Debe coincidir
 *  con el viewBox del arte y con el aspect-ratio del contenedor, o los slots
 *  dejarían de alinearse con las repisas pintadas. */
export const SCENE_ASPECT: Record<GardenBreakpoint, number> = {
  wide: 1200 / 750,
  narrow: 640 / 800,
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

const pct = (px: number, total: number) => Number(((px / total) * 100).toFixed(4));

/** Composición amplia (escritorio): ventana y mesa de propagación a la
 *  izquierda, tres repisas a la derecha, suelo abajo. 18 sitios. */
const WIDE: GardenSlot[] = (() => {
  const W = 1200;
  const H = 750;
  const slots: GardenSlot[] = [];
  let order = 0;

  const row = (
    surface: GardenSurface,
    baselinePx: number,
    heightPx: number,
    maxWidthPx: number,
    xs: number[]
  ) => {
    xs.forEach((xPx, i) => {
      slots.push({
        id: `${surface}-${i + 1}`,
        surface,
        x: pct(xPx, W),
        baseline: pct(baselinePx, H),
        height: pct(heightPx, H),
        maxWidth: pct(maxWidthPx, W),
        order: order++,
      });
    });
  };

  // Repisas: de arriba abajo. La más alta no tiene techo encima, así que
  // admite plantas un poco mayores. El alféizar va a la izquierda, bajo la
  // ventana, y termina POR ENCIMA de la mesa de propagación: nada se cruza.
  row("repisa-alta", 170, 130, 130, [670, 810, 950, 1090]);
  row("repisa-media", 310, 115, 130, [670, 810, 950, 1090]);
  row("alfeizar", 348, 95, 110, [120, 245, 370]);
  row("repisa-baja", 450, 115, 130, [670, 810, 950, 1090]);
  row("piso", 700, 200, 200, [500, 760, 1020]);

  return slots;
})();

/** Composición estrecha (móvil): la misma habitación, recortada y vertical.
 *  8 sitios — legibles a la primera, sin apretujar. */
const NARROW: GardenSlot[] = (() => {
  const W = 640;
  const H = 800;
  const slots: GardenSlot[] = [];
  let order = 0;

  const row = (
    surface: GardenSurface,
    baselinePx: number,
    heightPx: number,
    maxWidthPx: number,
    xs: number[]
  ) => {
    xs.forEach((xPx, i) => {
      slots.push({
        id: `${surface}-${i + 1}`,
        surface,
        x: pct(xPx, W),
        baseline: pct(baselinePx, H),
        height: pct(heightPx, H),
        maxWidth: pct(maxWidthPx, W),
        order: order++,
      });
    });
  };

  row("repisa-alta", 240, 105, 110, [430, 550]);
  row("alfeizar", 306, 85, 120, [110, 250]);
  row("repisa-baja", 420, 130, 110, [430, 550]);
  row("piso", 730, 200, 150, [395, 550]);

  return slots;
})();

export const GARDEN_SLOTS: Record<GardenBreakpoint, GardenSlot[]> = { wide: WIDE, narrow: NARROW };

/** Sitio de la planta actual: la mesa de propagación. No es un slot normal —
 *  no entra en el reparto ni puede recibir una planta completada. */
export const PROPAGATION_SPOT: Record<GardenBreakpoint, Omit<GardenSlot, "surface" | "order">> = {
  wide: { id: "propagacion", x: pct(225, 1200), baseline: pct(585, 750), height: pct(225, 750), maxWidth: pct(280, 1200) },
  narrow: { id: "propagacion", x: pct(168, 640), baseline: pct(520, 800), height: pct(190, 800), maxWidth: pct(250, 640) },
};

/** Orden de llenado, distinto del orden visual: reparte entre superficies para
 *  que la escena se vea COMPUESTA con pocas plantas (no un montón arriba y el
 *  cuarto vacío abajo). Es la disposición por defecto mientras no exista
 *  «Reacomodar»; determinista, así que recargar nunca mueve nada. */
const FILL_ORDER: Record<GardenBreakpoint, string[]> = {
  wide: [
    "alfeizar-2", "piso-2", "repisa-media-2", "repisa-alta-3", "repisa-baja-1",
    "alfeizar-1", "piso-3", "repisa-media-4", "repisa-alta-1", "repisa-baja-3",
    "alfeizar-3", "piso-1", "repisa-media-1", "repisa-alta-4", "repisa-baja-4",
    "repisa-media-3", "repisa-alta-2", "repisa-baja-2",
  ],
  narrow: [
    "alfeizar-1", "piso-1", "repisa-alta-2", "repisa-baja-1",
    "alfeizar-2", "piso-2", "repisa-alta-1", "repisa-baja-2",
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
