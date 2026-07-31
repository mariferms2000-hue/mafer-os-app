/* Ilustración botánica FIJA — Fase 4B, piloto de rediseño (Monstera,
   Lavanda, Cactus). A diferencia de plant-render-v2.ts/plant-svg-v2.ts
   (procedurales: una sola fórmula sirve a las 12 especies, variada por
   seed), este motor es deliberadamente NO procedural: cada combinación
   especie+etapa se dibuja a mano, sin fórmula compartida entre especies.
   Esa es la única forma de darle a cada especie un gesto propio en vez de
   una silueta genérica — que es justo lo que hacía sentir "ícono de
   sistema" a los intentos anteriores.

   Costo consciente: no hay variación por seed dentro de una misma especie
   (todas las Monstera en "hojas" se ven iguales). A cambio, cada etapa
   tiene la riqueza de una ilustración real, no de una fórmula genérica.

   Sigue siendo SVG (ligero, nítido, sin peticiones de red) y usa los
   tokens de color reales de Mafer OS — funciona en claro/oscuro sin
   decisiones de color nuevas, salvo --color-plant-bloom (flor de lavanda,
   único tono nuevo, ver globals.css). */

import type { StageKey } from "./focus-logic";

export const ILLUSTRATED_SPECIES = ["monstera", "lavanda", "cactus"] as const;
export type IllustratedSpecies = (typeof ILLUSTRATED_SPECIES)[number];

export function isIllustratedSpecies(species: string): species is IllustratedSpecies {
  return (ILLUSTRATED_SPECIES as readonly string[]).includes(species);
}

const BASE_X = 48;
const BASE_Y = 78;
const rad = (deg: number) => (deg * Math.PI) / 180;
const r2 = (n: number) => Math.round(n * 100) / 100;
const pt = (x: number, y: number) => `${r2(x)} ${r2(y)}`;

type P = { x: number; y: number };

export type PlantShape =
  | { kind: "path"; d: string; fill: string; fillRule?: "evenodd"; opacity?: number }
  | { kind: "stroke"; d: string; stroke: string; width: number; opacity?: number }
  | { kind: "circle"; cx: number; cy: number; r: number; fill: string; opacity?: number }
  | { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number; fill: string; opacity?: number; rotateDeg?: number };

export type PlantIllustrationScene = {
  shapes: PlantShape[];
  frame: { k: number; cx: number; cy: number };
};

const INK = "var(--color-forest-deep)";
const LEAF = "var(--color-sage-deep)";
const LEAF_DEEP = "var(--color-forest)";
const SOIL = "var(--color-sand-deep)";
const BLOOM = "var(--color-plant-bloom)";

function rot(p: P, c: P, deg: number): P {
  const a = rad(deg);
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  return { x: c.x + dx * Math.cos(a) - dy * Math.sin(a), y: c.y + dx * Math.sin(a) + dy * Math.cos(a) };
}

// ── Hoja ovate/acorazonada ───────────────────────────────────────
type LeafOpts = {
  asym?: number;
  wideAt?: number;
  cordate?: boolean;
  holes?: { t: number; side?: 1 | -1; size?: number }[];
  shade?: boolean;
  vein?: boolean;
  secondaryVeins?: number[];
  secondarySide?: 1 | -1;
};

