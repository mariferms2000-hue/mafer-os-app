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
  // Repisa media — casi horizontal. Alto 16: usa el aire que quedaba hasta la
  // repisa alta (baseline 32.68 − 16 = 16.68, justo por debajo del 16.26 de
  // arriba). Con 14 el techo recortaba a todas las especies grandes por igual.
  slot("wide", "repisa-media-1", "repisa-media", 45, 34.02, 16, 9, 6),
  slot("wide", "repisa-media-2", "repisa-media", 55, 33.75, 16, 9, 7),
  slot("wide", "repisa-media-3", "repisa-media", 65, 33.48, 16, 9, 8),
  slot("wide", "repisa-media-4", "repisa-media", 75, 33.22, 16, 9, 9),
  slot("wide", "repisa-media-5", "repisa-media", 85, 32.95, 16, 9, 10),
  slot("wide", "repisa-media-6", "repisa-media", 95, 32.68, 16, 9, 11),
  // Repisa baja — baja hacia la derecha y termina antes (94.5 %). Alto 15 por
  // el mismo motivo; aquí el aire disponible es menor (49.32 − 15 = 34.32).
  slot("wide", "repisa-baja-1", "repisa-baja", 45, 49.32, 15, 9, 12),
  slot("wide", "repisa-baja-2", "repisa-baja", 55, 49.91, 15, 9, 13),
  slot("wide", "repisa-baja-3", "repisa-baja", 65, 50.50, 15, 9, 14),
  slot("wide", "repisa-baja-4", "repisa-baja", 75, 51.09, 15, 9, 15),
  slot("wide", "repisa-baja-5", "repisa-baja", 85, 51.68, 15, 9, 16),
  // Suelo — entre el banco (termina en el 40 %) y la caja de madera (empieza
  // en el 74 %). Es la superficie donde una planta puede ser GRANDE.
  //
  // El hueco libre mide 34 puntos de ancho, y con TRES sitios ninguno podía
  // pasar de 11 sin chocar. Ese ancho era el techo real del suelo: una monstera
  // topaba de lado y se quedaba en un alto de repisa. Con DOS sitios de 15 cabe
  // el porte que corresponde a una planta de piso, y el suelo pasa a sostener
  // dos ejemplares grandes en vez de tres medianos — que es además lo que hace
  // una habitación de verdad.
  slot("wide", "piso-1", "piso", 50, 90, 27, 15, 17),
  slot("wide", "piso-2", "piso", 66, 87, 24, 15, 18),
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
  // La caja de madera empieza en el 58 % de este recorte. Mismo criterio que en
  // escritorio: el suelo necesita ancho para que el porte llegue a verse.
  slot("movil-b", "piso-1", "piso", 20, 92, 25, 23, 14),
  slot("movil-b", "piso-2", "piso", 45, 88, 22, 23, 15),
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
  wide: { id: "propagacion", scene: "wide", x: 22, baseline: 63.88, height: 21, maxWidth: 26 },
  // En móvil el banco vive en el panel A, medido dentro de ese recorte.
  narrow: { id: "propagacion", scene: "movil-a", x: 30, baseline: 69.14, height: 18, maxWidth: 32 },
};

/** Orden de llenado, distinto del orden visual: reparte entre superficies para
 *  que la escena se vea COMPUESTA con pocas plantas. Determinista: recargar
 *  nunca mueve nada. */
