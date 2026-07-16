/* Motor determinista de identidad y apariencia de plantas — Fase 7E.2.
   Lógica pura, sin componentes visuales, sin Math.random, sin dependencias:
   misma entrada → exactamente la misma especificación, byte a byte.

   Dos responsabilidades:
   1) newPlantIdentity(id): especie + visual_seed + renderer_version al NACER una
      planta. Se persisten una sola vez y nunca se recalculan — la identidad
      sobrevive recargas, reinicios y versiones futuras del renderer.
   2) plantRenderSpec(input): la especificación geométrica/botánica que un futuro
      componente SVG (7E.3+) dibujará. La versión 1 queda congelada: si algún día
      existe una v2, las plantas guardadas con renderer_version = 1 seguirán
      pasando por esta misma ruta, idéntica para siempre.

   Sin colores aquí: la especificación describe FORMA (tallo, ramas, hojas,
   orientación, curvatura, densidad, proporciones, detalles). El color lo pondrá
   el componente con los tokens del sistema (currentColor), como la planta del
   sidebar. */

import type { StageKey } from "./focus-logic";

// ── Especies ─────────────────────────────────────────────────────

export const PLANT_SPECIES = ["helecho", "monstera", "suculenta", "lavanda", "olivo"] as const;
export type PlantSpecies = (typeof PLANT_SPECIES)[number];

export const CURRENT_RENDERER_VERSION = 1;

// ── Identidad al nacer ───────────────────────────────────────────

/** FNV-1a de 32 bits — hash determinista y sin dependencias. Devuelve uint32. */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export type PlantIdentity = {
  species: PlantSpecies;
  visualSeed: number; // uint32
  rendererVersion: number;
};

/** Identidad completa de una planta recién nacida, derivada de su id (uuid).
 *  Determinista: el mismo id produce siempre la misma identidad. Se llama UNA
 *  vez al insertar la fila; después la identidad solo se LEE de la base. */
export function newPlantIdentity(plantId: string): PlantIdentity {
  return {
    species: PLANT_SPECIES[hashString(`${plantId}::especie`) % PLANT_SPECIES.length],
    visualSeed: hashString(plantId),
    rendererVersion: CURRENT_RENDERER_VERSION,
  };
}

// ── PRNG con semilla (mulberry32) ────────────────────────────────

/** Generador determinista: misma semilla → misma secuencia. Jamás Math.random. */
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

export type LeafShape =
  | "fronda-pinnada" // helecho
  | "hoja-acorazonada" // monstera joven
  | "hoja-fenestrada" // monstera adulta
  | "hoja-carnosa" // suculenta
  | "hoja-lineal" // lavanda
  | "hoja-lanceolada"; // olivo

export type BranchArrangement = "alterna" | "opuesta" | "roseta";

export type PlantRenderSpec = {
  rendererVersion: 1;
  species: PlantSpecies;
  stage: StageKey;
  /** Inclinación global en grados: negativa = izquierda. La «personalidad». */
  orientation: { leanDeg: number };
  /** Altura relativa 0..1 respecto al lienzo que el componente decida. */
  height: number;
  stem: {
    count: number; // tallos que salen de la base
    thickness: number; // 0..1 relativo
    curvature: number; // 0..1: 0 recto, 1 muy curvado
    woody: boolean; // leñoso (olivo, base de lavanda adulta)
  };
  branches: {
    count: number;
    angleDeg: number; // apertura respecto al tallo
    lengthRatio: number; // largo de rama / alto del tallo
    arrangement: BranchArrangement;
  };
  leaves: {
    count: number;
    sizeRatio: number; // tamaño de hoja / alto total, 0..1
    density: number; // 0..1
    shape: LeafShape;
  };
  proportions: {
    crownWidthRatio: number; // ancho de copa / alto total
    stemHeightRatio: number; // alto de tallo desnudo / alto total
  };
  /** Detalles botánicos permitidos por especie y etapa (nunca inventados). */
  details: string[];
};

/** Rasgos de identidad por especie: base ± variación segura por seed.
 *  Exportado para que las pruebas verifiquen los límites exactos. */
