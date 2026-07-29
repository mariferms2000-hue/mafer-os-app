/* Escena SVG determinista a partir de PlantRenderSpecV2 — motor v2 (rediseño).
   Mismo contrato que plant-svg.ts (v1), que queda INTACTO como referencia
   congelada. Este archivo es independiente (no importa nada de v1) para que
   v1 nunca pueda verse afectado por cambios aquí.

   Reglas heredadas:
   - misma especificación → exactamente los mismos trazos, byte a byte;
   - jamás Math.random: variación fina vía «wiggle» determinista;
   - sin colores: trazo lineal botánico con currentColor y opacidades;
   - semilla y brote NO pasan por aquí: usan el arte compartido (ver
     plant-art.tsx) — igual que v1, la identidad se hace evidente al crecer. */

import type { PlantRenderSpecV2 } from "./plant-render-v2";

export type PlantStrokeV2 = { d: string; w: number; o?: number };
export type PlantSceneV2 = {
  strokes: PlantStrokeV2[];
  frame: { k: number; cx: number; cy: number };
};

// ── Utilidades geométricas compartidas (todas deterministas) ─────

const BASE_X = 48;
const BASE_Y = 78;
const MAX_H = 60;

const rad = (deg: number) => (deg * Math.PI) / 180;
const r2 = (n: number) => Math.round(n * 100) / 100;
const pt = (x: number, y: number) => `${r2(x)} ${r2(y)}`;