function leafBlade(base: P, tip: P, width: number, fill: string, opts: LeafOpts = {}): PlantShape[] {
  const dx = tip.x - base.x;
  const dy = tip.y - base.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -dy / len;
  const ny = dx / len;
  const asym = opts.asym ?? 0.2;
  const cordateAmt = opts.cordate ? 0.11 : 0;
  const bStart: P = { x: base.x + ux * len * cordateAmt, y: base.y + uy * len * cordateAmt };
  const bl: P = { x: base.x + nx * width * 0.24, y: base.y + ny * width * 0.24 };
  const br: P = { x: base.x - nx * width * 0.2, y: base.y - ny * width * 0.2 };
  const wideT = opts.wideAt ?? 0.44;
  const wl: P = { x: base.x + ux * len * wideT + nx * width * (1 + asym), y: base.y + uy * len * wideT + ny * width * (1 + asym) };
  const wr: P = {
    x: base.x + ux * len * (wideT - 0.03) - nx * width * (1 - asym * 0.5),
    y: base.y + uy * len * (wideT - 0.03) - ny * width * (1 - asym * 0.5),
  };
  let d: string;
  if (opts.cordate) {
    d = `M${pt(bl.x, bl.y)}Q${pt(wl.x, wl.y)} ${pt(tip.x, tip.y)}Q${pt(wr.x, wr.y)} ${pt(br.x, br.y)}Q${pt(bStart.x, bStart.y)} ${pt(bl.x, bl.y)}Z`;
  } else {
    d = `M${pt(base.x, base.y)}Q${pt(wl.x, wl.y)} ${pt(tip.x, tip.y)}Q${pt(wr.x, wr.y)} ${pt(base.x, base.y)}Z`;
  }
  if (opts.holes) {
    for (const h of opts.holes) {
      const p: P = { x: base.x + dx * h.t, y: base.y + dy * h.t };
      const side = h.side ?? 1;
      const r = h.size ?? width * 0.28;
      const hc: P = { x: p.x + nx * side * width * 0.4, y: p.y + ny * side * width * 0.4 };
      const hTop: P = { x: hc.x + ux * r, y: hc.y + uy * r };
      const hBot: P = { x: hc.x - ux * r, y: hc.y - uy * r };
      const cA: P = { x: hc.x + nx * r * 0.7, y: hc.y + ny * r * 0.7 };
      const cB: P = { x: hc.x - nx * r * 0.7, y: hc.y - ny * r * 0.7 };
      d += `M${pt(hTop.x, hTop.y)}Q${pt(cA.x, cA.y)} ${pt(hBot.x, hBot.y)}Q${pt(cB.x, cB.y)} ${pt(hTop.x, hTop.y)}Z`;
    }
  }
  const shapes: PlantShape[] = [{ kind: "path", d, fill, fillRule: "evenodd" }];
  if (opts.shade !== false) {
    const shadeTip: P = { x: base.x + dx * 0.42, y: base.y + dy * 0.42 };
    const sl: P = { x: base.x + ux * len * 0.2 + nx * width * 0.7, y: base.y + uy * len * 0.2 + ny * width * 0.7 };
    const sd = `M${pt(bStart.x, bStart.y)}Q${pt(sl.x, sl.y)} ${pt(shadeTip.x, shadeTip.y)}Q${pt(base.x + ux * len * 0.14, base.y + uy * len * 0.14)} ${pt(bStart.x, bStart.y)}Z`;
    shapes.push({ kind: "path", d: sd, fill: LEAF_DEEP, opacity: 0.3 });
  }
  shapes.push({ kind: "stroke", d, stroke: INK, width: 0.48, opacity: 1 });
  if (opts.vein !== false) {
    const veinBase = opts.cordate ? bStart : base;
    const veinTip: P = opts.cordate ? { x: bStart.x + (tip.x - bStart.x) * 0.94, y: bStart.y + (tip.y - bStart.y) * 0.94 } : tip;
    const veinCtrl: P = { x: (veinBase.x + veinTip.x) / 2 + nx * 0.6, y: (veinBase.y + veinTip.y) / 2 + ny * 0.6 };
    shapes.push({
      kind: "stroke",
      d: `M${pt(veinBase.x, veinBase.y)}Q${pt(veinCtrl.x, veinCtrl.y)} ${pt(veinTip.x, veinTip.y)}`,
      stroke: INK,
      width: 0.38,
      opacity: 0.42,
    });
    if (opts.secondaryVeins) {
      for (const t of opts.secondaryVeins) {
        const p: P = { x: veinBase.x + (veinTip.x - veinBase.x) * t, y: veinBase.y + (veinTip.y - veinBase.y) * t };
        const side = opts.secondarySide ?? 1;
        const end: P = { x: p.x + nx * side * width * 0.5, y: p.y + ny * side * width * 0.5 };
        shapes.push({ kind: "stroke", d: `M${pt(p.x, p.y)}L${pt(end.x, end.y)}`, stroke: INK, width: 0.3, opacity: 0.32 });
      }
    }
  }
  return shapes;
}

