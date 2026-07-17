/* Escena SVG determinista a partir de la especificación de plant-render — Fase 7E.3.
   Lógica pura y testeable: convierte un PlantRenderSpec en trazos (paths) listos
   para que el componente presentacional los pinte con currentColor.

   Reglas heredadas del motor (7E.2):
   - misma especificación → exactamente los mismos trazos, byte a byte;
   - jamás Math.random: la variación fina usa un «wiggle» determinista derivado
     de los propios números de la especificación;
   - sin colores aquí: todo es trazo lineal botánico con currentColor y
     opacidades, como la planta compartida del sidebar/overlay;
   - las etapas semilla y brote NO pasan por aquí: usan el arte compartido
     (la identidad de especie se hace evidente conforme la planta crece). */

import type { PlantRenderSpec } from "./plant-render";

export type PlantStroke = { d: string; w: number; o?: number };
export type PlantScene = {
  strokes: PlantStroke[];
  /** Encuadre: zoom alrededor de (cx, cy), como STAGE_VIEW del arte compartido. */
  frame: { k: number; cx: number; cy: number };
};

// ── Utilidades geométricas (todas deterministas) ─────────────────

const BASE_X = 48;
const BASE_Y = 78; // línea de tierra del arte compartido
const MAX_H = 60; // alto máximo dibujable (y=18)

const rad = (deg: number) => (deg * Math.PI) / 180;
const r2 = (n: number) => Math.round(n * 100) / 100;
const pt = (x: number, y: number) => `${r2(x)} ${r2(y)}`;