function wiggle(i: number, salt: number): number {
  const x = Math.sin((i + 1) * 127.1 + salt * 311.7) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

function saltOf(spec: PlantRenderSpecV2): number {
  return (
    spec.orientation.leanDeg * 7.3 +
    spec.stem.curvature * 13.7 +
    spec.leaves.density * 5.1 +
    spec.proportions.crownWidthRatio * 3.9
  );
}

type P = { x: number; y: number };

function qAt(a: P, c: P, b: P, t: number): P {
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
}

function qTan(a: P, c: P, b: P, t: number): P {
  const dx = 2 * (1 - t) * (c.x - a.x) + 2 * t * (b.x - c.x);
  const dy = 2 * (1 - t) * (c.y - a.y) + 2 * t * (b.y - c.y);
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

const line = (a: P, b: P): string => `M${pt(a.x, a.y)}L${pt(b.x, b.y)}`;
const quad = (a: P, c: P, b: P): string => `M${pt(a.x, a.y)}Q${pt(c.x, c.y)} ${pt(b.x, b.y)}`;

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

/** Hoja/moneda redonda: círculo vía dos arcos, centrado en `center`. */
function roundLeaf(center: P, r: number): string {
  return `M${pt(center.x - r, center.y)}A${r2(r)} ${r2(r)} 0 1 0 ${pt(center.x + r, center.y)}A${r2(r)} ${r2(r)} 0 1 0 ${pt(center.x - r, center.y)}Z`;
}

/** Hoja acorazonada (monstera): base partida en dos lóbulos (muesca en el
 *  punto de inserción del peciolo) que se ensanchan y convergen en punta —
 *  silueta más icónica que el óvalo genérico de `leafPath`. */
function heartLeaf(base: P, tip: P, width: number): string {
  const dx = tip.x - base.x;
  const dy = tip.y - base.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -dy / len;
  const ny = dx / len;
  const bl: P = { x: base.x + nx * width * 0.22, y: base.y + ny * width * 0.22 };
  const br: P = { x: base.x - nx * width * 0.22, y: base.y - ny * width * 0.22 };
  const notch: P = { x: base.x + ux * width * 0.16, y: base.y + uy * width * 0.16 };
  const wl: P = { x: base.x + ux * len * 0.42 + nx * width, y: base.y + uy * len * 0.42 + ny * width };
  const wr: P = { x: base.x + ux * len * 0.42 - nx * width, y: base.y + uy * len * 0.42 - ny * width };
  return `M${pt(bl.x, bl.y)}Q${pt(wl.x, wl.y)} ${pt(tip.x, tip.y)}Q${pt(wr.x, wr.y)} ${pt(br.x, br.y)}L${pt(notch.x, notch.y)}L${pt(bl.x, bl.y)}Z`;
}

function ground(): PlantStrokeV2[] {
  return [
    { d: "M26 78h44", w: 1.2 },
    { d: "M20 82h10M66 82h10", w: 0.9, o: 0.5 },
  ];
}

function leanFn(leanDeg: number): (p: P) => P {
  const t = Math.tan(rad(leanDeg));
  return (p) => ({ x: p.x + t * (BASE_Y - p.y), y: p.y });
}

// ── Especies (rediseñadas / nuevas) ───────────────────────────────

function helechoScene(spec: PlantRenderSpecV2, H: number, salt: number): PlantStrokeV2[] {
  const strokes: PlantStrokeV2[] = [];
  const L = leanFn(spec.orientation.leanDeg);
  const n = Math.max(3, spec.stem.count);
  const spread = 66 * Math.min(1.15, spec.proportions.crownWidthRatio);
  const pinnaePerFrond = Math.max(2, Math.round(spec.leaves.count / n));
  const base: P = { x: BASE_X, y: BASE_Y };

  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0.5 : i / (n - 1);
    const ang = (-0.5 + u) * 2 * spread + wiggle(i, salt) * 7;
    const len = H * (0.68 + 0.32 * Math.abs(wiggle(i + 11, salt)));
    const a = rad(ang);
    const bend = spec.stem.curvature * len * 0.5 * Math.sign(ang || 1);
    const tip = L({ x: BASE_X + Math.sin(a) * len * 0.85 + bend * 0.35, y: BASE_Y - Math.cos(a) * len });
    const ctrl = L({ x: BASE_X + Math.sin(a) * len * 0.3 - bend * 0.25, y: BASE_Y - Math.cos(a) * len * 0.55 });
    strokes.push({ d: quad(base, ctrl, tip), w: 1.15 });
    for (let j = 0; j < pinnaePerFrond; j++) {
      const t = 0.3 + (0.62 * (j + 1)) / pinnaePerFrond;
      const p = qAt(base, ctrl, tip, t);
      const tan = qTan(base, ctrl, tip, t);
      const side = j % 2 === 0 ? 1 : -1;
      const size = (2.3 + spec.leaves.sizeRatio * H * 0.65) * (1 - t * 0.45);
      const end = { x: p.x - tan.y * size * side + tan.x * size * 0.4, y: p.y + tan.x * size * side + tan.y * size * 0.4 };
      strokes.push({ d: line(p, end), w: 0.85, o: 0.82 });
    }
  }
  if (spec.details.includes("fronda-enrollada")) {
    strokes.push({ d: `M${pt(BASE_X, BASE_Y)}q1 -7 .5 -10q-.4 -2.6 -2.6 -2.4q-1.8.2 -1.4 1.9q.3 1.4 1.8 1.1`, w: 1, o: 0.85 });
  }
  return strokes;
}

function monsteraScene(spec: PlantRenderSpecV2, H: number, salt: number): PlantStrokeV2[] {
  const strokes: PlantStrokeV2[] = [];
  const L = leanFn(spec.orientation.leanDeg);
  const top: P = L({ x: BASE_X + spec.stem.curvature * 6, y: BASE_Y - H });
  const ctrl: P = L({ x: BASE_X - spec.stem.curvature * 8, y: BASE_Y - H * 0.5 });
  const base: P = { x: BASE_X, y: BASE_Y };
  strokes.push({ d: quad(base, ctrl, top), w: 1.4 });
  if (spec.stem.count > 1) {
    const top2 = L({ x: BASE_X - 4 - spec.stem.curvature * 4, y: BASE_Y - H * 0.62 });
    strokes.push({ d: quad(base, L({ x: BASE_X - 5, y: BASE_Y - H * 0.3 }), top2), w: 1.15, o: 0.9 });
  }
  // Pocas hojas, grandes y protagonistas — no una hilera de hojas pequeñas.
  const nLeaves = Math.max(1, spec.leaves.count);
  const fenestrada = spec.leaves.shape === "hoja-fenestrada";
  const size = Math.max(7, spec.leaves.sizeRatio * H * 1.15);
  for (let i = 0; i < nLeaves; i++) {
    const t = 0.3 + (0.66 * i) / Math.max(1, nLeaves - 1);
    const p = qAt(base, ctrl, top, t);
    const side = i % 2 === 0 ? 1 : -1;
    const ang = rad(90 - spec.branches.angleDeg - wiggle(i, salt) * 6);
    const plen = Math.max(4, spec.branches.lengthRatio * H * (0.55 + 0.15 * Math.abs(wiggle(i + 3, salt))));
    const end: P = { x: p.x + Math.cos(ang) * plen * side, y: p.y - Math.sin(ang) * plen * 0.32 };
    strokes.push({ d: quad(p, { x: (p.x + end.x) / 2, y: Math.min(p.y, end.y) - 1.5 }, end), w: 1.05 });
    const tip: P = { x: end.x + side * size * 0.32, y: end.y - size * 0.95 };
    strokes.push({ d: heartLeaf(end, tip, size * 0.62), w: 1.25 });
    // nervadura central bien visible + un par de nervaduras secundarias.
    strokes.push({ d: line(end, tip), w: 0.75, o: 0.6 });
    for (let v = 0; v < 2; v++) {
      const vt = 0.4 + v * 0.28;
      const vp = { x: end.x + (tip.x - end.x) * vt, y: end.y + (tip.y - end.y) * vt };
      strokes.push({
        d: line(vp, { x: vp.x + side * size * 0.42, y: vp.y - size * 0.18 }),
        w: 0.55,
        o: 0.45,
      });
    }
    if (fenestrada) {
      for (let f = 0; f < 3; f++) {
        const ft = 0.3 + f * 0.22;
        const mid = { x: end.x + (tip.x - end.x) * ft, y: end.y + (tip.y - end.y) * ft };
        const fSide = f % 2 === 0 ? side : -side;
        const cut = { x: mid.x + fSide * size * 0.4, y: mid.y - size * 0.06 };
        strokes.push({ d: line(cut, { x: mid.x + fSide * size * 0.1, y: mid.y }), w: 0.85, o: 0.92 });
      }
    }
  }
  if (spec.details.includes("raiz-aerea")) {
    strokes.push({ d: `M${pt(BASE_X + 1.5, BASE_Y - H * 0.3)}q3.5 4 3 ${r2(H * 0.3 - 1)}`, w: 0.8, o: 0.6 });
  }
  return strokes;
}

function suculentaScene(spec: PlantRenderSpecV2, H: number, salt: number): PlantStrokeV2[] {
  const strokes: PlantStrokeV2[] = [];
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

function lavandaScene(spec: PlantRenderSpecV2, H: number, salt: number): PlantStrokeV2[] {
  const strokes: PlantStrokeV2[] = [];
  const L = leanFn(spec.orientation.leanDeg);
  const n = Math.max(3, spec.stem.count);
  // Más separación entre varas y menos hojas por vara: silueta refinada,
  // no amontonada.
  const spread = 34 * spec.proportions.crownWidthRatio;
  const base: P = { x: BASE_X, y: BASE_Y };
  const espigas = spec.details.includes("espigas-florales");
  const leavesPerStem = Math.max(1, Math.round(spec.leaves.count / n / 2.6));

  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0.5 : i / (n - 1);
    const ang = (-0.5 + u) * 2 * spread + wiggle(i, salt) * 5;
    const len = H * (0.78 + 0.22 * Math.abs(wiggle(i + 4, salt)));
    const a = rad(ang);
    const tip = L({ x: BASE_X + Math.sin(a) * len * 0.5, y: BASE_Y - Math.cos(a) * len });
    const ctrl = L({ x: BASE_X + Math.sin(a) * len * 0.2 + spec.stem.curvature * 4 * Math.sign(ang || 1), y: BASE_Y - len * 0.5 });
    strokes.push({ d: quad(base, ctrl, tip), w: 0.95 });
    for (let j = 0; j < leavesPerStem; j++) {
      const t = 0.18 + (0.35 * (j + 1)) / leavesPerStem;
      const p = qAt(base, ctrl, tip, t);
      const tan = qTan(base, ctrl, tip, t);
      const s = 2 + spec.leaves.sizeRatio * H * 0.7;
      strokes.push({ d: line(p, { x: p.x - tan.y * s + tan.x * 1.2, y: p.y + tan.x * s + tan.y * 1.2 }), w: 0.75, o: 0.8 });
      strokes.push({ d: line(p, { x: p.x + tan.y * s + tan.x * 1.2, y: p.y - tan.x * s + tan.y * 1.2 }), w: 0.75, o: 0.8 });
    }
    if (espigas) {
      const tan = qTan(base, ctrl, tip, 1);
      for (let k = 0; k < 2; k++) {
        const p = { x: tip.x + tan.x * (k * 2.3), y: tip.y + tan.y * (k * 2.3) };
        const s = 1.6 - k * 0.4;
        strokes.push({ d: line({ x: p.x - tan.y * s, y: p.y + tan.x * s }, { x: p.x + tan.y * s, y: p.y - tan.x * s }), w: 1.05, o: 0.9 });
      }
      strokes.push({ d: line(tip, { x: tip.x + tan.x * 6.2, y: tip.y + tan.y * 6.2 }), w: 0.8, o: 0.7 });
    }
  }
  if (spec.details.includes("base-lenosa")) {
    strokes.push({ d: `M${pt(BASE_X - 2.5, BASE_Y)}v-3.4M${pt(BASE_X + 2.5, BASE_Y)}v-3.8`, w: 1.5, o: 0.7 });
  }
  return strokes;
}

function olivoScene(spec: PlantRenderSpecV2, H: number, salt: number): PlantStrokeV2[] {
  const strokes: PlantStrokeV2[] = [];
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
    const start = qAt(base, trunkCtrl, trunkTop, 0.68 + u * 0.3);
    // Copa ancha y baja: la rama sale casi horizontal, sube un poco y luego
    // «pesa» hacia abajo — silueta redondeada y colgante, no una punta que
    // sigue subiendo (eso es el eucalipto).
    const ang = rad(24 + spec.branches.angleDeg * (0.22 + 0.3 * u) + wiggle(i, salt) * 7);
    const blen = Math.max(4, crownR * (0.62 + 0.38 * Math.abs(wiggle(i + 6, salt))));
    const crest: P = { x: start.x + Math.cos(ang) * blen * 0.6 * side, y: start.y - Math.sin(ang) * blen * 0.55 };
    const end: P = { x: crest.x + Math.cos(ang) * blen * 0.55 * side, y: crest.y + blen * 0.4 };
    const ctrl1: P = { x: (start.x + crest.x) / 2, y: Math.min(start.y, crest.y) - blen * 0.06 };
    const ctrl2: P = { x: (crest.x + end.x) / 2 + Math.cos(ang) * blen * 0.1 * side, y: crest.y + blen * 0.08 };
    strokes.push({ d: `${quad(start, ctrl1, crest)}Q${pt(ctrl2.x, ctrl2.y)} ${pt(end.x, end.y)}`, w: 1.05 });
    for (let j = 0; j <= leavesPerBranch; j++) {
      const t = j / Math.max(1, leavesPerBranch);
      const onFirst = t < 0.4;
      const lt = onFirst ? t / 0.4 : (t - 0.4) / 0.6;
      const p = onFirst ? qAt(start, ctrl1, crest, lt) : qAt(crest, ctrl2, end, lt);
      const tan = onFirst ? qTan(start, ctrl1, crest, lt) : qTan(crest, ctrl2, end, lt);
      const s = 2 + spec.leaves.sizeRatio * H * 0.75;
      const sway = 0.3;
      if (j % 2 === 0) {
        strokes.push({ d: line(p, { x: p.x - tan.y * s + tan.x * s * sway, y: p.y + tan.x * s + tan.y * s * sway }), w: 0.8, o: 0.85 });
      } else {
        strokes.push({ d: line(p, { x: p.x + tan.y * s + tan.x * s * sway, y: p.y - tan.x * s + tan.y * s * sway }), w: 0.8, o: 0.85 });
      }
    }
  }
  return strokes;
}