function petiole(from: P, to: P, w = 0.85): PlantShape[] {
  const c1: P = { x: from.x + (to.x - from.x) * 0.35, y: from.y + (to.y - from.y) * 0.15 };
  const c2: P = { x: from.x + (to.x - from.x) * 0.7, y: from.y + (to.y - from.y) * 0.75 };
  return [{ kind: "stroke", d: `M${pt(from.x, from.y)}C${pt(c1.x, c1.y)} ${pt(c2.x, c2.y)} ${pt(to.x, to.y)}`, stroke: INK, width: w }];
}

function stem(base: P, tip: P, sway = 2, w = 1): PlantShape[] {
  const c1: P = { x: base.x + sway * 0.4, y: base.y - (base.y - tip.y) * 0.35 };
  const c2: P = { x: tip.x - sway * 0.5, y: tip.y + (base.y - tip.y) * 0.3 };
  return [{ kind: "stroke", d: `M${pt(base.x, base.y)}C${pt(c1.x, c1.y)} ${pt(c2.x, c2.y)} ${pt(tip.x, tip.y)}`, stroke: INK, width: w }];
}

function seed(cx: number, cy: number, rw: number, rh: number, angle: number): PlantShape[] {
  const c: P = { x: cx, y: cy };
  const top = rot({ x: cx, y: cy - rh }, c, angle);
  const rMid = rot({ x: cx + rw * 1.08, y: cy - rh * 0.05 }, c, angle);
  const bot = rot({ x: cx + rw * 0.15, y: cy + rh * 0.98 }, c, angle);
  const lMid = rot({ x: cx - rw * 0.98, y: cy + rh * 0.2 }, c, angle);
  const cR1 = rot({ x: cx + rw * 1.15, y: cy - rh * 0.6 }, c, angle);
  const cR2 = rot({ x: cx + rw * 1.1, y: cy + rh * 0.55 }, c, angle);
  const cB = rot({ x: cx - rw * 0.3, y: cy + rh * 1.15 }, c, angle);
  const cL2 = rot({ x: cx - rw * 0.85, y: cy - rh * 0.55 }, c, angle);
  const d = `M${pt(top.x, top.y)}Q${pt(cR1.x, cR1.y)} ${pt(rMid.x, rMid.y)}Q${pt(cR2.x, cR2.y)} ${pt(bot.x, bot.y)}Q${pt(cB.x, cB.y)} ${pt(lMid.x, lMid.y)}Q${pt(cL2.x, cL2.y)} ${pt(top.x, top.y)}Z`;
  const shapes: PlantShape[] = [{ kind: "path", d, fill: SOIL }];
  const spot = rot({ x: cx + rw * 0.12, y: cy - rh * 0.08 }, c, angle);
  shapes.push({ kind: "ellipse", cx: spot.x, cy: spot.y, rx: rw * 0.3, ry: rh * 0.2, fill: INK, opacity: 0.16, rotateDeg: angle });
  shapes.push({ kind: "stroke", d, stroke: INK, width: 0.42 });
  const hl = rot({ x: cx - rw * 0.3, y: cy - rh * 0.5 }, c, angle);
  const hlEnd = rot({ x: cx + rw * 0.15, y: cy - rh * 0.05 }, c, angle);
  shapes.push({ kind: "stroke", d: `M${pt(hl.x, hl.y)}Q${pt((hl.x + hlEnd.x) / 2, hl.y)} ${pt(hlEnd.x, hlEnd.y)}`, stroke: INK, width: 0.32, opacity: 0.28 });
  return shapes;
}

function soilMound(cx: number, w: number, h: number, rich: boolean): PlantShape[] {
  const d = `M${pt(cx - w, BASE_Y)}Q${pt(cx - w * 0.5, BASE_Y - h)} ${pt(cx, BASE_Y - h * 0.85)}Q${pt(cx + w * 0.5, BASE_Y - h)} ${pt(cx + w, BASE_Y)}Z`;
  const shapes: PlantShape[] = [{ kind: "ellipse", cx, cy: BASE_Y + 0.4, rx: w * 1.15, ry: h * 0.4, fill: INK, opacity: 0.1 }];
  shapes.push({ kind: "path", d, fill: SOIL, opacity: 0.4 });
  const specks = rich ? 5 : 3;
  for (let i = 0; i < specks; i++) {
    const t = i / (specks - 1 || 1);
    const x = cx - w * 0.75 + w * 1.5 * t;
    const y = BASE_Y - 0.6 - Math.sin(t * Math.PI) * h * 0.35;
    shapes.push({ kind: "circle", cx: x, cy: y, r: 0.35 + (i % 2) * 0.15, fill: INK, opacity: 0.28 });
  }
  return shapes;
}

