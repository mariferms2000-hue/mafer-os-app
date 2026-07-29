/* Motor determinista de identidad y apariencia de plantas — v2 (rediseño).
   Mismo contrato que plant-render.ts (v1), que queda INTACTO como referencia
   congelada: misma entrada → misma especificación, byte a byte, sin
   Math.random, sin dependencias.

   v2 amplía el sistema de 5 a 12 especies y afina proporciones/rasgos para
   mayor calidad visual y siluetas más reconocibles entre sí. No sustituye a
   v1: es un motor paralelo. La compatibilidad con plantas antiguas (nacidas
   bajo v1) se resuelve en el componente de presentación (plant-art.tsx), que
   alimenta este mismo motor con la especie/seed/etapa YA GUARDADAS de esa
   planta — v1 y v2 comparten los nombres de las 5 especies originales, así
   que no hace falta ninguna tabla de traducción. */

import type { StageKey } from "./focus-logic";

// ── Especies ─────────────────────────────────────────────────────

export const PLANT_SPECIES_V2 = [
  "helecho",
  "monstera",
  "suculenta",
  "lavanda",
  "olivo",
  "bambu",
  "cactus",
  "potos",
  "sansevieria",
  "pilea",
  "palmera",
  "eucalipto",
] as const;

export type PlantSpeciesV2 = (typeof PLANT_SPECIES_V2)[number];

export const CURRENT_RENDERER_VERSION_V2 = 2;

// ── Identidad al nacer (nuevas plantas) ──────────────────────────

/** FNV-1a de 32 bits — idéntico algoritmo que v1, sal distinta para no
 *  correlacionar sorteos entre motores (aunque no importa: cada planta usa
 *  solo un motor, el vigente al nacer). */