/** Ruido determinista en [-1, 1]: mismo índice + misma sal → mismo valor. */
function wiggle(i: number, salt: number): number {
  const x = Math.sin((i + 1) * 127.1 + salt * 311.7) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

/** Sal derivada de la especificación: dos seeds distintos → sales distintas. */
function saltOf(spec: PlantRenderSpec): number {
  return (
    spec.orientation.leanDeg * 7.3 +
    spec.stem.curvature * 13.7 +
    spec.leaves.density * 5.1 +
    spec.proportions.crownWidthRatio * 3.9
  );
}

type P = { x: number; y: number };

/** Punto sobre una curva cuadrática. */
function qAt(a: P, c: P, b: P, t: number): P {
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
}

/** Tangente (normalizada) de una curva cuadrática. */
function qTan(a: P, c: P, b: P, t: number): P {
  const dx = 2 * (1 - t) * (c.x - a.x) + 2 * t * (b.x - c.x);
  const dy = 2 * (1 - t) * (c.y - a.y) + 2 * t * (b.y - c.y);
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

const line = (a: P, b: P): string => `M${pt(a.x, a.y)}L${pt(b.x, b.y)}`;
const quad = (a: P, c: P, b: P): string => `M${pt(a.x, a.y)}Q${pt(c.x, c.y)} ${pt(b.x, b.y)}`;

/** Hoja cerrada en forma de gota/punta: dos arcos de ida y vuelta. */
function leafPath(base: P, tip: P, width: number): string {
  const mx = (base.x + tip.x) / 2;
  const my = (base.y + tip.y) / 2;
  const dx = tip.x - base.x;
  const dy = tip.y - base.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * width;
  const ny = (dx / len) * width;
  return `M${pt(base.x, base.y)}Q${pt(mx + nx, my + ny)} ${pt(tip.x, tip.y)}Q${pt(mx - nx, my - ny)} ${pt(base.x, base.y)}Z`;
}

/** Suelo compartido (idéntico al arte de 7C). */
function ground(): PlantStroke[] {
  return [
    { d: "M26 78h44", w: 1.2 },
    { d: "M20 82h10M66 82h10", w: 0.9, o: 0.5 },
  ];
}

/** Inclinación global: desplaza x en proporción a la altura sobre la tierra. */
function leanFn(leanDeg: number): (p: P) => P {
  const t = Math.tan(rad(leanDeg));
  return (p) => ({ x: p.x + t * (BASE_Y - p.y), y: p.y });
}

// ── Especies ─────────────────────────────────────────────────────

function helechoScene(spec: PlantRenderSpec, H: number, salt: number): PlantStroke[] {
  const strokes: PlantStroke[] = [];
  const L = leanFn(spec.orientation.leanDeg);
  const n = Math.max(3, spec.stem.count);
  const spread = 64 * Math.min(1.15, spec.proportions.crownWidthRatio);
  const pinnaePerFrond = Math.max(2, Math.round(spec.leaves.count / n));
  const base: P = { x: BASE_X, y: BASE_Y };

  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0.5 : i / (n - 1);
    const ang = (-0.5 + u) * 2 * spread + wiggle(i, salt) * 7;
    const len = H * (0.66 + 0.34 * Math.abs(wiggle(i + 11, salt)));
    const a = rad(ang);
    // la fronda arquea hacia fuera según la curvatura
    const bend = spec.stem.curvature * len * 0.5 * Math.sign(ang || 1);
    const tip = L({ x: BASE_X + Math.sin(a) * len * 0.85 + bend * 0.35, y: BASE_Y - Math.cos(a) * len });
    const ctrl = L({ x: BASE_X + Math.sin(a) * len * 0.3 - bend * 0.25, y: BASE_Y - Math.cos(a) * len * 0.55 });
    strokes.push({ d: quad(base, ctrl, tip), w: 1.15 });
    // pinnas: hojitas cortas alternadas a lo largo de la fronda
    for (let j = 0; j < pinnaePerFrond; j++) {
      const t = 0.3 + (0.62 * (j + 1)) / pinnaePerFrond;
      const p = qAt(base, ctrl, tip, t);
      const tan = qTan(base, ctrl, tip, t);
      const side = j % 2 === 0 ? 1 : -1;
      const size = (2.2 + spec.leaves.sizeRatio * H * 0.6) * (1 - t * 0.45);
      const end = { x: p.x - tan.y * size * side + tan.x * size * 0.4, y: p.y + tan.x * size * side + tan.y * size * 0.4 };
      strokes.push({ d: line(p, end), w: 0.85, o: 0.8 });
    }
  }
  if (spec.details.includes("fronda-enrollada")) {
    // báculo enrollado naciendo en el centro
    strokes.push({
      d: `M${pt(BASE_X, BASE_Y)}q1 -7 .5 -10q-.4 -2.6 -2.6 -2.4q-1.8.2 -1.4 1.9q.3 1.4 1.8 1.1`,
      w: 1,
      o: 0.85,
    });
  }
  return strokes;
}

function monsteraScene(spec: PlantRenderSpec, H: number, salt: number): PlantStroke[] {
  const strokes: PlantStroke[] = [];
  const L = leanFn(spec.orientation.leanDeg);
  const top: P = L({ x: BASE_X + spec.stem.curvature * 6, y: BASE_Y - H });
  const ctrl: P = L({ x: BASE_X - spec.stem.curvature * 8, y: BASE_Y - H * 0.5 });
  const base: P = { x: BASE_X, y: BASE_Y };
  strokes.push({ d: quad(base, ctrl, top), w: 1.4 });
  if (spec.stem.count > 1) {
    const top2 = L({ x: BASE_X - 4 - spec.stem.curvature * 4, y: BASE_Y - H * 0.62 });
    strokes.push({ d: quad(base, L({ x: BASE_X - 5, y: BASE_Y - H * 0.3 }), top2), w: 1.15, o: 0.9 });
  }
  const nLeaves = Math.max(1, spec.leaves.count);
  const fenestrada = spec.leaves.shape === "hoja-fenestrada";
  const size = Math.max(5, spec.leaves.sizeRatio * H * 1.05);
  for (let i = 0; i < nLeaves; i++) {
    const t = 0.34 + (0.62 * i) / Math.max(1, nLeaves - 1);
    const p = qAt(base, ctrl, top, t);
    const side = i % 2 === 0 ? 1 : -1;
    const ang = rad(90 - spec.branches.angleDeg - wiggle(i, salt) * 8) ;
    const plen = Math.max(3, spec.branches.lengthRatio * H * (0.5 + 0.2 * Math.abs(wiggle(i + 3, salt))));
    const end: P = { x: p.x + Math.cos(ang) * plen * side, y: p.y - Math.sin(ang) * plen * 0.35 };
    strokes.push({ d: quad(p, { x: (p.x + end.x) / 2, y: Math.min(p.y, end.y) - 1.5 }, end), w: 1 }); // pecíolo
    // hoja acorazonada: gota ancha que cae desde el pecíolo
    const tip: P = { x: end.x + side * size * 0.55, y: end.y + size * 0.85 };
    strokes.push({ d: leafPath(end, tip, size * 0.5), w: 1.2 });
    strokes.push({ d: line(end, { x: (end.x + tip.x) / 2, y: (end.y + tip.y) / 2 }), w: 0.7, o: 0.55 }); // nervadura
    if (fenestrada && size > 6) {
      // fenestraciones: cortes cortos desde el borde hacia la nervadura
      for (let f = 0; f < 2; f++) {
        const ft = 0.35 + f * 0.3;
        const mid = { x: end.x + (tip.x - end.x) * ft, y: end.y + (tip.y - end.y) * ft };
        const cut = { x: mid.x + side * size * 0.32, y: mid.y - size * 0.1 };
        strokes.push({ d: line(cut, { x: mid.x + side * size * 0.06, y: mid.y }), w: 0.8, o: 0.9 });
      }
    }
  }
  if (spec.details.includes("raiz-aerea")) {
    strokes.push({ d: `M${pt(BASE_X + 1.5, BASE_Y - H * 0.3)}q3.5 4 3 ${r2(H * 0.3 - 1)}`, w: 0.8, o: 0.6 });
  }
  return strokes;
}

function suculentaScene(spec: PlantRenderSpec, H: number, salt: number): PlantStroke[] {
  const strokes: PlantStroke[] = [];
  const cx = BASE_X + spec.orientation.leanDeg * 0.25;
  const cy = BASE_Y - Math.max(3, H * 0.16);
  const R = Math.max(6, 15 * spec.proportions.crownWidthRatio * (H / MAX_H + 0.45));
  const n = Math.max(4, spec.leaves.count);
  const outer = Math.ceil(n * 0.6);
  const inner = n - outer;
  const petal = (angDeg: number, radius: number, width: number) => {
    const a = rad(angDeg);
    const tip: P = { x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius * 0.62 };
    return leafPath({ x: cx, y: cy }, tip, width);
  };
  for (let i = 0; i < outer; i++) {
    const ang = 180 + (i / outer) * 360 + wiggle(i, salt) * 6;
    strokes.push({ d: petal(ang, R * (0.9 + 0.15 * wiggle(i + 5, salt)), R * 0.24), w: 1.15 });
  }
  for (let i = 0; i < inner; i++) {
    const ang = 180 + 24 + (i / Math.max(1, inner)) * 360 + wiggle(i + 9, salt) * 6;
    strokes.push({ d: petal(ang, R * 0.55, R * 0.2), w: 1.05, o: 0.85 });
  }
  if (spec.details.includes("hijuelo-en-base")) {
    const hx = cx + R * 0.95;
    strokes.push({ d: leafPath({ x: hx, y: BASE_Y - 1 }, { x: hx + 3.4, y: BASE_Y - 4.4 }, 1.4), w: 0.9, o: 0.8 });
    strokes.push({ d: leafPath({ x: hx, y: BASE_Y - 1 }, { x: hx - 2.6, y: BASE_Y - 4.8 }, 1.3), w: 0.9, o: 0.8 });
  }
  return strokes;
}

function lavandaScene(spec: PlantRenderSpec, H: number, salt: number): PlantStroke[] {
  const strokes: PlantStroke[] = [];
  const L = leanFn(spec.orientation.leanDeg);
  const n = Math.max(3, spec.stem.count);
  const spread = 30 * spec.proportions.crownWidthRatio;
  const base: P = { x: BASE_X, y: BASE_Y };
  const espigas = spec.details.includes("espigas-florales");
  const leavesPerStem = Math.max(1, Math.round(spec.leaves.count / n / 2));

  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0.5 : i / (n - 1);
    const ang = (-0.5 + u) * 2 * spread + wiggle(i, salt) * 5;
    const len = H * (0.78 + 0.22 * Math.abs(wiggle(i + 4, salt)));
    const a = rad(ang);
    const tip = L({ x: BASE_X + Math.sin(a) * len * 0.5, y: BASE_Y - Math.cos(a) * len });
    const ctrl = L({ x: BASE_X + Math.sin(a) * len * 0.2 + spec.stem.curvature * 4 * Math.sign(ang || 1), y: BASE_Y - len * 0.5 });
    strokes.push({ d: quad(base, ctrl, tip), w: 0.95 });
    // hojas lineales opuestas en la mitad baja del tallo
    for (let j = 0; j < leavesPerStem; j++) {
      const t = 0.18 + (0.35 * (j + 1)) / leavesPerStem;
      const p = qAt(base, ctrl, tip, t);
      const tan = qTan(base, ctrl, tip, t);
      const s = 2 + spec.leaves.sizeRatio * H * 0.7;
      strokes.push({ d: line(p, { x: p.x - tan.y * s + tan.x * 1.2, y: p.y + tan.x * s + tan.y * 1.2 }), w: 0.75, o: 0.8 });
      strokes.push({ d: line(p, { x: p.x + tan.y * s + tan.x * 1.2, y: p.y - tan.x * s + tan.y * 1.2 }), w: 0.75, o: 0.8 });
    }
    if (espigas) {
      // espiga: pares de trazos cortos apilados sobre la punta
      const tan = qTan(base, ctrl, tip, 1);
      for (let k = 0; k < 3; k++) {
        const p = { x: tip.x + tan.x * (k * 2.1), y: tip.y + tan.y * (k * 2.1) };
        const s = 1.7 - k * 0.35;
        strokes.push({ d: line({ x: p.x - tan.y * s, y: p.y + tan.x * s }, { x: p.x + tan.y * s, y: p.y - tan.x * s }), w: 1.05, o: 0.9 });
      }
      strokes.push({ d: line(tip, { x: tip.x + tan.x * 7.2, y: tip.y + tan.y * 7.2 }), w: 0.8, o: 0.7 });
    }
  }
  if (spec.details.includes("base-lenosa")) {
    strokes.push({ d: `M${pt(BASE_X - 2.5, BASE_Y)}v-3.4M${pt(BASE_X + 2.5, BASE_Y)}v-3.8`, w: 1.5, o: 0.7 });
  }
  return strokes;
}