function roots(cx: number, cy: number, count: number, maxLen: number, spread: number): PlantShape[] {
  const shapes: PlantShape[] = [];
  for (let i = 0; i < count; i++) {
    const u = count === 1 ? 0.5 : i / (count - 1);
    const dxr = (-0.5 + u) * spread * 2;
    const len = maxLen * (0.55 + 0.45 * Math.abs(Math.sin(i * 2.1 + 1)));
    const ctrl: P = { x: cx + dxr * 0.6, y: cy + len * 0.5 };
    const end: P = { x: cx + dxr * 1.2, y: cy + len };
    shapes.push({ kind: "stroke", d: `M${pt(cx, cy)}Q${pt(ctrl.x, ctrl.y)} ${pt(end.x, end.y)}`, stroke: INK, width: 0.32, opacity: 0.38 });
    if (i % 2 === 0) {
      const forkT = 0.55 + (i % 3) * 0.1;
      const fp: P = {
        x: cx + (ctrl.x - cx) * 2 * forkT * (1 - forkT) + (end.x - ctrl.x) * forkT * forkT + (ctrl.x - cx) * forkT * forkT,
        y: cy + (end.y - cy) * forkT,
      };
      const forkEnd: P = { x: fp.x + dxr * 0.5, y: fp.y + len * 0.28 };
      shapes.push({
        kind: "stroke",
        d: `M${pt(fp.x, fp.y)}Q${pt((fp.x + forkEnd.x) / 2, fp.y + len * 0.1)} ${pt(forkEnd.x, forkEnd.y)}`,
        stroke: INK,
        width: 0.24,
        opacity: 0.28,
      });
    }
  }
  return shapes;
}

// ══════════════════ MONSTERA ══════════════════

function monsteraLeaf(crown: P, angDeg: number, len: number, width: number, fill: string, opts: LeafOpts & { pw?: number }): PlantShape[] {
  const a = rad(angDeg);
  const base: P = { x: crown.x + Math.sin(a) * len * 0.22, y: crown.y - Math.cos(a) * len * 0.22 };
  const tip: P = { x: crown.x + Math.sin(a) * len, y: crown.y - Math.cos(a) * len };
  return [...petiole(crown, base, opts.pw ?? 0.8), ...leafBlade(base, tip, width, fill, opts)];
}