export const SPECIES_TRAITS: Record<
  PlantSpecies,
  {
    maxLeanDeg: number;
    height: [number, number];
    stemCount: [number, number];
    thickness: [number, number];
    curvature: [number, number];
    branchCount: [number, number]; // en etapa adulta
    branchAngleDeg: [number, number];
    branchLengthRatio: [number, number];
    arrangement: BranchArrangement;
    leafCountAdult: [number, number];
    leafSizeRatio: [number, number];
    density: [number, number];
    crownWidthRatio: [number, number];
    stemHeightRatio: [number, number];
  }
> = {
  helecho: {
    maxLeanDeg: 6,
    height: [0.5, 0.7],
    stemCount: [5, 9], // frondas desde la base
    thickness: [0.08, 0.14],
    curvature: [0.55, 0.85], // frondas arqueadas
    branchCount: [0, 0], // las frondas SON los tallos
    branchAngleDeg: [0, 0],
    branchLengthRatio: [0, 0],
    arrangement: "roseta",
    leafCountAdult: [24, 40], // pinnas repartidas en las frondas
    leafSizeRatio: [0.05, 0.09],
    density: [0.7, 0.95],
    crownWidthRatio: [0.8, 1.1],
    stemHeightRatio: [0.1, 0.2],
  },
  monstera: {
    maxLeanDeg: 8,
    height: [0.7, 0.95],
    stemCount: [1, 2],
    thickness: [0.12, 0.2],
    curvature: [0.25, 0.5],
    branchCount: [3, 6], // pecíolos
    branchAngleDeg: [30, 55],
    branchLengthRatio: [0.35, 0.55],
    arrangement: "alterna",
    leafCountAdult: [5, 9], // pocas hojas, grandes
    leafSizeRatio: [0.22, 0.32],
    density: [0.35, 0.55],
    crownWidthRatio: [0.7, 1.0],
    stemHeightRatio: [0.25, 0.4],
  },
  suculenta: {
    maxLeanDeg: 3, // casi simétrica
    height: [0.25, 0.4],
    stemCount: [1, 1],
    thickness: [0.2, 0.3],
    curvature: [0.0, 0.15],
    branchCount: [0, 0],
    branchAngleDeg: [0, 0],
    branchLengthRatio: [0, 0],
    arrangement: "roseta",
    leafCountAdult: [12, 21],
    leafSizeRatio: [0.1, 0.16],
    density: [0.85, 1.0],
    crownWidthRatio: [1.0, 1.3], // más ancha que alta
    stemHeightRatio: [0.0, 0.08],
  },
  lavanda: {
    maxLeanDeg: 7,
    height: [0.6, 0.85],
    stemCount: [4, 8], // mata de tallos finos
    thickness: [0.04, 0.08],
    curvature: [0.15, 0.35],
    branchCount: [2, 4],
    branchAngleDeg: [15, 30], // ramas erguidas
    branchLengthRatio: [0.25, 0.4],
    arrangement: "opuesta",
    leafCountAdult: [18, 30],
    leafSizeRatio: [0.04, 0.07],
    density: [0.5, 0.75],
    crownWidthRatio: [0.45, 0.7],
    stemHeightRatio: [0.15, 0.3],
  },
  olivo: {
    maxLeanDeg: 10, // el tronco con más carácter
    height: [0.75, 1.0],
    stemCount: [1, 1],
    thickness: [0.18, 0.28],
    curvature: [0.3, 0.6], // tronco nudoso
    branchCount: [4, 7],
    branchAngleDeg: [35, 60],
    branchLengthRatio: [0.3, 0.5],
    arrangement: "alterna",
    leafCountAdult: [22, 36],
    leafSizeRatio: [0.04, 0.07],
    density: [0.45, 0.7],
    crownWidthRatio: [0.6, 0.9],
    stemHeightRatio: [0.35, 0.5],
  },
};

/** Factor de crecimiento por etapa (aprobadas en 7B): escala alturas y conteos.
 *  La IDENTIDAD (inclinación, curvatura, proporciones) no cambia entre etapas:
 *  la planta crece, no se convierte en otra. */