function olivoScene(spec: PlantRenderSpec, H: number, salt: number): PlantStroke[] {
  const strokes: PlantStroke[] = [];
  const L = leanFn(spec.orientation.leanDeg);
  const base: P = { x: BASE_X, y: BASE_Y };
  const trunkTopY = BASE_Y - H * Math.max(0.3, spec.proportions.stemHeightRatio + 0.12);
  const bend = spec.stem.curvature * 9;
  const trunkTop: P = L({ x: BASE_X + bend * 0.4, y: trunkTopY });
  const trunkCtrl: P = L({ x: BASE_X - bend, y: BASE_Y - H * 0.28 });
  strokes.push({ d: quad(base, trunkCtrl, trunkTop), w: 1.6 });
  if (spec.details.includes("tronco-nudoso")) {
    const p = qAt(base, trunkCtrl, trunkTop, 0.45);
    strokes.push({ d: `M${pt(p.x, p.y)}q-2.6 -.6 -3.4 -2.8`, w: 0.9, o: 0.6 });
  }
  const nB = Math.max(2, spec.branches.count);
  const leavesPerBranch = Math.max(2, Math.round(spec.leaves.count / nB));
  const crownR = H * 0.5 * spec.proportions.crownWidthRatio;
  for (let i = 0; i < nB; i++) {
    const u = i / Math.max(1, nB - 1);
    const side = i % 2 === 0 ? 1 : -1;
    // las ramas nacen del tercio alto del tronco y se reparten en una copa redondeada
    const start = qAt(base, trunkCtrl, trunkTop, 0.72 + u * 0.28);
    const ang = rad(20 + spec.branches.angleDeg * (0.45 + 0.55 * u) + wiggle(i, salt) * 8);
    const blen = Math.max(4, crownR * (0.55 + 0.45 * Math.abs(wiggle(i + 6, salt))));
    const end: P = { x: start.x + Math.cos(ang) * blen * side, y: start.y - Math.sin(ang) * blen };
    const bctrl: P = { x: (start.x + end.x) / 2, y: Math.min(start.y, end.y) + 1 };
    strokes.push({ d: quad(start, bctrl, end), w: 1.05 });
    // hojas lanceoladas en pares a lo largo de la rama
    for (let j = 0; j <= leavesPerBranch; j++) {
      const t = 0.35 + (0.65 * j) / Math.max(1, leavesPerBranch);
      const p = qAt(start, bctrl, end, Math.min(1, t));
      const tan = qTan(start, bctrl, end, Math.min(1, t));
      const s = 2 + spec.leaves.sizeRatio * H * 0.75;
      const sway = 0.35;
      if (j % 2 === 0) {
        strokes.push({ d: line(p, { x: p.x - tan.y * s + tan.x * s * sway, y: p.y + tan.x * s + tan.y * s * sway }), w: 0.8, o: 0.85 });
      } else {
        strokes.push({ d: line(p, { x: p.x + tan.y * s + tan.x * s * sway, y: p.y - tan.x * s + tan.y * s * sway }), w: 0.8, o: 0.85 });
      }
    }
  }
  return strokes;
}