function monstera(stage: StageKey): PlantIllustrationScene {
  const base: P = { x: BASE_X, y: BASE_Y };
  if (stage === "semilla") {
    return { shapes: [...soilMound(48, 5.5, 1.6, true), ...seed(48, 74.6, 3.2, 2.3, -10)], frame: { k: 2.05, cx: 48, cy: 73.2 } };
  }
  if (stage === "brote") {
    const crown: P = { x: 47.3, y: 63.5 };
    const shapes: PlantShape[] = [
      ...soilMound(48, 6, 1.8, true),
      ...roots(48, 78, 3, 3.5, 2.6),
      ...stem(base, crown, 2.6, 0.95),
      ...monsteraLeaf(crown, -34, 7.2, 2.5, LEAF, { asym: 0.35, wideAt: 0.38 }),
      ...monsteraLeaf(crown, 22, 6.5, 2.2, LEAF, { asym: -0.1, wideAt: 0.5 }),
    ];
    return { shapes, frame: { k: 1.9, cx: 48, cy: 66 } };
  }
  if (stage === "hojas") {
    const crown: P = { x: 47, y: 56 };
    const shapes: PlantShape[] = [
      ...soilMound(48, 7, 2, true),
      ...roots(48, 78, 4, 5.5, 3.4),
      ...stem(base, crown, 3, 1.05),
      ...monsteraLeaf(crown, -38, 11.5, 5, LEAF, { asym: 0.22, cordate: true }),
      ...monsteraLeaf(crown, 18, 12.5, 5.2, LEAF_DEEP, { asym: -0.15, cordate: true, secondaryVeins: [0.5], secondarySide: -1 }),
    ];
    return { shapes, frame: { k: 1.3, cx: 48, cy: 56 } };
  }
  if (stage === "planta-joven") {
    const crown: P = { x: 47, y: 52 };
    const shapes: PlantShape[] = [
      ...soilMound(48, 7.5, 2.2, true),
      ...roots(48, 78, 4, 6.5, 4),
      ...stem(base, crown, 3.4, 1.1),
      ...monsteraLeaf(crown, -58, 10, 4.6, LEAF_DEEP, { asym: 0.2, cordate: true, wideAt: 0.4 }),
      ...monsteraLeaf(crown, 48, 11, 5, LEAF, { asym: -0.18, cordate: true, holes: [{ t: 0.55, side: 1 }] }),
      ...monsteraLeaf(crown, -14, 14.5, 6.4, LEAF, { asym: 0.2, cordate: true, holes: [{ t: 0.5, side: -1 }], secondaryVeins: [0.4, 0.6], secondarySide: -1 }),
    ];
    return { shapes, frame: { k: 1.08, cx: 48, cy: 49 } };
  }
  const crown: P = { x: 47.5, y: 48 };
  const shapes: PlantShape[] = [
    ...soilMound(48, 8.5, 2.5, true),
    ...roots(48, 78, 5, 7.5, 5),
    ...stem(base, crown, 4, 1.2),
    ...monsteraLeaf(crown, -72, 12.5, 5.2, LEAF_DEEP, { asym: 0.18, cordate: true, wideAt: 0.4, shade: false }),
    ...monsteraLeaf(crown, 62, 13, 5.6, LEAF_DEEP, { asym: -0.2, cordate: true, holes: [{ t: 0.5, side: 1 }] }),
    ...monsteraLeaf(crown, -30, 17, 7, LEAF, { asym: 0.2, cordate: true, holes: [{ t: 0.42, side: -1 }, { t: 0.65, side: -1 }], secondaryVeins: [0.35, 0.55], secondarySide: -1 }),
    ...monsteraLeaf(crown, 20, 18.5, 7.6, LEAF, { asym: -0.18, cordate: true, holes: [{ t: 0.4, side: 1 }, { t: 0.62, side: 1 }], secondaryVeins: [0.4, 0.6], secondarySide: 1 }),
    ...monsteraLeaf({ x: 47, y: 55 }, -4, 15, 6.6, LEAF, { asym: 0.05, cordate: true, wideAt: 0.48, holes: [{ t: 0.5, side: 1 }], secondaryVeins: [0.45], secondarySide: 1, pw: 1 }),
  ];
  return { shapes, frame: { k: 0.86, cx: 48, cy: 42 } };
}

// ══════════════════ LAVANDA ══════════════════

function lavandaLeaf(base: P, angDeg: number, len: number, width: number, curve = 5): PlantShape[] {
  const a = rad(angDeg);
  const straightTip: P = { x: base.x + Math.sin(a) * len, y: base.y - Math.cos(a) * len };
  const side = angDeg >= 0 ? 1 : -1;
  const perp = { x: Math.cos(a) * side, y: Math.sin(a) * side };
  const tip: P = { x: straightTip.x + perp.x * curve * 0.32, y: straightTip.y + perp.y * curve * 0.32 };
  return leafBlade(base, tip, width, LEAF, { asym: 0.07, vein: false, shade: false });
}

function bloomSpike(base: P, angDeg: number, len: number, curve: number, rich: boolean): PlantShape[] {
  const a = rad(angDeg);
  const tip: P = { x: base.x + Math.sin(a) * len + curve, y: base.y - Math.cos(a) * len };
  const ctrl: P = { x: base.x + Math.sin(a) * len * 0.5 + curve * 0.4, y: base.y - Math.cos(a) * len * 0.5 };
  const shapes: PlantShape[] = [
    { kind: "stroke", d: `M${pt(base.x, base.y)}Q${pt(ctrl.x, ctrl.y)} ${pt(tip.x, tip.y)}`, stroke: INK, width: 0.42, opacity: 0.72 },
  ];
  const nBuds = rich ? 7 : 5;
  for (let i = 0; i < nBuds; i++) {
    const t = 0.5 + (i / nBuds) * 0.46;
    const u = 1 - t;
    const p: P = { x: u * u * base.x + 2 * u * t * ctrl.x + t * t * tip.x, y: u * u * base.y + 2 * u * t * ctrl.y + t * t * tip.y };
    const budR = 0.92 - (i / nBuds) * 0.42;
    shapes.push({ kind: "ellipse", cx: p.x, cy: p.y, rx: budR, ry: budR * 0.75, fill: BLOOM, opacity: 0.95 - i * 0.05, rotateDeg: angDeg * 0.5 });
  }
  return shapes;
}

