/* Recipientes de «Mi jardín» — composición por capas.

   Módulo puro: sin React, sin base de datos, sin acceso al DOM.

   POR QUÉ EXISTE
   Las láminas botánicas son especímenes de herbario: diez de las doce especies
   terminan en una mata de tierra, unas raíces o un lecho de grava, y sobre una
   repisa pintada se leen como calcomanías. Este módulo decide en qué recipiente
   va cada especie y con qué geometría, para que la planta parezca de verdad
   metida dentro.

   NO TOCA LOS ASSETS DE PLANTA. Los 240 WebP botánicos siguen intactos y se
   usan sin recortar en catálogo, invernadero, popup y overlay de enfoque. La
   maceta solo se compone dentro de la escena del jardín.

   CÓMO FUNCIONA
   Una maceta en una sola capa no sirve: puesta delante taparía el tallo, puesta
   detrás dejaría las raíces a la vista. Cada maceta se usa DOS veces, recortada
   del mismo PNG con clip-path:

     capa trasera   0 → splitY     borde posterior y pared interior   (detrás)
     PlantArt                                                          (en medio)
     capa frontal   splitY → 100   borde frontal y cuerpo             (delante)

   `splitY` es el centro de la elipse de la boca, medido sobre las láminas
   aprobadas. Claro y oscuro coincidieron dentro del 2 %, así que un solo valor
   por forma sirve para los dos temas.

   La planta se hunde `sink` por debajo de ese corte: así la capa frontal cubre
   su base sin que haya que recortar la ilustración. Cuanto más ancha o más
   larga es la base de una especie, más hundida va. */

import { plantAspect } from "./garden-layout";

// ── Las tres formas ──────────────────────────────────────────────

export type PotShape = "baja" | "media" | "alta";

export type PotShapeSpec = {
  /** dimensiones intrínsecas del asset (para next/image) */
  dims: { w: number; h: number };
  /** proporción ancho/alto del lienzo de la maceta */
  aspect: number;
  /** % del alto de la maceta donde se separa la capa trasera de la frontal */
  splitY: number;
  /** qué fracción del conjunto planta+maceta ocupa la maceta */
  heightFrac: number;
};

export const POT_SHAPES: Record<PotShape, PotShapeSpec> = {
  // Cuenco bajo y ancho: la boca es la más abierta, así que corta más abajo.
  baja: { dims: { w: 1001, h: 604 }, aspect: 1001 / 604, splitY: 26, heightFrac: 0.34 },
  media: { dims: { w: 743, h: 795 }, aspect: 743 / 795, splitY: 24, heightFrac: 0.44 },
  // Tiesto alto: se ve casi de canto, la elipse es estrecha.
  alta: { dims: { w: 603, h: 1036 }, aspect: 603 / 1036, splitY: 15, heightFrac: 0.54 },
};

/** Ruta del asset de una forma en el tema pedido. */
export function potAssetPath(shape: PotShape, theme: "claro" | "oscuro"): string {
  return `/garden/maceta-${shape}-${theme}.webp`;
}

// ── Asignación por especie ───────────────────────────────────────

export type PotAssignment = { shape: PotShape; sink: number } | null;

/** `sink`: cuánto se hunde la planta bajo la línea de corte, en % del alto de
 *  la maceta. Calibrado especie por especie contra su base real. */
const ASIGNACION: Record<string, PotAssignment> = {
  // ── Cuenco bajo: porte bajo y expandido ──
  // La grava del cactus se conserva dentro del cuenco y se lee como acabado.
  cactus: { shape: "baja", sink: 6 },
  suculenta: { shape: "baja", sink: 8 },
  lavanda: { shape: "baja", sink: 12 },

  // ── Maceta media: follaje que arquea desde un centro ──
  monstera: { shape: "media", sink: 10 },
  // Helecho: base al 90 % del ancho y raíces largas — el caso más exigente.
  helecho: { shape: "media", sink: 20 },
  palmera: { shape: "media", sink: 10 },

  // ── Tiesto alto: porte vertical ──
  // Olivo: tronco con raíces y tierra; se hunde hasta dejar solo el tronco.
  olivo: { shape: "alta", sink: 17 },
  bambu: { shape: "alta", sink: 12 },
  sansevieria: { shape: "alta", sink: 14 },
  // Eucalipto: ramas sueltas sin base — apenas necesita hundirse.
  eucalipto: { shape: "alta", sink: 5 },

  // ── Excluidas: su ilustración ya trae recipiente ──
  potos: null,
  pilea: null,
};

/** Qué recipiente le toca a una especie. `null` si ya trae el suyo o si es una
 *  especie desconocida (nunca se inventa una maceta). */
export function potFor(species: string): PotAssignment {
  return ASIGNACION[species] ?? null;
}

export function hasPot(species: string): boolean {
  return potFor(species) !== null;
}

/** Las especies que se componen con recipiente, en orden estable. */
export const SPECIES_WITH_POT = Object.keys(ASIGNACION).filter((s) => ASIGNACION[s] !== null);

// ── Composición ──────────────────────────────────────────────────

/** Caja de un elemento dentro del conjunto, en % de la caja del conjunto.
 *  `bottom` se mide desde la base del conjunto. */
export type Box = { width: number; height: number; bottom: number };

export type PottedLayout = {
  /** misma caja para las dos capas: solo cambia el clip-path */
  pot: Box;
  plant: Box;
  /** % del alto de la MACETA donde se separan las capas */
  splitY: number;
  /** ancho del conjunto en % del ancho de la escena */
  assemblyWidth: number;
  /** alto del conjunto en % del alto de la escena */
  assemblyHeight: number;
};

const round = (n: number) => Number(n.toFixed(4));

/** Coloca planta y maceta dentro de la caja de un sitio.
 *
 *  El conjunto nunca excede el alto del sitio ni su ancho máximo: si la planta
 *  o la maceta se pasan de ancho, se reduce TODO el conjunto en la misma
 *  proporción, de modo que la planta siga bien asentada en su maceta. */
export function fitPotted(
  species: string,
  slot: { height: number; maxWidth: number },
  sceneAspect: number
): PottedLayout | null {
  const asign = potFor(species);
  if (!asign) return null;
  const forma = POT_SHAPES[asign.shape];

  // Alturas dentro del conjunto, en % del alto de la escena
  let alto = slot.height;
  let potH = alto * forma.heightFrac;
  const potTop = () => alto - potH;
  const baseP = () => potTop() + (potH * (forma.splitY + asign.sink)) / 100;

  const anchoDe = (h: number, aspect: number) => (h * aspect) / sceneAspect;

  let plantH = baseP();
  let potW = anchoDe(potH, forma.aspect);
  let plantW = anchoDe(plantH, plantAspect(species));

  // Si el conjunto se pasa de ancho, se encoge entero
  const anchoConjunto = Math.max(potW, plantW);
  if (anchoConjunto > slot.maxWidth) {
    const k = slot.maxWidth / anchoConjunto;
    alto *= k;
    potH *= k;
    plantH = baseP();
    potW *= k;
    plantW *= k;
  }

  const assemblyW = Math.max(potW, plantW);
  // Todo en % de la caja del conjunto
  return {
    pot: {
      width: round((potW / assemblyW) * 100),
      height: round((potH / alto) * 100),
      bottom: 0,
    },
    plant: {
      width: round((plantW / assemblyW) * 100),
      height: round((plantH / alto) * 100),
      bottom: round(((alto - baseP()) / alto) * 100),
    },
    splitY: forma.splitY,
    assemblyWidth: round(assemblyW),
    assemblyHeight: round(alto),
  };
}