/** Bambú: cañas rectas y segmentadas, casi verticales, con hojas solo cerca
 *  de la punta — silueta muy distinta de cualquier especie con copa. */
function bambuScene(spec: PlantRenderSpecV2, H: number, salt: number): PlantStrokeV2[] {
  const strokes: PlantStrokeV2[] = [];
  const L = leanFn(spec.orientation.leanDeg);
  const n = Math.max(3, spec.stem.count);
  const spread = 14 * spec.proportions.crownWidthRatio;
  const leavesPerCane = Math.max(2, Math.round(spec.leaves.count / n));

  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0.5 : i / (n - 1);
    const xOff = (-0.5 + u) * 2 * spread + wiggle(i, salt) * 2.5;
    const len = H * (0.82 + 0.18 * Math.abs(wiggle(i + 2, salt)));
    const sway = spec.stem.curvature * 5 * Math.sign(xOff || 1);
    const tip = L({ x: BASE_X + xOff + sway, y: BASE_Y - len });
    const ctrl = L({ x: BASE_X + xOff * 0.6, y: BASE_Y - len * 0.5 });
    strokes.push({ d: quad({ x: BASE_X + xOff * 0.15, y: BASE_Y }, ctrl, tip), w: 1.1 });
    // nudos: marcas perpendiculares a intervalos regulares
    const nodes = Math.max(3, Math.round(4 + wiggle(i + 20, salt) * 1.5));
    for (let k = 1; k < nodes; k++) {
      const t = k / nodes;
      const p = qAt({ x: BASE_X + xOff * 0.15, y: BASE_Y }, ctrl, tip, t);
      const tan = qTan({ x: BASE_X + xOff * 0.15, y: BASE_Y }, ctrl, tip, t);
      const s = 1.3;
      strokes.push({ d: line({ x: p.x - tan.y * s, y: p.y + tan.x * s }, { x: p.x + tan.y * s, y: p.y - tan.x * s }), w: 0.8, o: 0.75 });
    }
    // hojas lanceoladas finas solo en el tercio superior
    for (let j = 0; j < leavesPerCane; j++) {
      const t = 0.72 + (0.26 * j) / Math.max(1, leavesPerCane - 1);
      const p = qAt({ x: BASE_X + xOff * 0.15, y: BASE_Y }, ctrl, tip, Math.min(1, t));
      const tan = qTan({ x: BASE_X + xOff * 0.15, y: BASE_Y }, ctrl, tip, Math.min(1, t));
      const side = j % 2 === 0 ? 1 : -1;
      const s = 2 + spec.leaves.sizeRatio * H * 0.6;
      const end = { x: p.x + tan.x * s * 1.4 - tan.y * s * side, y: p.y + tan.y * s * 1.4 + tan.x * s * side };
      strokes.push({ d: leafPath(p, end, s * 0.22), w: 0.8, o: 0.85 });
    }
  }
  if (spec.details.includes("caña-nueva")) {
    strokes.push({ d: `M${pt(BASE_X, BASE_Y)}v-6`, w: 0.9, o: 0.7 });
  }
  return strokes;
}