function lavanda(stage: StageKey): PlantIllustrationScene {
  const base: P = { x: BASE_X, y: BASE_Y };
  if (stage === "semilla") {
    const shapes: PlantShape[] = [
      ...soilMound(48, 5, 1.4, true),
      ...seed(45.6, 75.3, 1.25, 0.82, 25),
      ...seed(50.1, 75.6, 1.15, 0.78, -35),
      ...seed(47.7, 74.5, 1.0, 0.68, 65),
    ];
    return { shapes, frame: { k: 2.15, cx: 48, cy: 74 } };
  }
  if (stage === "brote") {
    const shapes: PlantShape[] = [
      ...soilMound(48, 5.5, 1.6, true),
      ...roots(48, 78, 3, 3.5, 2.3),
      ...stem(base, { x: 47.4, y: 62 }, 1.8, 0.85),
      ...lavandaLeaf({ x: 47.1, y: 63.5 }, -18, 6.5, 0.68, 3.5),
      ...lavandaLeaf({ x: 47.9, y: 62.5 }, 15, 7, 0.62, 3),
    ];
    return { shapes, frame: { k: 1.88, cx: 48, cy: 66 } };
  }
  if (stage === "hojas") {
    const shapes: PlantShape[] = [...soilMound(48, 6.5, 1.9, true), ...roots(48, 78, 4, 5.5, 3.2)];
    const angles = [-32, -19, -6, 6, 19, 32];
    for (const a of angles) shapes.push(...lavandaLeaf(base, a + a * 0.15, 15.5 + Math.abs(a) * 0.16, 0.58, 5.5));
    return { shapes, frame: { k: 1.3, cx: 48, cy: 59 } };
  }
  if (stage === "planta-joven") {
    const shapes: PlantShape[] = [...soilMound(48, 7.5, 2.1, true), ...roots(48, 78, 5, 6.5, 4)];
    const angles = [-40, -27, -15, -3, 9, 21, 33];
    for (const a of angles) shapes.push(...lavandaLeaf(base, a, 19.5 + Math.abs(a) * 0.11, 0.54, 6.5));
    shapes.push(...bloomSpike({ x: 46.3, y: 63.5 }, -10, 15, -1.2, true));
    shapes.push(...bloomSpike({ x: 49.6, y: 63.5 }, 8, 16.5, 1, true));
    shapes.push(...bloomSpike({ x: 48, y: 64 }, -1, 17.5, 0.3, true));
    return { shapes, frame: { k: 1, cx: 48, cy: 49 } };
  }
  const shapes: PlantShape[] = [...soilMound(48, 9, 2.5, true), ...roots(48, 78, 6, 7.5, 5)];
  const angles = [-48, -36, -24, -12, 0, 12, 24, 36, 48];
  for (const a of angles) shapes.push(...lavandaLeaf(base, a, 21 + Math.abs(a) * 0.09, 0.5, 7));
  const spikes: [number, number, number][] = [
    [-26, 25, -2.5],
    [-15, 28.5, -1],
    [-3, 30, 0.5],
    [9, 28, 1.6],
    [21, 25, 2.4],
    [-36, 21, -3],
    [32, 20.5, 2.8],
  ];
  for (const [a, len, curve] of spikes) shapes.push(...bloomSpike({ x: 48 + a * 0.05, y: 63 }, a, len, curve, true));
  return { shapes, frame: { k: 0.82, cx: 48, cy: 45 } };
}

// ══════════════════ CACTUS ══════════════════