// ── Punto de entrada ─────────────────────────────────────────────

/** Convierte la especificación en escena. Solo etapas con identidad de especie
 *  (hojas en adelante); semilla y brote usan el arte compartido en el componente. */
export function plantScene(spec: PlantRenderSpec): PlantScene {
  const H = Math.max(6, spec.height * MAX_H);
  const salt = saltOf(spec);
  let strokes: PlantStroke[];
  switch (spec.species) {
    case "helecho":
      strokes = helechoScene(spec, H, salt);
      break;
    case "monstera":
      strokes = monsteraScene(spec, H, salt);
      break;
    case "suculenta":
      strokes = suculentaScene(spec, H, salt);
      break;
    case "lavanda":
      strokes = lavandaScene(spec, H, salt);
      break;
    case "olivo":
      strokes = olivoScene(spec, H, salt);
      break;
  }
  strokes.push(...ground());
  // encuadre automático: la planta ocupa el marco a cualquier altura
  const visualH = spec.species === "suculenta" ? Math.max(H * 0.45, 16) : H;
  const k = Math.min(1.75, Math.max(1, 56 / (visualH + 12)));
  return { strokes, frame: { k: r2(k), cx: BASE_X, cy: r2(BASE_Y - visualH / 2 - 2) } };
}

/** Nombre visible en español de cada especie. */
export const SPECIES_LABEL: Record<string, string> = {
  helecho: "Helecho",
  monstera: "Monstera",
  suculenta: "Suculenta",
  lavanda: "Lavanda",
  olivo: "Olivo",
};