/** Cactus columnar: cuerpo ribeteado, sin hojas verdaderas — las «costillas»
 *  son líneas verticales dentro del contorno; brazos ocasionales curvos. */
function cactusScene(spec: PlantRenderSpecV2, H: number, salt: number): PlantStrokeV2[] {
  const strokes: PlantStrokeV2[] = [];
  const w = Math.max(5, 14 * spec.stem.thickness * 3.2);
  const top = BASE_Y - H;
  // contorno: dos líneas verticales ligeramente curvas + tapa redondeada
  strokes.push({ d: `M${pt(BASE_X - w, BASE_Y)}L${pt(BASE_X - w, top + w)}Q${pt(BASE_X - w, top)} ${pt(BASE_X, top)}`, w: 1.3 });
  strokes.push({ d: `M${pt(BASE_X + w, BASE_Y)}L${pt(BASE_X + w, top + w)}Q${pt(BASE_X + w, top)} ${pt(BASE_X, top)}`, w: 1.3 });
  // costillas internas
  const ribs = Math.max(4, Math.round(spec.leaves.count * 0.5));
  for (let i = 0; i < ribs; i++) {
    const xf = -0.85 + (1.7 * i) / Math.max(1, ribs - 1);
    const x = BASE_X + xf * w;
    strokes.push({ d: `M${pt(x, BASE_Y)}L${pt(x, top + w * 0.4)}`, w: 0.7, o: 0.55 });
  }
  // brazos ocasionales (0-2), curvos hacia arriba
  const nArms = spec.branches.count;
  for (let i = 0; i < nArms; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const startY = top + H * (0.3 + 0.2 * Math.abs(wiggle(i, salt)));
    const start: P = { x: BASE_X + side * w, y: startY };
    const out: P = { x: start.x + side * w * 1.3, y: startY - w * 0.4 };
    const armTop: P = { x: out.x, y: startY - H * 0.3 };
    strokes.push({ d: quad(start, out, armTop), w: 1.1 });
  }
  if (spec.details.includes("espinas")) {
    for (let i = 0; i < ribs; i += 2) {
      const xf = -0.85 + (1.7 * i) / Math.max(1, ribs - 1);
      const x = BASE_X + xf * w;
      const y = BASE_Y - H * 0.4 - (i % 3) * H * 0.15;
      strokes.push({ d: `M${pt(x - 1, y)}L${pt(x + 1, y - 1.6)}`, w: 0.7, o: 0.8 });
    }
  }
  if (spec.details.includes("flor-cactus")) {
    strokes.push({ d: roundLeaf({ x: BASE_X, y: top - 1 }, 2.2), w: 0.9, o: 0.75 });
  }
  return strokes;
}