function cactusBody(cx: number, baseY: number, topY: number, wMid: number): PlantShape[] {
  const h = baseY - topY;
  const wTop = wMid * 0.72;
  const wBase = wMid * 0.9;
  const waistY = baseY - h * 0.62;
  const midY = baseY - h * 0.3;
  const dL = `M${pt(cx - wBase, baseY)}C${pt(cx - wMid * 1.05, baseY - h * 0.18)} ${pt(cx - wMid * 1.1, midY)} ${pt(cx - wMid * 0.95, waistY)}C${pt(cx - wMid * 0.85, waistY - h * 0.14)} ${pt(cx - wTop * 1.05, topY + h * 0.2)} ${pt(cx - wTop, topY + wTop * 0.55)}Q${pt(cx - wTop, topY)} ${pt(cx, topY)}`;
  const dR = `Q${pt(cx + wTop, topY)} ${pt(cx + wTop, topY + wTop * 0.55)}C${pt(cx + wTop * 1.05, topY + h * 0.2)} ${pt(cx + wMid * 0.85, waistY - h * 0.14)} ${pt(cx + wMid * 0.95, waistY)}C${pt(cx + wMid * 1.1, midY)} ${pt(cx + wMid * 1.05, baseY - h * 0.18)} ${pt(cx + wBase, baseY)}`;
  const d = dL + dR + "Z";
  const shapes: PlantShape[] = [{ kind: "path", d, fill: LEAF }];
  shapes.push({
    kind: "path",
    d: `M${pt(cx + wTop * 0.1, topY + 1)}C${pt(cx + wMid * 0.4, midY)} ${pt(cx + wMid * 0.38, waistY)} ${pt(cx + wMid * 0.5, baseY - 1)}L${pt(cx + wBase, baseY)}C${pt(cx + wMid * 1.05, baseY - h * 0.18)} ${pt(cx + wMid * 1.08, midY)} ${pt(cx + wMid * 0.93, waistY)}C${pt(cx + wMid * 0.83, waistY - h * 0.14)} ${pt(cx + wTop * 1.03, topY + h * 0.2)} ${pt(cx + wTop * 0.95, topY + wTop * 0.55)}Z`,
    fill: LEAF_DEEP,
    opacity: 0.25,
  });
  shapes.push({ kind: "stroke", d, stroke: INK, width: 0.48 });
  const ribs = Math.max(5, Math.round(h / 4.5));
  for (let i = 1; i < ribs; i++) {
    const xf = -0.68 + (1.36 * i) / ribs;
    let d2 = "";
    const steps = 5;
    for (let s2 = 0; s2 <= steps; s2++) {
      const t = s2 / steps;
      const y = baseY - h * t * 0.94;
      const taper = 1 - t * 0.28;
      const wobble = Math.sin(t * 5 + i * 1.3) * 0.22;
      const x = cx + xf * wMid * taper + wobble;
      d2 += (s2 === 0 ? "M" : "L") + pt(x, y);
    }
    shapes.push({ kind: "stroke", d: d2, stroke: INK, width: 0.34, opacity: 0.42 });
    const nAreoles = Math.round(h / 10);
    for (let a = 1; a <= nAreoles; a++) {
      const t = a / (nAreoles + 1);
      const y = baseY - h * t * 0.9;
      const x = cx + xf * wMid * (1 - t * 0.28);
      shapes.push({ kind: "circle", cx: x, cy: y, r: 0.26, fill: INK, opacity: 0.48 });
      shapes.push({ kind: "circle", cx: x + 0.5, cy: y, r: 0.2, fill: INK, opacity: 0.36 });
    }
  }
  return shapes;
}