export function hashStringV2(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export type PlantIdentityV2 = {
  species: PlantSpeciesV2;
  visualSeed: number;
  rendererVersion: number;
};

/** Identidad de una planta nueva (nace bajo v2): especie sorteada entre las
 *  12 disponibles. Determinista y persistida una sola vez, igual que v1. */
export function newPlantIdentityV2(plantId: string): PlantIdentityV2 {
  return {
    species: PLANT_SPECIES_V2[hashStringV2(`${plantId}::especie::v2`) % PLANT_SPECIES_V2.length],
    visualSeed: hashStringV2(plantId),
    rendererVersion: CURRENT_RENDERER_VERSION_V2,
  };
}

// ── PRNG con semilla (mulberry32, idéntico a v1) ──────────────────

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

// ── Especificación de render ─────────────────────────────────────

export type LeafShapeV2 =
  | "fronda-pinnada" // helecho
  | "hoja-acorazonada" // monstera joven / potos
  | "hoja-fenestrada" // monstera adulta
  | "hoja-carnosa" // suculenta
  | "hoja-lineal" // lavanda
  | "hoja-lanceolada" // olivo
  | "cana-segmentada" // bambú
  | "costilla" // cactus columnar
  | "hoja-espada" // sansevieria
  | "hoja-redonda" // pilea
  | "fronda-palmeada" // palmera
  | "hoja-ovalada"; // eucalipto

export type BranchArrangementV2 = "alterna" | "opuesta" | "roseta" | "vertical" | "corona";

export type PlantRenderSpecV2 = {
  rendererVersion: 2;
  species: PlantSpeciesV2;
  stage: StageKey;
  orientation: { leanDeg: number };
  height: number;
  stem: { count: number; thickness: number; curvature: number; woody: boolean };
  branches: { count: number; angleDeg: number; lengthRatio: number; arrangement: BranchArrangementV2 };
  leaves: { count: number; sizeRatio: number; density: number; shape: LeafShapeV2 };
  proportions: { crownWidthRatio: number; stemHeightRatio: number };
  details: string[];
};

export const SPECIES_TRAITS_V2: Record<
  PlantSpeciesV2,
  {
    maxLeanDeg: number;
    height: [number, number];
    stemCount: [number, number];
    thickness: [number, number];
    curvature: [number, number];
    branchCount: [number, number];
    branchAngleDeg: [number, number];
    branchLengthRatio: [number, number];
    arrangement: BranchArrangementV2;
    leafCountAdult: [number, number];
    leafSizeRatio: [number, number];
    density: [number, number];
    crownWidthRatio: [number, number];
    stemHeightRatio: [number, number];
  }
> = {
  helecho: {
    maxLeanDeg: 6,
    height: [0.52, 0.72],
    stemCount: [6, 10],
    thickness: [0.07, 0.12],
    curvature: [0.6, 0.9],
    branchCount: [0, 0],
    branchAngleDeg: [0, 0],
    branchLengthRatio: [0, 0],
    arrangement: "roseta",
    leafCountAdult: [26, 42],
    leafSizeRatio: [0.05, 0.09],
    density: [0.75, 1.0],
    crownWidthRatio: [0.85, 1.15],
    stemHeightRatio: [0.1, 0.18],
  },
  monstera: {
    maxLeanDeg: 8,
    height: [0.72, 0.96],
    stemCount: [1, 2],
    thickness: [0.13, 0.2],
    curvature: [0.22, 0.48],
    branchCount: [3, 6],
    branchAngleDeg: [28, 54],
    branchLengthRatio: [0.36, 0.56],
    arrangement: "alterna",
    leafCountAdult: [5, 9],
    leafSizeRatio: [0.23, 0.33],
    density: [0.35, 0.55],
    crownWidthRatio: [0.72, 1.02],
    stemHeightRatio: [0.25, 0.4],
  },
  suculenta: {
    maxLeanDeg: 3,
    height: [0.25, 0.4],
    stemCount: [1, 1],
    thickness: [0.2, 0.3],
    curvature: [0.0, 0.12],
    branchCount: [0, 0],
    branchAngleDeg: [0, 0],
    branchLengthRatio: [0, 0],
    arrangement: "roseta",
    leafCountAdult: [13, 22],
    leafSizeRatio: [0.1, 0.16],
    density: [0.85, 1.0],
    crownWidthRatio: [1.0, 1.32],
    stemHeightRatio: [0.0, 0.06],
  },
  lavanda: {
    maxLeanDeg: 7,
    height: [0.62, 0.86],
    stemCount: [5, 9],
    thickness: [0.035, 0.07],
    curvature: [0.15, 0.32],
    branchCount: [2, 4],
    branchAngleDeg: [14, 28],
    branchLengthRatio: [0.25, 0.4],
    arrangement: "opuesta",
    leafCountAdult: [18, 30],
    leafSizeRatio: [0.04, 0.07],
    density: [0.5, 0.75],
    crownWidthRatio: [0.45, 0.68],
    stemHeightRatio: [0.15, 0.28],
  },
  olivo: {
    maxLeanDeg: 10,
    height: [0.78, 1.0],
    stemCount: [1, 1],
    thickness: [0.17, 0.27],
    curvature: [0.3, 0.58],
    branchCount: [4, 7],
    branchAngleDeg: [34, 58],
    branchLengthRatio: [0.3, 0.5],
    arrangement: "alterna",
    leafCountAdult: [22, 36],
    leafSizeRatio: [0.04, 0.065],
    density: [0.45, 0.68],
    crownWidthRatio: [0.6, 0.9],
    stemHeightRatio: [0.35, 0.5],
  },
  bambu: {
    // cañas rectas y segmentadas: casi sin inclinación, muy verticales.
    maxLeanDeg: 4,
    height: [0.85, 1.0],
    stemCount: [3, 6],
    thickness: [0.05, 0.09],
    curvature: [0.02, 0.1],
    branchCount: [0, 0],
    branchAngleDeg: [0, 0],
    branchLengthRatio: [0, 0],
    arrangement: "vertical",
    leafCountAdult: [8, 14], // hojas solo cerca de la punta de cada caña
    leafSizeRatio: [0.06, 0.1],
    density: [0.4, 0.6],
    crownWidthRatio: [0.35, 0.55],
    stemHeightRatio: [0.75, 0.92],
  },
  cactus: {
    // columna ribeteada, casi sin ramas, sin hojas verdaderas.
    maxLeanDeg: 3,
    height: [0.5, 0.75],
    stemCount: [1, 1],
    thickness: [0.22, 0.32],
    curvature: [0.0, 0.05],
    branchCount: [0, 2], // brazos ocasionales
    branchAngleDeg: [55, 75],
    branchLengthRatio: [0.25, 0.4],
    arrangement: "vertical",
    leafCountAdult: [8, 12], // se reinterpreta como número de costillas
    leafSizeRatio: [0.0, 0.0],
    density: [0.6, 0.8],
    crownWidthRatio: [0.4, 0.55],
    stemHeightRatio: [0.85, 1.0],
  },
  potos: {
    // trailing: raíz en la tierra como las demás, pero con curvatura muy
    // marcada para que el tallo caiga en arco — silueta «colgante».
    maxLeanDeg: 14,
    height: [0.45, 0.65],
    stemCount: [2, 3],
    thickness: [0.05, 0.08],
    curvature: [0.55, 0.85],
    branchCount: [0, 0],
    branchAngleDeg: [0, 0],
    branchLengthRatio: [0, 0],
    arrangement: "opuesta",
    leafCountAdult: [10, 16],
    leafSizeRatio: [0.09, 0.14],
    density: [0.55, 0.8],
    crownWidthRatio: [0.9, 1.2],
    stemHeightRatio: [0.1, 0.2],
  },
  sansevieria: {
    // hojas rígidas en espada, derechas desde la base — roseta pero recta,
    // no redondeada como la suculenta.
    maxLeanDeg: 3,
    height: [0.55, 0.8],
    stemCount: [1, 1],
    thickness: [0.1, 0.16],
    curvature: [0.0, 0.08],
    branchCount: [0, 0],
    branchAngleDeg: [0, 0],
    branchLengthRatio: [0, 0],
    arrangement: "roseta",
    leafCountAdult: [4, 7],
    leafSizeRatio: [0.16, 0.24],
    density: [0.55, 0.75],
    crownWidthRatio: [0.4, 0.6],
    stemHeightRatio: [0.0, 0.05],
  },
  pilea: {
    // hojas redondas en monedas, peciolos cortos y finos.
    maxLeanDeg: 6,
    height: [0.35, 0.5],
    stemCount: [1, 1],
    thickness: [0.08, 0.12],
    curvature: [0.1, 0.25],
    branchCount: [5, 9],
    branchAngleDeg: [35, 60],
    branchLengthRatio: [0.3, 0.5],
    arrangement: "alterna",
    leafCountAdult: [6, 11],
    leafSizeRatio: [0.11, 0.16],
    density: [0.4, 0.6],
    crownWidthRatio: [0.85, 1.15],
    stemHeightRatio: [0.3, 0.45],
  },
  palmera: {
    // tronco único y alto, corona de frondas radiales arriba: silueta de
    // «explosión» en la punta, muy distinta de la copa redondeada del olivo.
    maxLeanDeg: 9,
    height: [0.9, 1.0],
    stemCount: [1, 1],
    thickness: [0.12, 0.18],
    curvature: [0.2, 0.4],
    branchCount: [6, 9], // frondas
    branchAngleDeg: [50, 80],
    branchLengthRatio: [0.4, 0.6],
    arrangement: "corona",
    leafCountAdult: [6, 9],
    leafSizeRatio: [0.3, 0.42],
    density: [0.5, 0.7],
    crownWidthRatio: [0.9, 1.2],
    stemHeightRatio: [0.7, 0.88],
  },
  eucalipto: {
    // árbol más abierto y aireado que el olivo, hojas ovaladas pequeñas.
    maxLeanDeg: 9,
    height: [0.85, 1.0],
    stemCount: [1, 1],
    thickness: [0.14, 0.2],
    curvature: [0.15, 0.35],
    branchCount: [5, 8],
    branchAngleDeg: [30, 50],
    branchLengthRatio: [0.35, 0.55],
    arrangement: "alterna",
    leafCountAdult: [26, 40],
    leafSizeRatio: [0.035, 0.055],
    density: [0.3, 0.5],
    crownWidthRatio: [0.65, 0.95],
    stemHeightRatio: [0.4, 0.55],
  },
};

/** Factor de crecimiento por etapa — idéntico a v1: la identidad no cambia
 *  entre etapas, solo su escala. */
export const STAGE_GROWTH_V2: Record<StageKey, number> = {
  semilla: 0.08,
  brote: 0.3,
  hojas: 0.55,
  "planta-joven": 0.8,
  "planta-completa": 1,
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function detailsForV2(species: PlantSpeciesV2, stage: StageKey, extra: boolean): string[] {
  const late = stage === "planta-joven" || stage === "planta-completa";
  const d: string[] = [];
  if (species === "helecho") {
    if (stage === "brote" || stage === "hojas") d.push("fronda-enrollada");
    if (late) d.push("frondas-arqueadas");
    if (stage === "planta-completa" && extra) d.push("fronda-nueva-central");
  }
  if (species === "monstera") {
    if (late) d.push("fenestraciones");
    if (stage === "planta-completa" && extra) d.push("raiz-aerea");
  }
  if (species === "suculenta") {
    d.push("roseta-compacta");
    if (stage === "planta-completa" && extra) d.push("hijuelo-en-base");
  }
  if (species === "lavanda") {
    if (late) d.push("espigas-florales");
    if (stage === "planta-completa" && extra) d.push("base-lenosa");
  }
  if (species === "olivo") {
    if (late) d.push("copa-redondeada");
    if (stage === "planta-completa" && extra) d.push("tronco-nudoso");
  }
  if (species === "bambu") {
    if (late) d.push("nudos-marcados");
    if (stage === "planta-completa" && extra) d.push("caña-nueva");
  }
  if (species === "cactus") {
    if (late) d.push("espinas");
    if (stage === "planta-completa" && extra) d.push("flor-cactus");
  }
  if (species === "potos") {
    if (late) d.push("hojas-colgantes");
    if (stage === "planta-completa" && extra) d.push("raiz-aerea-potos");
  }
  if (species === "sansevieria") {
    if (late) d.push("borde-hoja");
    if (stage === "planta-completa" && extra) d.push("hoja-nueva-central");
  }
  if (species === "pilea") {
    if (late) d.push("hojas-monedas");
    if (stage === "planta-completa" && extra) d.push("hijuelo-pilea");
  }
  if (species === "palmera") {
    if (late) d.push("corona-radial");
    if (stage === "planta-completa" && extra) d.push("fronda-seca");
  }
  if (species === "eucalipto") {
    if (late) d.push("follaje-aireado");
    if (stage === "planta-completa" && extra) d.push("corteza-desprendida");
  }
  return d;
}

function leafShapeForV2(species: PlantSpeciesV2, stage: StageKey): LeafShapeV2 {
  switch (species) {
    case "helecho":
      return "fronda-pinnada";
    case "monstera":
      return stage === "planta-joven" || stage === "planta-completa" ? "hoja-fenestrada" : "hoja-acorazonada";
    case "suculenta":
      return "hoja-carnosa";
    case "lavanda":
      return "hoja-lineal";
    case "olivo":
      return "hoja-lanceolada";
    case "bambu":
      return "cana-segmentada";
    case "cactus":
      return "costilla";
    case "potos":
      return "hoja-acorazonada";
    case "sansevieria":
      return "hoja-espada";
    case "pilea":
      return "hoja-redonda";
    case "palmera":
      return "fronda-palmeada";
    case "eucalipto":
      return "hoja-ovalada";
  }
}

export type PlantRenderInputV2 = {
  species: PlantSpeciesV2;
  visualSeed: number;
  stage: StageKey;
};

/** Ruta v2: mismo principio de congelamiento que v1 (los sorteos r1..r9
 *  ocurren siempre en el mismo orden) — en cuanto se apruebe visualmente,
 *  esta función también queda fija para siempre y cualquier ajuste futuro
 *  sería v3. */
function plantRenderSpecV2Impl(species: PlantSpeciesV2, visualSeed: number, stage: StageKey): PlantRenderSpecV2 {
  const t = SPECIES_TRAITS_V2[species];
  const rng = mulberry32((visualSeed ^ hashStringV2(`v2::${species}`)) >>> 0);
  const r1 = rng();
  const r2 = rng();
  const r3 = rng();
  const r4 = rng();
  const r5 = rng();
  const r6 = rng();
  const r7 = rng();
  const r8 = rng();
  const r9 = rng();

  const g = STAGE_GROWTH_V2[stage];
  const adultHeight = lerp(t.height[0], t.height[1], r2);
  const adultStems = Math.round(lerp(t.stemCount[0], t.stemCount[1], r3));
  const adultBranches = Math.round(lerp(t.branchCount[0], t.branchCount[1], r6));
  const adultLeaves = Math.round(lerp(t.leafCountAdult[0], t.leafCountAdult[1], r7));

  const isSeed = stage === "semilla";

  return {
    rendererVersion: 2,
    species,
    stage,
    orientation: { leanDeg: round3((r1 * 2 - 1) * t.maxLeanDeg) },
    height: round3(Math.max(0.04, adultHeight * g)),
    stem: {
      count: isSeed ? 1 : Math.max(1, Math.round(adultStems * lerp(0.4, 1, g))),
      thickness: round3(lerp(t.thickness[0], t.thickness[1], r4) * lerp(0.5, 1, g)),
      curvature: round3(lerp(t.curvature[0], t.curvature[1], r5)),
      woody: species === "olivo" || species === "eucalipto" || species === "palmera" || (species === "lavanda" && stage === "planta-completa"),
    },
    branches: {
      count: isSeed || stage === "brote" ? 0 : Math.round(adultBranches * g),
      angleDeg: round3(lerp(t.branchAngleDeg[0], t.branchAngleDeg[1], r6)),
      lengthRatio: round3(lerp(t.branchLengthRatio[0], t.branchLengthRatio[1], r6)),
      arrangement: t.arrangement,
    },
    leaves: {
      count: isSeed ? 0 : Math.max(1, Math.round(adultLeaves * g)),
      sizeRatio: round3(lerp(t.leafSizeRatio[0], t.leafSizeRatio[1], r7) * lerp(0.6, 1, g)),
      density: round3(lerp(t.density[0], t.density[1], r7)),
      shape: leafShapeForV2(species, stage),
    },
    proportions: {
      crownWidthRatio: round3(lerp(t.crownWidthRatio[0], t.crownWidthRatio[1], r8)),
      stemHeightRatio: round3(lerp(t.stemHeightRatio[0], t.stemHeightRatio[1], r8)),
    },
    details: detailsForV2(species, stage, r9 >= 0.5),
  };
}

/** Punto de entrada v2. Acepta cualquier especie del set v2 (incluye las 5
 *  originales de v1, mismos nombres) — así una planta nacida bajo v1 se
 *  puede alimentar directo a este motor con su especie/seed/etapa guardadas,
 *  sin ninguna tabla de traducción: es el «adaptador» de compatibilidad. */
export function plantRenderSpecV2(input: PlantRenderInputV2): PlantRenderSpecV2 {
  return plantRenderSpecV2Impl(input.species, input.visualSeed >>> 0, input.stage);
}

/** ¿Esta cadena de especie (tal como viene guardada en focus_plants, de v1 o
 *  v2) es una especie válida para el motor v2? Usado por el adaptador de
 *  compatibilidad antes de alimentar datos antiguos al motor nuevo. */
export function isKnownSpeciesV2(species: string): species is PlantSpeciesV2 {
  return (PLANT_SPECIES_V2 as readonly string[]).includes(species);
}