/** Potos: sube apenas desde la tierra y luego cae en cascada por DEBAJO de
 *  la línea de tierra (como colgando del borde de la maceta) — la silueta
 *  más claramente «colgante» del set, no una que se arrastra a los lados. */
function potosScene(spec: PlantRenderSpecV2, H: number, salt: number): PlantStrokeV2[] {
  const strokes: PlantStrokeV2[] = [];
  const n = Math.max(2, spec.stem.count);
  const size = Math.max(3, spec.leaves.sizeRatio * H * 1.15);
  for (let i = 0; i < n; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const spread = 3 + i * 2.2 + wiggle(i, salt) * 1.4;
    const riseH = H * (0.4 + 0.18 * Math.abs(wiggle(i + 8, salt)));
    const dropH = H * (0.4 + 0.4 * spec.stem.curvature) + i * 1.6;
    const base: P = { x: BASE_X + side * 2, y: BASE_Y };
    const peakCtrl: P = { x: BASE_X + side * spread * 0.6, y: BASE_Y - riseH * 0.7 };
    const peak: P = { x: BASE_X + side * spread, y: BASE_Y - riseH };
    const dropCtrl: P = { x: peak.x + side * spread * 0.55, y: peak.y + dropH * 0.45 };
    const tip: P = { x: peak.x + side * spread * 0.35, y: peak.y + dropH };
    strokes.push({ d: `${quad(base, peakCtrl, peak)}Q${pt(dropCtrl.x, dropCtrl.y)} ${pt(tip.x, tip.y)}`, w: 1 });
    const leavesHere = Math.max(3, Math.round(spec.leaves.count / n));
    for (let j = 0; j < leavesHere; j++) {
      const t = j / Math.max(1, leavesHere - 1);
      const onRise = t < 0.28;
      const lt = onRise ? t / 0.28 : (t - 0.28) / 0.72;
      const p = onRise ? qAt(base, peakCtrl, peak, lt) : qAt(peak, dropCtrl, tip, lt);
      const tan = onRise ? qTan(base, peakCtrl, peak, lt) : qTan(peak, dropCtrl, tip, lt);
      const lSide = j % 2 === 0 ? 1 : -1;
      const leafTip: P = {
        x: p.x - tan.y * size * lSide + tan.x * size * 0.25,
        y: p.y + tan.x * size * lSide + tan.y * size * 0.25,
      };
      strokes.push({ d: leafPath(p, leafTip, size * 0.42), w: 1, o: 0.88 });
    }
  }
  if (spec.details.includes("raiz-aerea-potos")) {
    strokes.push({ d: `M${pt(BASE_X, BASE_Y - 2)}q-1 3 -3 4.5`, w: 0.7, o: 0.6 });
  }
  return strokes;
}