export const STAGE_GROWTH: Record<StageKey, number> = {
  semilla: 0.08,
  brote: 0.3,
  hojas: 0.55,
  "planta-joven": 0.8,
  "planta-completa": 1,
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Detalles botánicos permitidos por especie/etapa. `extra` es el rasgo opcional
 *  que depende del seed (lo tienen «algunas» plantas, de forma estable). */
function detailsFor(species: PlantSpecies, stage: StageKey, extra: boolean): string[] {
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
  return d;
}

function leafShapeFor(species: PlantSpecies, stage: StageKey): LeafShape {
  switch (species) {
    case "helecho":
      return "fronda-pinnada";
    case "monstera":
      // Botánicamente honesto: las hojas jóvenes no tienen fenestraciones.
      return stage === "planta-joven" || stage === "planta-completa" ? "hoja-fenestrada" : "hoja-acorazonada";
    case "suculenta":
      return "hoja-carnosa";
    case "lavanda":
      return "hoja-lineal";
    case "olivo":
      return "hoja-lanceolada";
  }
}

export type PlantRenderInput = {
  species: PlantSpecies;
  visualSeed: number;
  stage: StageKey;
  rendererVersion: number;
};

/** Ruta v1, congelada. Los sorteos del PRNG ocurren SIEMPRE en el mismo orden
 *  (r1..r9) — cambiarlo cambiaría la apariencia de todas las plantas guardadas. */
function plantRenderSpecV1(species: PlantSpecies, visualSeed: number, stage: StageKey): PlantRenderSpec {
  const t = SPECIES_TRAITS[species];
  // La especie participa en la semilla del PRNG: mismo seed + especie distinta
  // → variante distinta. La ETAPA no participa: la identidad no cambia al crecer.
  const rng = mulberry32((visualSeed ^ hashString(`v1::${species}`)) >>> 0);
  const r1 = rng(); // inclinación
  const r2 = rng(); // altura adulta
  const r3 = rng(); // tallos
  const r4 = rng(); // grosor
  const r5 = rng(); // curvatura
  const r6 = rng(); // ramas (conteo + ángulo + largo comparten sorteo: rasgo coherente)
  const r7 = rng(); // hojas (conteo adulto + densidad)
  const r8 = rng(); // proporciones
  const r9 = rng(); // detalle botánico opcional

  const g = STAGE_GROWTH[stage];
  const adultHeight = lerp(t.height[0], t.height[1], r2);
  const adultStems = Math.round(lerp(t.stemCount[0], t.stemCount[1], r3));
  const adultBranches = Math.round(lerp(t.branchCount[0], t.branchCount[1], r6));
  const adultLeaves = Math.round(lerp(t.leafCountAdult[0], t.leafCountAdult[1], r7));

  // La semilla apenas asoma: sin ramas ni hojas todavía (el cotiledón lo dibuja
  // el componente); del brote en adelante los conteos crecen con la etapa.
  const isSeed = stage === "semilla";

  return {
    rendererVersion: 1,
    species,
    stage,
    orientation: { leanDeg: round3((r1 * 2 - 1) * t.maxLeanDeg) },
    height: round3(Math.max(0.04, adultHeight * g)),
    stem: {
      count: isSeed ? 1 : Math.max(1, Math.round(adultStems * lerp(0.4, 1, g))),
      thickness: round3(lerp(t.thickness[0], t.thickness[1], r4) * lerp(0.5, 1, g)),
      curvature: round3(lerp(t.curvature[0], t.curvature[1], r5)),
      woody: species === "olivo" || (species === "lavanda" && stage === "planta-completa"),
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
      shape: leafShapeFor(species, stage),
    },
    proportions: {
      crownWidthRatio: round3(lerp(t.crownWidthRatio[0], t.crownWidthRatio[1], r8)),
      stemHeightRatio: round3(lerp(t.stemHeightRatio[0], t.stemHeightRatio[1], r8)),
    },
    details: detailsFor(species, stage, r9 >= 0.5),
  };
}

/** Punto de entrada: enruta por renderer_version. Solo existe la v1; una versión
 *  desconocida es un error explícito (nunca una apariencia inventada). */
export function plantRenderSpec(input: PlantRenderInput): PlantRenderSpec {
  if (input.rendererVersion === 1) {
    return plantRenderSpecV1(input.species, input.visualSeed >>> 0, input.stage);
  }
  throw new Error(`renderer_version ${input.rendererVersion} no soportado (solo v1)`);
}