function cactusArm(cx: number, y0: number, dir: 1 | -1, len: number, w: number): PlantShape[] {
  const x0 = cx + dir * w * 0.65;
  const out: P = { x: x0 + dir * len * 0.5, y: y0 - len * 0.3 };
  const up: P = { x: x0 + dir * len * 0.42, y: y0 - len * 0.95 };
  const w0 = w * 0.95;
  const w1 = w * 0.55;
  const t0: P = { x: x0, y: y0 };
  const dx1 = out.x - x0;
  const dy1 = out.y - y0;
  const n1 = Math.hypot(dx1, dy1) || 1;
  const perp1 = { x: -dy1 / n1, y: dx1 / n1 };
  const left0: P = { x: t0.x + perp1.x * w0 * 0.5, y: t0.y + perp1.y * w0 * 0.5 };
  const right0: P = { x: t0.x - perp1.x * w0 * 0.5, y: t0.y - perp1.y * w0 * 0.5 };
  const dx2 = up.x - out.x;
  const dy2 = up.y - out.y;
  const n2 = Math.hypot(dx2, dy2) || 1;
  const perp2 = { x: -dy2 / n2, y: dx2 / n2 };
  const leftTip: P = { x: up.x + perp2.x * w1 * 0.5, y: up.y + perp2.y * w1 * 0.5 };
  const rightTip: P = { x: up.x - perp2.x * w1 * 0.5, y: up.y - perp2.y * w1 * 0.5 };
  const d = `M${pt(left0.x, left0.y)}Q${pt(out.x + perp1.x * w0 * 0.4, out.y + perp1.y * w0 * 0.4)} ${pt(leftTip.x, leftTip.y)}Q${pt(up.x, up.y - w1 * 0.4)} ${pt(rightTip.x, rightTip.y)}Q${pt(out.x - perp1.x * w0 * 0.4, out.y - perp1.y * w0 * 0.4)} ${pt(right0.x, right0.y)}Z`;
  const shapes: PlantShape[] = [{ kind: "path", d, fill: LEAF }];
  shapes.push({ kind: "stroke", d, stroke: INK, width: 0.42 });
  shapes.push({ kind: "circle", cx: out.x, cy: out.y, r: 0.22, fill: INK, opacity: 0.45 });
  shapes.push({ kind: "stroke", d: `M${pt(t0.x, t0.y)}Q${pt(out.x, out.y)} ${pt(up.x, up.y)}`, stroke: INK, width: 0.28, opacity: 0.3 });
  return shapes;
}

function cactus(stage: StageKey): PlantIllustrationScene {
  if (stage === "semilla") {
    return { shapes: [...soilMound(48, 5.5, 1.4, true), ...seed(48, 75.5, 1.3, 1.1, 15)], frame: { k: 2.15, cx: 48, cy: 74.5 } };
  }
  if (stage === "brote") {
    const shapes: PlantShape[] = [
      ...soilMound(48, 5.5, 1.5, true),
      ...roots(48, 78, 3, 3, 2),
      ...cactusBody(48, 78, 71.5, 2),
      { kind: "circle", cx: 46.1, cy: 73.9, r: 0.28, fill: INK, opacity: 0.45 },
      { kind: "circle", cx: 49.9, cy: 74.6, r: 0.28, fill: INK, opacity: 0.45 },
    ];
    return { shapes, frame: { k: 1.9, cx: 48, cy: 74.7 } };
  }
  if (stage === "hojas") {
    const shapes: PlantShape[] = [...soilMound(48, 6, 1.7, true), ...roots(48, 78, 4, 5, 2.8), ...cactusBody(48, 78, 59.5, 3.4)];
    return { shapes, frame: { k: 1.42, cx: 48, cy: 65.5 } };
  }
  if (stage === "planta-joven") {
    const shapes: PlantShape[] = [
      ...soilMound(48, 7, 2, true),
      ...roots(48, 78, 4, 6, 3.3),
      ...cactusBody(48, 78, 42, 4.1),
      ...cactusArm(48, 61, 1, 15, 1.9),
    ];
    return { shapes, frame: { k: 1.08, cx: 48, cy: 51 } };
  }
  const shapes: PlantShape[] = [
    ...soilMound(48, 8, 2.3, true),
    ...roots(48, 78, 5, 6.5, 4),
    ...cactusBody(48, 78, 26, 4.8),
    ...cactusArm(48, 55, 1, 20, 2.2),
    ...cactusArm(48, 46, -1, 16, 1.9),
  ];
  return { shapes, frame: { k: 0.87, cx: 48, cy: 42 } };
}

export function illustratedPlantScene(species: IllustratedSpecies, stage: StageKey): PlantIllustrationScene {
  if (species === "monstera") return monstera(stage);
  if (species === "lavanda") return lavanda(stage);
  return cactus(stage);
}