/** Sansevieria: pocas hojas rígidas en espada, derechas desde la base —
 *  roseta recta, no redondeada (distinta de la suculenta). */
function sansevieriaScene(spec: PlantRenderSpecV2, H: number, salt: number): PlantStrokeV2[] {
  const strokes: PlantStrokeV2[] = [];
  const n = Math.max(3, spec.leaves.count > 0 ? Math.min(7, Math.round(spec.leaves.count * 0.6)) : 3);
  const base: P = { x: BASE_X, y: BASE_Y };
  const spread = 22 * spec.proportions.crownWidthRatio;
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0.5 : i / (n - 1);
    const xOff = (-0.5 + u) * 2 * spread + wiggle(i, salt) * 2;
    const len = H * (0.75 + 0.25 * Math.abs(wiggle(i + 6, salt)));
    const tip: P = { x: BASE_X + xOff * 0.55, y: BASE_Y - len };
    const width = Math.max(1.2, spec.leaves.sizeRatio * H * 0.28);
    strokes.push({ d: leafPath(base, tip, width), w: 1.1 });
    if (spec.details.includes("borde-hoja")) {
      strokes.push({ d: line({ x: base.x, y: base.y - len * 0.2 }, { x: tip.x, y: tip.y + len * 0.05 }), w: 0.55, o: 0.4 });
    }
  }
  if (spec.details.includes("hoja-nueva-central")) {
    strokes.push({ d: leafPath(base, { x: BASE_X, y: BASE_Y - H * 0.35 }, 0.9), w: 0.9, o: 0.75 });
  }
  return strokes;
}