const FILL_ORDER: Record<GardenBreakpoint, string[]> = {
  wide: [
    "repisa-media-2", "piso-2", "repisa-alta-4", "repisa-baja-1", "repisa-media-5",
    "piso-1", "repisa-alta-1", "repisa-baja-3", "repisa-media-3", "repisa-alta-3",
    "repisa-alta-6", "repisa-baja-5", "repisa-media-1", "repisa-alta-2", "repisa-baja-2",
    "repisa-media-6", "repisa-alta-5", "repisa-baja-4", "repisa-media-4",
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

// ── Porte de cada especie ────────────────────────────────────────

/** Qué parte del alto de un sitio le corresponde a cada especie.
 *
 *  POR QUÉ EXISTE. Antes el alto salía SOLO del sitio, así que dos plantas en
 *  la misma repisa medían exactamente lo mismo: una suculenta se leía del
 *  mismo porte que una monstera y la escena parecía un muestrario, no una
 *  habitación. El sitio sigue poniendo el techo —lo que cabe ahí sin tocar la
 *  repisa de arriba—; este factor dice qué parte de ese techo ocupa la especie.
 *
 *  No busca exactitud botánica al centímetro, sino relaciones plausibles: el
 *  orden es el del porte de la planta adulta de interior, de la monstera de
 *  suelo a la suculenta de escritorio.
 *
 *  NINGUNO PASA DE 1. Es lo que hace seguro todo el sistema: solo puede
 *  achicar, así que ninguna planta puede desbordar su sitio ni invadir a su
 *  vecina por culpa del porte. */
export const SPECIES_SCALE: Record<string, number> = {
  // GRANDES — presencia dominante
  monstera: 1,
  // El olivo es un ÁRBOL: en escena tiene que competir con la monstera, no
  // quedarse un escalón por debajo. Su tiesto alto ya se lleva el 46 % del
  // conjunto, así que el porte es lo único que puede compensarlo.
  olivo: 1,
  palmera: 0.97,
  bambu: 0.94,
  // MEDIANAS — salto claro respecto a las grandes
  sansevieria: 0.72,
  helecho: 0.68,
  eucalipto: 0.64,
  // PEQUEÑAS — otro salto claro
  potos: 0.46,
  lavanda: 0.42,
  pilea: 0.38,
  cactus: 0.34,
  suculenta: 0.3,
};

/** Alto de la TINTA de cada lámina, en fracción de su lienzo, y cuánto lienzo
 *  vacío queda por debajo. Medido sobre el canal alfa de los WebP reales.
 *
 *  Hace falta porque el lienzo no es el dibujo: la monstera solo pinta el 89.9 %
 *  de su alto y deja un 5.2 % de aire abajo, mientras el olivo pinta el 99.6 %.
 *  Sin esto, dos plantas con el mismo alto de caja se ven de tamaños distintos. */
export const PLANT_INK: Record<string, { fy: number; padBot: number }> = {
  monstera: { fy: 0.899, padBot: 0.052 },
  lavanda: { fy: 0.913, padBot: 0.036 },
  cactus: { fy: 0.943, padBot: 0.03 },
  helecho: { fy: 0.995, padBot: 0.005 },
  suculenta: { fy: 0.991, padBot: 0.005 },
  olivo: { fy: 0.996, padBot: 0.004 },
  bambu: { fy: 0.972, padBot: 0.007 },
  potos: { fy: 0.986, padBot: 0.007 },
  sansevieria: { fy: 0.993, padBot: 0.004 },
  pilea: { fy: 0.986, padBot: 0.007 },
  palmera: { fy: 0.985, padBot: 0.008 },
  eucalipto: { fy: 0.994, padBot: 0 },
};

export function plantInk(species: string): { fy: number; padBot: number } {
  return PLANT_INK[species] ?? { fy: 1, padBot: 0 };
}

/** Presupuesto de follaje de una especie de porte 1, en fracción del alto del
 *  sitio. Es la constante que traduce «porte» a «alto de caja».
 *
 *  NO PUEDE SUBIRSE A OJO. Cada especie necesita una caja de
 *  `alto × REFERENCE_FOLIAGE × porte / foliageFraction`, y esa caja no puede
 *  pasar del alto del sitio. Si el presupuesto es demasiado alto, las especies
 *  de porte mayor topan TODAS con el techo y salen exactamente iguales — que es
 *  justo lo que se veía: monstera, olivo y bambú pegadas al techo de la repisa,
 *  con la misma caja de 101 px.
 *
 *  El tope seguro es el mínimo de `foliageFraction / porte` entre todas las
 *  especies (lo marca el olivo: tiesto alto, mucho hundimiento y porte 1). Un test en
 *  garden-pot.test.ts lo verifica, así que no puede desajustarse en silencio.
 *
 *  Vive aquí y no en garden-pot para no crear un ciclo entre los dos módulos. */
export const REFERENCE_FOLIAGE = 0.54;

/** Suelo de legibilidad, en % del alto de la escena **DE FOLLAJE VISIBLE**.
 *
 *  Antes estaba expresado sobre la caja del conjunto, y eso lo hacía injusto:
 *  la caja incluye maceta y hundimiento, y esa parte cambia por especie. Con
 *  un mínimo de caja, una pilea —que no lleva maceta y aprovecha el 99 % de su
 *  lienzo— sacaba un 36 % más de follaje que una suculenta con el mismo
 *  mínimo. Puesto sobre el follaje, el suelo significa lo mismo para todas.
 *
 *  Un mismo porcentaje tampoco vale lo mismo en cada lienzo: 4.3 % son 31 px en
 *  la escena de escritorio y solo 13 px en el panel móvil. Por eso el móvil
 *  pide un suelo más alto.
 *
 *  Y el suelo de la habitación pide un mínimo mayor que las repisas: ahí una
 *  planta diminuta se ve perdida, no pequeña. */
export const MIN_FOLIAGE: Record<GardenScene, { piso: number; repisa: number }> = {
  wide: { piso: 5.5, repisa: 4.3 },
  "movil-a": { piso: 8, repisa: 6.8 },
  "movil-b": { piso: 8, repisa: 6.8 },
};

export function speciesScale(species: string): number {
  return SPECIES_SCALE[species] ?? 1;
}

export type SlotSize = { height: number; surface: GardenSurface; scene: GardenScene };

/** Alto de FOLLAJE VISIBLE que le toca a una especie en un sitio, en % del alto
 *  de la escena.
 *
 *  Es el objetivo, no el resultado: quien lo consume debe convertirlo a alto de
 *  caja dividiendo por la fracción de follaje de esa especie (ver
 *  foliageFraction en garden-pot). Esa vuelta es justamente lo que faltaba —
 *  antes el porte fijaba el alto de la CAJA, y entre la caja y el follaje se
 *  interponen la maceta y el hundimiento, que se comían la jerarquía. */
export function foliageTarget(species: string, slot: SlotSize): number {
  return round(slot.height * REFERENCE_FOLIAGE * speciesScale(species));
}

/** Alto de caja mínimo en ese sitio, traducido desde el follaje mínimo.
 *
 *  `foliageFrac` es qué parte del conjunto llega a verse en esa especie (1 si
 *  no lleva maceta). `pedido` es el alto que le tocaría por su porte: el suelo
 *  se acota a `pedido / porte`, que es lo que mediría la misma especie con
 *  porte 1, para que el mínimo nunca levante a una pequeña por encima de una
 *  grande. */
export function minHeightIn(
  slot: SlotSize,
  foliageFrac = 1,
  species?: string,
  pedido?: number
): number {
  const m = MIN_FOLIAGE[slot.scene];
  const objetivo = slot.surface === "piso" ? m.piso : m.repisa;
  let suelo = Math.min(objetivo / foliageFrac, slot.height);
  if (species !== undefined && pedido !== undefined) {
    suelo = Math.min(suelo, pedido / speciesScale(species));
  }
  return suelo;
}

/** Alto de caja de una especie SIN maceta: aquí todo el lienzo es follaje, así
 *  que basta descontar el aire del propio dibujo. */
export function plantHeightIn(species: string, slot: SlotSize): number {
  const { fy } = plantInk(species);
  const pedido = foliageTarget(species, slot) / fy;
  return round(Math.min(slot.height, Math.max(pedido, minHeightIn(slot, fy, species, pedido))));
}

export type PlantBox = { width: number; height: number };

/** Convierte el alto objetivo del slot en una caja con la proporción REAL de
 *  la especie, recortada al ancho máximo del slot. Nunca deforma: si hay que
 *  recortar, se reduce el alto en la misma proporción.
 *
 *  `porte: false` salta el sistema de porte y usa el alto del sitio tal cual.
 *  Lo usa la mesa de propagación, cuya línea de apoyo está calculada a partir
 *  de su alto (67.8 + 0.18 × alto): cambiarle el alto ahí dejaría a la planta
 *  actual flotando sobre el banco. */
export function fitPlant(
  species: string,
  slot: { height: number; maxWidth: number; scene: GardenScene; surface?: GardenSurface },
  opciones: { porte?: boolean } = {}
): PlantBox {
  const aspect = plantAspect(species);
  const height =
    opciones.porte === false
      ? slot.height
      : plantHeightIn(species, { ...slot, surface: slot.surface ?? "repisa-media" });
  const width = (height * aspect) / SCENE_ASPECT[slot.scene];
  if (width <= slot.maxWidth) return { width: round(width), height: round(height) };
  const scale = slot.maxWidth / width;
  return { width: round(slot.maxWidth), height: round(height * scale) };
}

const round = (n: number) => Number(n.toFixed(4));

// ── Reparto ──────────────────────────────────────────────────────

export type PlacedPlant<T> = { slot: GardenSlot; plant: T };

/** Reparte las plantas (ya ordenadas: la más reciente primero) entre los
 *  sitios del cuarto. Las que no caben quedan fuera — el invernadero las sigue
 *  mostrando todas.
 *
 *  DOS DECISIONES SEPARADAS, y ese es el punto:
 *
 *  1. QUIÉN ENTRA lo decide la antigüedad, recorriendo FILL_ORDER. Las plantas
 *     recientes entran al cuarto; el resto vive en el invernadero.
 *
 *  2. DÓNDE SE POSA lo decide el PORTE. Sin esto el sistema de escala no llega
 *     a verse: los sitios de este cuarto van de 11 a 27 de alto (2.45×) y el
 *     porte de 0.30 a 1.00 (3.33×), y al asignarse por separado se cancelaban.
 *     Una suculenta caía en el suelo —el mejor sitio— y una palmera en la
 *     repisa alta, así que la pequeña se veía mayor que la grande.
 *
 *     Emparejando la planta mayor con el sitio mayor, la perspectiva del cuarto
 *     deja de pelearse con el porte y lo REFUERZA: las grandes abajo, las
 *     pequeñas en la repisa alta. Es además lo que uno hace de verdad al
 *     colocar plantas en una habitación.
 *
 *  Sigue siendo determinista: mismos datos, misma escena. `speciesOf` es
 *  opcional para no obligar a los tests de reparto a inventar especies. */
export function placePlants<T>(
  plants: T[],
  breakpoint: GardenBreakpoint,
  speciesOf?: (plant: T) => string
): PlacedPlant<T>[] {
  const byId = new Map(GARDEN_SLOTS[breakpoint].map((s) => [s.id, s]));
  const orden = FILL_ORDER[breakpoint];

  // 1 · quién entra: por antigüedad, hasta agotar los sitios
  const dentro = plants.slice(0, orden.length);
  const sitios = orden.slice(0, dentro.length).flatMap((id) => byId.get(id) ?? []);
  if (!speciesOf) return sitios.map((slot, i) => ({ slot, plant: dentro[i] }));

  // 2 · dónde: la mayor al sitio mayor.
  //
  //     Los empates de porte se rompen PRIMERO por variedad y luego por
  //     antigüedad. Sin la variedad, dos monsteras del mismo porte se quedaban
  //     con los dos sitios del suelo y un olivo —igual de grande— acababa en una
  //     repisa, leyéndose como un arbolito. Repartir las especies antes de
  //     repetir una es además lo que hace que el cuarto parezca compuesto.
  const porCapacidad = sitios
    .map((slot, i) => ({ slot, i }))
    .sort((a, b) => b.slot.height - a.slot.height || a.i - b.i);

  const quedan = dentro.map((plant, i) => ({ plant, i }));
  const puestas = new Map<string, number>();
  const out: PlacedPlant<T>[] = [];

  for (const { slot } of porCapacidad) {
    if (!quedan.length) break;
    let mejor = 0;
    for (let k = 1; k < quedan.length; k++) {
      const a = quedan[k],
        b = quedan[mejor];
      const spA = speciesOf(a.plant),
        spB = speciesOf(b.plant);
      const cmp =
        speciesScale(spA) - speciesScale(spB) ||
        (puestas.get(spB) ?? 0) - (puestas.get(spA) ?? 0) ||
        b.i - a.i;
      if (cmp > 0) mejor = k;
    }
    const [elegida] = quedan.splice(mejor, 1);
    const sp = speciesOf(elegida.plant);
    puestas.set(sp, (puestas.get(sp) ?? 0) + 1);
    out.push({ slot, plant: elegida.plant });
  }
  return out;
}

/** Índice de llenado de un slot (su posición en FILL_ORDER). Sirve para saber
 *  qué plantas existen en ambas composiciones y cuáles solo en escritorio. */
export function fillIndex(slotId: string, breakpoint: GardenBreakpoint): number {
  return FILL_ORDER[breakpoint].indexOf(slotId);
}