/** Pilea: tallo desnudo y, en la punta, un ramillete de hojas-moneda bien
 *  redondas que radian como un paraguas — pocas y grandes, no muchas hojas
 *  pequeñas repartidas por el tallo (así se lee como «moneditas» de un
 *  vistazo, no como una planta genérica). */
function pileaScene(spec: PlantRenderSpecV2, H: number, salt: number): PlantStrokeV2[] {
  const strokes: PlantStrokeV2[] = [];
  const L = leanFn(spec.orientation.leanDeg);
  const stemH = H * Math.max(0.5, spec.proportions.stemHeightRatio);
  const top: P = L({ x: BASE_X, y: BASE_Y - stemH });
  const base: P = { x: BASE_X, y: BASE_Y };
  strokes.push({ d: quad(base, L({ x: BASE_X - 2, y: BASE_Y - stemH * 0.5 }), top), w: 1.15 });
  const n = Math.max(4, Math.min(7, spec.leaves.count));
  const r = Math.max(2.8, spec.leaves.sizeRatio * H * 0.65);
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0.5 : i / (n - 1);
    const ang = rad(-95 + 190 * u + wiggle(i, salt) * 5);
    const plen = Math.max(3, spec.branches.lengthRatio * H * (0.55 + 0.1 * Math.abs(wiggle(i + 4, salt))));
    const petioleTip: P = { x: top.x + Math.cos(ang) * plen, y: top.y - Math.sin(ang) * plen * 0.85 };
    strokes.push({ d: line(top, petioleTip), w: 0.65, o: 0.78 });
    strokes.push({ d: roundLeaf(petioleTip, r * (0.85 + 0.3 * Math.abs(wiggle(i + 9, salt)))), w: 1.1 });
  }
  return strokes;
}

/** Palmera: tronco único y alto, corona de frondas radiales en la punta —
 *  silueta de «explosión» arriba, opuesta a la copa redondeada del olivo. */
function palmeraScene(spec: PlantRenderSpecV2, H: number, salt: number): PlantStrokeV2[] {
  const strokes: PlantStrokeV2[] = [];
  const L = leanFn(spec.orientation.leanDeg);
  const base: P = { x: BASE_X, y: BASE_Y };
  const crownY = BASE_Y - H;
  const trunkCtrl = L({ x: BASE_X - spec.stem.curvature * 7, y: BASE_Y - H * 0.55 });
  const crown: P = L({ x: BASE_X, y: crownY });
  strokes.push({ d: quad(base, trunkCtrl, crown), w: 1.5 });
  // Menos frondas, bien espaciadas y con menos temblor — corona limpia y
  // elegante en vez de una maraña.
  const nFronds = Math.max(5, Math.min(7, spec.branches.count));
  const flen = Math.max(6, spec.branches.lengthRatio * H * 1.05);
  for (let i = 0; i < nFronds; i++) {
    const u = nFronds === 1 ? 0.5 : i / (nFronds - 1);
    const ang = rad(-100 + 200 * u + wiggle(i, salt) * 3);
    const droop = 0.35 + 0.4 * Math.abs(Math.sin(ang));
    const ctrl: P = { x: crown.x + Math.cos(ang) * flen * 0.55, y: crown.y - Math.sin(ang) * flen * 0.55 * (1 - droop) + flen * droop * 0.12 };
    const tip: P = { x: crown.x + Math.cos(ang) * flen, y: crown.y - Math.sin(ang) * flen * (1 - droop) + flen * droop * 0.48 };
    strokes.push({ d: quad(crown, ctrl, tip), w: 1 });
    // pocos foliolos, más largos: lectura limpia en vez de estática visual
    const nLeaflets = 3;
    for (let j = 1; j <= nLeaflets; j++) {
      const t = (0.22 * j) / nLeaflets + 0.22;
      const p = qAt(crown, ctrl, tip, t);
      const tan = qTan(crown, ctrl, tip, t);
      const s = 2 + spec.leaves.sizeRatio * H * 0.4;
      strokes.push({ d: line(p, { x: p.x - tan.y * s, y: p.y + tan.x * s }), w: 0.6, o: 0.7 });
      strokes.push({ d: line(p, { x: p.x + tan.y * s, y: p.y - tan.x * s }), w: 0.6, o: 0.7 });
    }
  }
  return strokes;
}

/** Eucalipto: árbol más abierto y aireado que el olivo, hojas ovaladas
 *  pequeñas y ramas más rectas. */
function eucaliptoScene(spec: PlantRenderSpecV2, H: number, salt: number): PlantStrokeV2[] {
  const strokes: PlantStrokeV2[] = [];
  const L = leanFn(spec.orientation.leanDeg);
  const base: P = { x: BASE_X, y: BASE_Y };
  const trunkTopY = BASE_Y - H * Math.max(0.35, spec.proportions.stemHeightRatio + 0.1);
  const trunkTop: P = L({ x: BASE_X + spec.stem.curvature * 4, y: trunkTopY });
  const trunkCtrl: P = L({ x: BASE_X - spec.stem.curvature * 5, y: BASE_Y - H * 0.3 });
  strokes.push({ d: quad(base, trunkCtrl, trunkTop), w: 1.4 });
  const nB = Math.max(3, spec.branches.count);
  const crownR = H * 0.55 * spec.proportions.crownWidthRatio;
  for (let i = 0; i < nB; i++) {
    const u = i / Math.max(1, nB - 1);
    const side = i % 2 === 0 ? 1 : -1;
    const start = qAt(base, trunkCtrl, trunkTop, 0.55 + u * 0.42);
    const ang = rad(28 + spec.branches.angleDeg * (0.4 + 0.6 * u) + wiggle(i, salt) * 9);
    const blen = Math.max(4, crownR * (0.6 + 0.4 * Math.abs(wiggle(i + 6, salt))));
    const end: P = { x: start.x + Math.cos(ang) * blen * side, y: start.y - Math.sin(ang) * blen };
    strokes.push({ d: line(start, end), w: 0.95 });
    const leaves = Math.max(3, Math.round(spec.leaves.count / nB));
    for (let j = 0; j <= leaves; j++) {
      const t = 0.3 + (0.7 * j) / Math.max(1, leaves);
      const p: P = { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t };
      const s = 1.6 + spec.leaves.sizeRatio * H * 0.7;
      const lSide = j % 2 === 0 ? 1 : -1;
      const tip: P = { x: p.x + lSide * s * 0.7, y: p.y - s * 0.5 };
      strokes.push({ d: leafPath(p, tip, s * 0.32), w: 0.8, o: 0.82 });
    }
  }
  return strokes;
}

// ── Punto de entrada ─────────────────────────────────────────────

export function plantSceneV2(spec: PlantRenderSpecV2): PlantSceneV2 {
  const H = Math.max(6, spec.height * MAX_H);
  const salt = saltOf(spec);
  let strokes: PlantStrokeV2[];
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
    case "bambu":
      strokes = bambuScene(spec, H, salt);
      break;
    case "cactus":
      strokes = cactusScene(spec, H, salt);
      break;
    case "potos":
      strokes = potosScene(spec, H, salt);
      break;
    case "sansevieria":
      strokes = sansevieriaScene(spec, H, salt);
      break;
    case "pilea":
      strokes = pileaScene(spec, H, salt);
      break;
    case "palmera":
      strokes = palmeraScene(spec, H, salt);
      break;
    case "eucalipto":
      strokes = eucaliptoScene(spec, H, salt);
      break;
  }
  strokes.push(...ground());
  // Encuadre por especie: la mayoría crece solo hacia arriba desde la
  // tierra, pero el potos cae también por debajo de la línea de tierra
  // (silueta colgante) y necesita un centro de encuadre más bajo.
  let visualH: number;
  let cyOverride: number | undefined;
  if (spec.species === "suculenta") {
    visualH = Math.max(H * 0.5, 16);
  } else if (spec.species === "pilea") {
    visualH = Math.max(H * 0.85, 16);
  } else if (spec.species === "potos") {
    visualH = Math.max(H * 1.35, 18);
    cyOverride = r2(BASE_Y + H * 0.15 - 2);
  } else {
    visualH = H;
  }
  const k = Math.min(1.75, Math.max(1, 56 / (visualH + 12)));
  const cy = cyOverride ?? r2(BASE_Y - visualH / 2 - 2);
  return { strokes, frame: { k: r2(k), cx: BASE_X, cy } };
}

/** Nombre visible en español de cada especie (v2, 12 en total). */
export const SPECIES_LABEL: Record<string, string> = {
  helecho: "Helecho",
  monstera: "Monstera",
  suculenta: "Suculenta",
  lavanda: "Lavanda",
  olivo: "Olivo",
  bambu: "Bambú",
  cactus: "Cactus",
  potos: "Potos",
  sansevieria: "Sansevieria",
  pilea: "Pilea",
  palmera: "Palmera",
  eucalipto: "Eucalipto",
};
