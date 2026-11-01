"use client";

/* Laboratorio del jardín · Ronda 3 — A2 (Luz de invernadero) y tres propuestas de iPhone.

   La arquitectura y la luz son SVG vectorial (nítido a cualquier tamaño); las
   plantas son las láminas actuales, siempre la versión clara, integradas con
   sombra de contacto, sombra proyectada y un sombreado enmascarado con su propia
   silueta. Todo vive en memoria: no lee ni escribe la base. */

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Image from "next/image";
import { Moon, Sun, Monitor, Smartphone } from "lucide-react";
import type { StageKey } from "@/lib/focus-logic";
import { PLANT_ASSET_DIMS, plantAssetPath } from "@/lib/plant-assets";
import { SPECIES_LABEL } from "@/lib/plant-svg-v2";
import { SPECIES_ORDER, SPECIES_SCALE, STAGE_OPTIONS, type Species } from "../lab-data";
import { BASE_X, BOTTOM_PAD, PLANT_PAD, ROOT_SPAN } from "../asset-bounds";
import {
  DESKTOP,
  LATIN,
  M1,
  M3_COLLECTION,
  M3_HERO,
  PHONE_VARIANTS,
  cqhPerCm,
  type Bench,
  type Layout,
  type Material,
  type PhoneVariant,
  type Slot,
  type Support,
} from "./atelier-data";
import s from "./atelier.module.css";

const H = 1000;
const v = (name: string) => `var(--${name})`;
const fill = (name: string): CSSProperties => ({ fill: v(name) });
const stop = (name: string, opacity?: number): CSSProperties => ({ stopColor: v(name), stopOpacity: opacity });
const useUid = () => useId().replace(/[^a-zA-Z0-9]/g, "");
const src = (sp: Species, st: StageKey) => plantAssetPath(sp, st, "light", "large");

/* ───────────────────────────── piezas ───────────────────────────── */

function Lamina({ species, stage }: { species: Species; stage: StageKey }) {
  const d = PLANT_ASSET_DIMS[species].large;
  const url = src(species, stage);
  return (
    <>
      <Image src={url} width={d.w} height={d.h} alt="" unoptimized draggable={false} className={s.leaf} />
      {/* Sombreado con la silueta de la propia lámina: base más oscura, sin halo. */}
      <span className={s.leafShade} style={{ maskImage: `url(${url})`, WebkitMaskImage: `url(${url})` }} aria-hidden />
    </>
  );
}

const POT_SHAPE = {
  cuenco: { taper: 13, round: 16 },
  media: { taper: 8, round: 5 },
  alta: { taper: 6, round: 4 },
} as const;
const RIM = 11; // semieje vertical de la boca, en unidades de un ancho de 100

/** Maceta en dos capas: la boca (detrás de la planta) y el cuerpo (delante). */
function Pot({ w, h, shape, material, layer }: { w: number; h: number; shape: keyof typeof POT_SHAPE; material: Material; layer: "back" | "front" }) {
  const id = useUid();
  const vh = (100 * h) / w;
  const { taper, round } = POT_SHAPE[shape];
  const style: CSSProperties = { width: `${w}cqh`, height: `${h}cqh` };
  const m = (t: string) => `m-${material}-${t}`;
  if (layer === "back") {
    return (
      <svg className={s.pot} style={style} viewBox={`0 0 100 ${vh}`} preserveAspectRatio="none" aria-hidden>
        <defs>
          <radialGradient id={`${id}s`} cx="50%" cy="35%" r="65%">
            <stop offset="0" style={stop("soil-hi")} />
            <stop offset="1" style={stop("soil-lo")} />
          </radialGradient>
        </defs>
        <ellipse cx="50" cy={RIM} rx="50" ry={RIM} style={fill(m("mid"))} />
        <ellipse cx="50" cy={RIM + 1} rx="45.5" ry={RIM * 0.8} fill={`url(#${id}s)`} />
      </svg>
    );
  }
  const body = `M0 ${RIM} A50 ${RIM} 0 0 0 100 ${RIM} L${100 - taper} ${vh - round} Q${100 - taper} ${vh} ${100 - taper - round} ${vh} L${taper + round} ${vh} Q${taper} ${vh} ${taper} ${vh - round} Z`;
  return (
    <svg className={s.pot} style={style} viewBox={`0 0 100 ${vh}`} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={`${id}b`} x1="0" x2="1">
          <stop offset="0" style={stop(m("lo"))} />
          <stop offset="0.22" style={stop(m("mid"))} />
          <stop offset="0.4" style={stop(m("hi"))} />
          <stop offset="0.66" style={stop(m("mid"))} />
          <stop offset="1" style={stop(m("lo"))} />
        </linearGradient>
        <linearGradient id={`${id}o`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0" />
          <stop offset="0.55" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.22" />
        </linearGradient>
      </defs>
      <path d={body} fill={`url(#${id}b)`} />
      <path d={body} fill={`url(#${id}o)`} />
      <path d={`M0.8 ${RIM} A49.2 ${RIM} 0 0 0 99.2 ${RIM}`} fill="none" style={{ stroke: v(m("hi")) }} strokeWidth="2.2" />
    </svg>
  );
}

function SupportEl({ support, k }: { support: Support; k: number }) {
  const id = useUid();
  if (support.kind === "plinth") {
    const w = support.w * k;
    const h = support.cm * k;
    const vh = (100 * h) / w;
    return (
      <svg className={s.support} style={{ width: `${w}cqh`, height: `${h}cqh` }} viewBox={`0 0 100 ${vh}`} preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id={`${id}p`} x1="0" x2="1">
            <stop offset="0" style={stop("plinth-lo")} />
            <stop offset="0.35" style={stop("plinth-hi")} />
            <stop offset="0.7" style={stop("plinth-mid")} />
            <stop offset="1" style={stop("plinth-lo")} />
          </linearGradient>
        </defs>
        <path d={`M0 ${RIM} L0 ${vh} L100 ${vh} L100 ${RIM} Z`} fill={`url(#${id}p)`} />
        <ellipse cx="50" cy={RIM} rx="50" ry={RIM} style={fill("plinth-top")} />
      </svg>
    );
  }
  if (support.kind === "stand") {
    const w = support.w * k;
    const h = support.cm * k;
    const vh = (100 * h) / w;
    return (
      <svg className={s.support} style={{ width: `${w}cqh`, height: `${h}cqh` }} viewBox={`0 0 100 ${vh}`} preserveAspectRatio="none" aria-hidden>
        <g style={{ stroke: v("iron") }} strokeWidth="3.2" fill="none" strokeLinecap="round">
          <path d={`M14 ${RIM} L4 ${vh}`} />
          <path d={`M86 ${RIM} L96 ${vh}`} />
          <path d={`M50 ${RIM + 6} L50 ${vh - 1}`} />
          <ellipse cx="50" cy={vh * 0.62} rx="40" ry="4.5" strokeWidth="2" />
        </g>
        <ellipse cx="50" cy={RIM} rx="44" ry={RIM * 0.7} style={fill("iron")} />
      </svg>
    );
  }
  return null;
}

type UnitProps = { species: Species; stage: StageKey; k: number; material: Material; support: Support; hero?: boolean; raised?: boolean };

/** Planta en maceta (o con su recipiente propio, como pilea y potos). */
function PottedUnit({ species, stage, k, material, support, hero, raised }: UnitProps) {
  const sc = SPECIES_SCALE[species];
  const d = PLANT_ASSET_DIMS[species].large;
  const pad = BOTTOM_PAD[species][stage];
  const supH = support.kind === "plinth" || support.kind === "stand" ? support.cm * k : 0;
  const supW = support.kind === "plinth" || support.kind === "stand" ? support.w * k : 0;
  const pot = sc.pot;
  // La maceta se asienta en el centro de la cara superior del soporte, no en su borde.
  const seat = supH > 0 ? supH - (supW * RIM) / 100 * 0.7 : 0;
  const potW = pot ? pot.w * k : 0;
  const potH = pot ? pot.h * k : 0;
  const ry = (potW * RIM) / 100;
  const plantCm = sc.cm - (pot?.h ?? 0);
  const sinkCm = pot ? Math.max(pot.w * 0.1, plantCm * 0.08) : 0;
  const imgH = ((plantCm + sinkCm) * k) / (1 - pad);
  const imgW = imgH * (d.w / d.h);
  const cut = seat + potH - ry; // línea de tierra: la lámina se recorta aquí
  const unitW = Math.max(imgW, potW, supW);
  const unitH = supH + potH + plantCm * k;
  const hang = support.kind === "hang";
  const plantBottom = pot ? -(sinkCm * k) - pad * imgH : seat - pad * imgH;
  // El tallo (no el lienzo) va al centro de la maceta.
  const shift = `${-BASE_X[species][stage] * 100}% 0`;

  return (
    <div className={`${s.unit} ${hero ? s.hero : ""}`} style={{ width: `${unitW}cqh`, height: `${unitH}cqh` }}>
      {hang && <span className={s.rope} style={{ bottom: `${imgH * 0.55}cqh` }} aria-hidden />}
      {!hang && <span className={s.contact} style={{ width: `${Math.max(potW, supW, imgW * 0.3) * 1.5}cqh`, height: `${Math.max(potW, supW, 8 * k) * 0.36}cqh` }} aria-hidden />}
      {!hang && !raised && (
        <span className={s.cast} style={{ width: `${imgW}cqh`, height: `${imgH + supH + potH}cqh`, translate: shift }} aria-hidden>
          <Image src={src(species, stage)} width={d.w} height={d.h} alt="" unoptimized draggable={false} />
        </span>
      )}
      {supH > 0 && <SupportEl support={support} k={k} />}
      {pot && (
        <span className={s.layer} style={{ bottom: `${seat}cqh` }}>
          <Pot w={potW} h={potH} shape={pot.shape} material={material} layer="back" />
        </span>
      )}
      {pot ? (
        <div className={s.cut} style={{ bottom: `${cut}cqh`, width: `${imgW}cqh`, height: `${imgH}cqh`, translate: shift }}>
          <div className={s.plant} style={{ width: `${imgW}cqh`, height: `${imgH}cqh`, bottom: `${plantBottom}cqh` }}>
            <Lamina species={species} stage={stage} />
          </div>
        </div>
      ) : (
        <div className={s.plant} style={{ width: `${imgW}cqh`, height: `${imgH}cqh`, bottom: `${plantBottom}cqh`, translate: shift }}>
          <Lamina species={species} stage={stage} />
        </div>
      )}
      {pot && (
        <span className={s.layer} style={{ bottom: `${seat}cqh` }}>
          <Pot w={potW} h={potH} shape={pot.shape} material={material} layer="front" />
        </span>
      )}
    </div>
  );
}

/** Planta actual mientras crece: frasco de propagación con agua. */
function JarUnit({ species, stage, k, support }: { species: Species; stage: StageKey; k: number; support: Support }) {
  const id = useUid();
  const sc = SPECIES_SCALE[species];
  const d = PLANT_ASSET_DIMS[species].large;
  const padFull = BOTTOM_PAD[species]["planta-completa"];
  const pad = PLANT_PAD[species][stage];
  const plantCm = sc.cm - (sc.pot?.h ?? 0);
  const imgH = ((plantCm + 4) * k) / (1 - padFull);
  const imgW = imgH * (d.w / d.h);
  const supH = support.kind === "plinth" ? support.cm * k : 0;
  const supW = support.kind === "plinth" ? support.w * k : 0;
  const seat = supH > 0 ? supH - (supW * RIM) / 100 * 0.7 : 0;
  // Nunca más angosto que las raíces de la etapa más ancha que vive en el frasco.
  const jw = Math.max(imgW * Math.max(0.34, ROOT_SPAN[species] * 1.12), 15 * k);
  const jh = Math.min(Math.max(imgH * 0.4, 18 * k), 46 * k);
  const vh = (100 * jh) / jw;
  const water = vh * 0.3;
  const unitW = Math.max(imgW, jw, supW);
  const glass = (
    <>
      <path d={`M2 ${RIM} L2 ${vh - 10} Q2 ${vh} 14 ${vh} L86 ${vh} Q98 ${vh} 98 ${vh - 10} L98 ${RIM}`} fill={`url(#${id}g)`} />
      <path d={`M2 ${water} L2 ${vh - 10} Q2 ${vh} 14 ${vh} L86 ${vh} Q98 ${vh} 98 ${vh - 10} L98 ${water} A48 ${RIM * 0.8} 0 0 1 2 ${water} Z`} style={fill("water")} />
    </>
  );
  return (
    <div className={`${s.unit} ${s.hero}`} style={{ width: `${unitW}cqh`, height: `${supH + imgH}cqh` }}>
      <span className={s.contact} style={{ width: `${Math.max(jw, supW) * 1.5}cqh`, height: `${Math.max(jw, supW) * 0.36}cqh` }} aria-hidden />
      {supH > 0 && <SupportEl support={support} k={k} />}
      <span className={s.layer} style={{ bottom: `${seat}cqh` }}>
        <svg className={s.pot} style={{ width: `${jw}cqh`, height: `${jh}cqh` }} viewBox={`0 0 100 ${vh}`} preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id={`${id}g`} x1="0" x2="1">
              <stop offset="0" style={stop("glass-edge")} />
              <stop offset="0.2" style={stop("glass-body")} />
              <stop offset="0.8" style={stop("glass-body")} />
              <stop offset="1" style={stop("glass-edge")} />
            </linearGradient>
          </defs>
          <ellipse cx="50" cy={RIM} rx="48" ry={RIM * 0.8} fill="none" style={{ stroke: v("glass-edge") }} strokeWidth="1.4" />
          {glass}
        </svg>
      </span>
      {/* La planta se apoya en el fondo del frasco; lo que la lámina dibuje debajo (líneas de suelo) se recorta. */}
      <div className={s.cut} style={{ bottom: `${seat + jh * 0.05}cqh`, width: `${imgW}cqh`, height: `${imgH}cqh`, translate: `${-BASE_X[species][stage] * 100}% 0` }}>
        <div className={s.plant} style={{ width: `${imgW}cqh`, height: `${imgH}cqh`, bottom: `${-pad * imgH}cqh` }}>
          <Lamina species={species} stage={stage} />
        </div>
      </div>
      <span className={s.layer} style={{ bottom: `${seat}cqh` }}>
        <svg className={s.pot} style={{ width: `${jw}cqh`, height: `${jh}cqh` }} viewBox={`0 0 100 ${vh}`} preserveAspectRatio="none" aria-hidden>
          <path d={`M2 ${water} L2 ${vh - 10} Q2 ${vh} 14 ${vh} L86 ${vh} Q98 ${vh} 98 ${vh - 10} L98 ${water} A48 ${RIM * 0.8} 0 0 1 2 ${water} Z`} style={{ ...fill("water"), opacity: 0.55 }} />
          <ellipse cx="50" cy={water} rx="48" ry={RIM * 0.8} fill="none" style={{ stroke: v("water-line") }} strokeWidth="1.2" />
          <path d={`M2 ${RIM} A48 ${RIM * 0.8} 0 0 0 98 ${RIM}`} fill="none" style={{ stroke: v("glass-rim") }} strokeWidth="2.4" />
          <path d={`M12 ${RIM + 8} L12 ${vh - 16}`} style={{ stroke: v("glass-hi") }} strokeWidth="3.5" strokeLinecap="round" />
          <path d={`M20 ${RIM + 10} L20 ${vh * 0.45}`} style={{ stroke: v("glass-hi") }} strokeWidth="1.4" strokeLinecap="round" opacity="0.6" />
          <path d={`M2 ${RIM} L2 ${vh - 10} Q2 ${vh} 14 ${vh} L86 ${vh} Q98 ${vh} 98 ${vh - 10} L98 ${RIM}`} fill="none" style={{ stroke: v("glass-edge") }} strokeWidth="1.4" />
        </svg>
      </span>
    </div>
  );
}

/** Próxima planta: maceta vacía y un sobre de semillas sin abrir. */
function Mystery({ k }: { k: number }) {
  const w = 18 * k;
  const ph = 8 * k;
  return (
    <div className={s.unit} style={{ width: `${w * 1.6}cqh`, height: `${18 * k}cqh` }}>
      <span className={s.contact} style={{ width: `${w * 1.7}cqh`, height: `${w * 0.36}cqh` }} aria-hidden />
      <span className={s.packet} style={{ width: `${10 * k}cqh`, height: `${14 * k}cqh`, left: `${w * 0.05}cqh`, bottom: `${ph * 0.6}cqh` }}>
        <i>?</i>
      </span>
      <span className={s.layer} style={{ bottom: 0, left: "62%" }}>
        <Pot w={w} h={ph} shape="cuenco" material="marfil" layer="back" />
      </span>
      <span className={s.layer} style={{ bottom: 0, left: "62%" }}>
        <Pot w={w} h={ph} shape="cuenco" material="marfil" layer="front" />
      </span>
    </div>
  );
}

/* ───────────────────────────── arquitectura ───────────────────────────── */

/** Proyección del cristal sobre el suelo: (x, y) → (x + a·(B−y), B + b·(B−y)). */
const project = (a: number, b: number, B: number) => `matrix(1 0 ${-a} ${-b} ${a * B} ${B * (1 + b)})`;

function FloorJoints({ W, B, vpY, step, rows }: { W: number; B: number; vpY: number; step: number; rows: number[] }) {
  const cx = W / 2;
  const lines: ReactNode[] = [];
  for (let i = -8; i <= 8; i++) {
    const x = cx + i * step;
    const xb = cx + ((x - cx) * (H - vpY)) / (B - vpY);
    lines.push(<line key={`v${i}`} x1={x} y1={B} x2={xb} y2={H} />);
  }
  rows.forEach((r, i) => lines.push(<line key={`h${i}`} x1={0} y1={B + (H - B) * r} x2={W} y2={B + (H - B) * r} />));
  return <g style={{ stroke: v("joint") }} strokeWidth="1.2">{lines}</g>;
}

/** Banco de trasplante o escalón de grada. */
function BenchEl({ b, uid }: { b: Bench; uid: string }) {
  const w = b.r - b.l;
  return (
    <g>
      <ellipse cx={(b.l + b.r) / 2} cy={b.floor + 3} rx={w * 0.55} ry={14} style={fill("contact")} filter={`url(#${uid}b8)`} />
      <g style={{ stroke: v("iron") }} strokeWidth="5" strokeLinecap="round">
        <line x1={b.l + 18} y1={b.y + 18} x2={b.l + 22} y2={b.floor} />
        <line x1={b.r - 18} y1={b.y + 18} x2={b.r - 22} y2={b.floor} />
        {b.floor - b.y > 70 && <line x1={b.l + 20} y1={b.floor - 32} x2={b.r - 20} y2={b.floor - 32} strokeWidth="3" />}
      </g>
      <path d={`M${b.l + 10} ${b.y - 10} L${b.r - 10} ${b.y - 10} L${b.r} ${b.y + 2} L${b.l} ${b.y + 2} Z`} style={fill("wood-top")} />
      <rect x={b.l} y={b.y + 2} width={w} height={16} style={fill("wood")} />
      <rect x={b.l} y={b.y + 16} width={w} height={3} style={fill("wood-lo")} />
    </g>
  );
}

function Greenhouse({ W, benches, uid }: { W: number; benches: Bench[]; uid: string }) {
  const B = 700;
  const knee = 592;
  const top = 112;
  const cx = W / 2;
  const posts: number[] = [];
  for (let x = cx % 200; x <= W; x += 200) posts.push(x);
  const bars: number[] = [];
  for (let x = cx % 50; x < W; x += 50) if (!posts.includes(x)) bars.push(x);
  const transoms = [262, 428];
  const glazing = (scale = 1) => (
    <>
      {bars.map((x) => <line key={`b${x}`} x1={x} x2={x} y1={top} y2={knee} strokeWidth={2.2 * scale} />)}
      {transoms.map((y) => <line key={`t${y}`} x1={0} x2={W} y1={y} y2={y} strokeWidth={4.5 * scale} />)}
      {posts.map((x) => <line key={`p${x}`} x1={x} x2={x} y1={top} y2={knee} strokeWidth={8 * scale} />)}
    </>
  );
  return (
    <svg className={s.arch} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={`${uid}glass`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" style={stop("sky-top")} />
          <stop offset="1" style={stop("sky-low")} />
        </linearGradient>
        <linearGradient id={`${uid}roof`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" style={stop("roof-top")} />
          <stop offset="1" style={stop("sky-top")} />
        </linearGradient>
        <linearGradient id={`${uid}knee`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" style={stop("wall-top")} />
          <stop offset="1" style={stop("wall-low")} />
        </linearGradient>
        <linearGradient id={`${uid}floor`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" style={stop("floor-far")} />
          <stop offset="1" style={stop("floor-near")} />
        </linearGradient>
        <mask id={`${uid}panes`}>
          <rect x={0} y={top} width={W} height={knee - top} fill="#fff" />
          <g stroke="#000">{glazing(1.7)}</g>
        </mask>
        <filter id={`${uid}b3`} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <filter id={`${uid}b8`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
      </defs>
      <rect width={W} height={top} fill={`url(#${uid}roof)`} />
      <g style={{ stroke: v("frame") }} fill="none">
        {posts.map((x) => <line key={x} x1={x} y1={top} x2={cx + (x - cx) * 1.8} y2={0} strokeWidth="6" />)}
        <line x1={0} x2={W} y1={46} y2={46} strokeWidth="3" />
        <line x1={0} x2={W} y1={84} y2={84} strokeWidth="3" />
      </g>
      <rect y={top} width={W} height={knee - top} fill={`url(#${uid}glass)`} />
      <g filter={`url(#${uid}b8)`}>
        <g style={fill("outside")}>
          {Array.from({ length: Math.ceil(W / 170) + 1 }, (_, i) => (
            <ellipse key={i} cx={i * 170 + ((i * 53) % 70)} cy={470 + ((i * 37) % 50)} rx={110} ry={90 + ((i * 29) % 40)} />
          ))}
        </g>
        <rect y={530} width={W} height={70} style={fill("outside-low")} />
      </g>
      <g style={{ stroke: v("frame") }}>{glazing()}</g>
      <rect y={top - 6} width={W} height={10} style={fill("frame")} />
      <rect y={knee} width={W} height={B - knee} fill={`url(#${uid}knee)`} />
      <g style={{ stroke: v("joint") }} strokeWidth="1">
        {[620, 648, 676].map((y) => <line key={y} x1={0} x2={W} y1={y} y2={y} />)}
      </g>
      <rect y={knee - 4} width={W} height={13} style={fill("plinth-top")} />
      <rect y={B} width={W} height={H - B} fill={`url(#${uid}floor)`} />
      <FloorJoints W={W} B={B} vpY={360} step={160} rows={[0.1, 0.26, 0.5, 0.84]} />
      <rect y={B} width={W} height={30} style={fill("floor-ao")} filter={`url(#${uid}b8)`} />
      {/* El sol atraviesa el cristal y dibuja la retícula de la herrería en el suelo. */}
      <g transform={project(0.42, 0.5, B)} filter={`url(#${uid}b3)`}>
        <rect y={top} width={W} height={knee - top} mask={`url(#${uid}panes)`} style={fill("sun")} />
      </g>
      {[...benches].sort((a, b) => a.y - b.y).map((b) => (
        <BenchEl key={`${b.l}${b.y}`} b={b} uid={uid} />
      ))}
    </svg>
  );
}

/* ───────────────────────────── luz ───────────────────────────── */

/** Capa de luz por encima de las plantas (modo «screen»). De día, rayos de sol;
 *  de noche, guirnaldas, lámparas y luces secundarias que nunca superan el foco
 *  de la planta actual. */
function Atmosphere({ layout, uid }: { layout: Layout; uid: string }) {
  const { W } = layout;
  const hero = layout.slots.find((x) => x.what === "hero");
  const glows = layout.slots.filter((x) => x.glow);
  const beams = Array.from({ length: Math.ceil(W / 340) }, (_, i) => 60 + i * 330);
  return (
    <svg className={s.atmos} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={`${uid}beam`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" style={stop("beam")} />
          <stop offset="1" style={stop("beam", 0)} />
        </linearGradient>
        <linearGradient id={`${uid}cone`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" style={stop("lamp", 0.05)} />
          <stop offset="0.25" style={stop("lamp", 0.5)} />
          <stop offset="1" style={stop("lamp", 0.2)} />
        </linearGradient>
        <linearGradient id={`${uid}up`} x1="0" x2="0" y1="1" y2="0">
          <stop offset="0" style={stop("lamp-soft", 0.9)} />
          <stop offset="1" style={stop("lamp-soft", 0)} />
        </linearGradient>
        <radialGradient id={`${uid}pool`}>
          <stop offset="0" style={stop("lamp")} />
          <stop offset="1" style={stop("lamp", 0)} />
        </radialGradient>
        <radialGradient id={`${uid}soft`}>
          <stop offset="0" style={stop("lamp-soft")} />
          <stop offset="1" style={stop("lamp-soft", 0)} />
        </radialGradient>
        <filter id={`${uid}b18`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="18" />
        </filter>
        <filter id={`${uid}b10`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
        <filter id={`${uid}b4`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>

      <g className={s.sunOnly} filter={`url(#${uid}b18)`}>
        {beams.map((x, i) => (
          <path key={x} d={`M${x} 110 L${x + 90 + i * 10} 110 L${x + 470} ${H} L${x + 330} ${H} Z`} fill={`url(#${uid}beam)`} />
        ))}
      </g>

      <g className={s.nightOnly}>
        <StringLights W={W} y={92} sag={36} span={400} uid={uid} />
        <StringLights W={W} y={150} sag={58} span={W > 1000 ? 533 : W / 2} uid={uid} offset={0.5} />
        {/* Luces secundarias: un foco al pie de las plantas de suelo y charcos suaves. */}
        {glows.map((g) => {
          const k = cqhPerCm(g.z, layout.scale) * 10; // unidades del SVG por cm
          const sp = g.what as Species;
          const h = SPECIES_SCALE[sp].cm * k;
          const w = Math.max(40, (SPECIES_SCALE[sp].pot?.w ?? 20) * k);
          return g.glow === "up" ? (
            <g key={`${g.x}${g.y}`}>
              <path d={`M${g.x - w * 0.3} ${g.y} L${g.x + w * 0.3} ${g.y} L${g.x + h * 0.32} ${g.y - h * 0.95} L${g.x - h * 0.32} ${g.y - h * 0.95} Z`} fill={`url(#${uid}up)`} filter={`url(#${uid}b10)`} opacity="0.5" />
              <ellipse cx={g.x} cy={g.y + 4} rx={w * 1.1} ry={w * 0.22} fill={`url(#${uid}soft)`} />
            </g>
          ) : (
            <ellipse key={`${g.x}${g.y}`} cx={g.x} cy={g.y + 4} rx={w * 2.4} ry={w * 0.5} fill={`url(#${uid}soft)`} />
          );
        })}
        {layout.lamps.map((l) => (
          <Pendant key={`${l.x}${l.y}`} x={l.x} y={l.y} uid={uid} small={l.small} />
        ))}
        {hero && <Pendant x={hero.x} y={250} uid={uid} />}
      </g>

      {/* Foco principal sobre la planta actual: siempre el más intenso de la escena. */}
      {hero && (
        <>
          <g className={s.lampOnly}>
            <path d={`M${hero.x - 26} 260 L${hero.x + 26} 260 L${hero.x + 250} 960 L${hero.x - 250} 960 Z`} fill={`url(#${uid}cone)`} filter={`url(#${uid}b18)`} opacity="0.6" />
          </g>
          <ellipse cx={hero.x} cy={hero.y + 10} rx={250} ry={52} fill={`url(#${uid}pool)`} opacity="0.95" />
        </>
      )}

      <g className={s.motes} style={fill("mote")}>
        {Array.from({ length: Math.round(W / 100) }, (_, i) => (
          <circle key={i} cx={(i * 97 + 140) % W} cy={240 + ((i * 131) % 520)} r={1.2 + (i % 3) * 0.6} style={{ animationDelay: `${-i * 1.7}s` }} />
        ))}
      </g>
    </svg>
  );
}

function StringLights({ W, y, sag, span, uid, offset = 0 }: { W: number; y: number; sag: number; span: number; uid: string; offset?: number }) {
  const swags: ReactNode[] = [];
  for (let x = -span * offset; x < W; x += span) {
    const x2 = x + span;
    const n = Math.max(5, Math.round(span / 50));
    const pts = Array.from({ length: n }, (_, i) => {
      const t = (i + 0.5) / n;
      return { px: x + (x2 - x) * t, py: y + 4 * sag * t * (1 - t) };
    });
    swags.push(
      <g key={x}>
        <path d={`M${x} ${y} Q${(x + x2) / 2} ${y + sag * 2} ${x2} ${y}`} fill="none" style={{ stroke: v("cord") }} strokeWidth="1.2" />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.px} cy={p.py + 5} r="9" style={fill("lamp")} opacity="0.5" filter={`url(#${uid}b4)`} />
            <circle cx={p.px} cy={p.py + 5} r="2.6" style={fill("bulb")} />
          </g>
        ))}
      </g>,
    );
  }
  return <>{swags}</>;
}

function Pendant({ x, y, uid, small }: { x: number; y: number; uid: string; small?: boolean }) {
  const r = small ? 12 : 17;
  return (
    <g>
      <line x1={x} x2={x} y1={0} y2={y - r} style={{ stroke: v("cord") }} strokeWidth="1.4" />
      <circle cx={x} cy={y} r={r * 6} fill={`url(#${uid}pool)`} opacity={small ? 0.4 : 0.55} />
      <circle cx={x} cy={y} r={r} style={fill("bulb")} opacity="0.92" />
      <path d={`M${x - r * 0.55} ${y - r * 0.82} A${r} ${r} 0 0 1 ${x + r * 0.55} ${y - r * 0.82}`} style={fill("cord")} />
    </g>
  );
}

/* ───────────────────────────── escena ───────────────────────────── */

const pct = (n: number, of: number) => `${(n / of) * 100}%`;

type HeroState = { heroSpecies: Species; heroStage: StageKey };

function SlotEl({ slot, layout, heroSpecies, heroStage }: { slot: Slot; layout: Layout } & HeroState) {
  const k = cqhPerCm(slot.z, layout.scale);
  const support = slot.support ?? { kind: "none" };
  const style = {
    left: pct(slot.x, layout.W),
    bottom: pct(H - slot.y, H),
    zIndex: Math.round(slot.y) + (slot.what === "hero" ? 200 : 0),
    ["--z" as string]: Math.max(0, slot.z),
  } as CSSProperties;
  let body: ReactNode;
  if (slot.what === "mystery") body = <Mystery k={k} />;
  else if (slot.what === "hero") {
    body =
      heroStage === "planta-completa" ? (
        <PottedUnit species={heroSpecies} stage={heroStage} k={k} material="salvia" support={support} hero />
      ) : (
        <JarUnit species={heroSpecies} stage={heroStage} k={k} support={support} />
      );
  } else body = <PottedUnit species={slot.what} stage="planta-completa" k={k} material={slot.material ?? "marfil"} support={support} raised={slot.raised} />;
  return (
    <div className={`${s.slot} ${slot.glow ? s.lit : ""}`} style={style}>
      {body}
    </div>
  );
}

const STAGE_MIN: Record<StageKey, number> = Object.fromEntries(STAGE_OPTIONS.map((o) => [o.key, o.minutes])) as Record<StageKey, number>;
const STAGE_LABEL: Record<StageKey, string> = Object.fromEntries(STAGE_OPTIONS.map((o) => [o.key, o.label])) as Record<StageKey, string>;

function Caption({ heroSpecies, heroStage, className }: HeroState & { className?: string }) {
  const min = STAGE_MIN[heroStage];
  return (
    <div className={`${s.caption} ${className ?? ""}`}>
      <p className={s.eyebrow}>Planta actual</p>
      <p className={s.name}>{SPECIES_LABEL[heroSpecies]}</p>
      <p className={s.latin}>{LATIN[heroSpecies]}</p>
      <p className={s.meta}>
        {STAGE_LABEL[heroStage]} · {min} de 150 min
      </p>
      <span className={s.bar}>
        <i style={{ width: `${(min / 150) * 100}%` }} />
      </span>
    </div>
  );
}

function Scene({ layout, caption, className, style, ...hero }: { layout: Layout; caption?: boolean; className?: string; style?: CSSProperties } & HeroState) {
  const uid = useUid();
  return (
    <div className={`${s.scene} ${className ?? ""}`} style={{ aspectRatio: `${layout.W} / ${H}`, ...style }}>
      <Greenhouse W={layout.W} benches={layout.benches} uid={uid} />
      {layout.slots
        .filter((sl) => sl.what !== hero.heroSpecies)
        .map((sl, i) => (
          <SlotEl key={i} slot={sl} layout={layout} {...hero} />
        ))}
      <Atmosphere layout={layout} uid={`${uid}a`} />
      <span className={s.vignette} aria-hidden />
      {caption && <Caption {...hero} className={s.captionOver} />}
    </div>
  );
}

/* ───────────────────────────── iPhone ───────────────────────────── */

const COLLECTION_COUNT = 11;

function Panorama(hero: HeroState) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const heroX = DESKTOP.slots.find((x) => x.what === "hero")?.x ?? DESKTOP.W / 2;
    el.scrollLeft = (heroX / DESKTOP.W) * el.scrollWidth - el.clientWidth / 2;
  }, []);
  return (
    <>
      <div ref={ref} className={s.pano}>
        <Scene layout={DESKTOP} className={s.panoScene} style={{ width: 736, height: 460 }} {...hero} />
      </div>
      <p className={s.hint}>← Desliza para recorrer tu invernadero →</p>
    </>
  );
}

function PhoneView({ id, ...hero }: { id: PhoneVariant } & HeroState) {
  if (id === "M1") {
    return (
      <>
        <Scene layout={M1} className={s.phoneScene} {...hero} />
        <Caption {...hero} className={s.captionBelow} />
      </>
    );
  }
  if (id === "M2") {
    return (
      <>
        <Panorama {...hero} />
        <Caption {...hero} className={s.captionBelow} />
      </>
    );
  }
  return (
    <>
      <Scene layout={M3_HERO} className={s.phoneScene} {...hero} />
      <Caption {...hero} className={s.captionBelow} />
      <div className={s.sectionHead}>
        <p className={s.name}>Tu invernadero</p>
        <p className={s.meta}>{COLLECTION_COUNT} plantas · la próxima es una sorpresa</p>
      </div>
      <Scene layout={M3_COLLECTION} className={s.phoneScene} {...hero} />
    </>
  );
}

/* ───────────────────────────── laboratorio ───────────────────────────── */

export function AtelierLab() {
  const [dark, setDark] = useState(false);
  const [phone, setPhone] = useState(false);
  const [mobileId, setMobileId] = useState<PhoneVariant>("M1");
  const [heroSpecies, setHeroSpecies] = useState<Species>("monstera");
  const [heroStage, setHeroStage] = useState<StageKey>("planta-joven");
  const hero = { heroSpecies, heroStage };

  useEffect(() => {
    // Arranca con el tema de la app; luego el lab lo cambia solo dentro de sí mismo.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(document.documentElement.getAttribute("data-theme") === "dark");
  }, []);

  return (
    <div className={`${s.lab} ${s.v2} ${dark ? s.dark : ""}`}>
      {/* De noche, el papel blanco de las láminas (lavados, brillos) se vuelve
          transparente en vez de verse como un halo gris. */}
      <svg width="0" height="0" className={s.defs} aria-hidden>
        <filter id="lab-dewhite" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -3.33 -3.33 -3.33 0 9.1" result="m" />
          <feComposite in="SourceGraphic" in2="m" operator="in" />
        </filter>
      </svg>
      <div className={`${s.inner} ${phone ? s.innerWide : ""}`}>
        <header className={s.head}>
          <p className={s.kicker}>Laboratorio del jardín · Ronda 3</p>
          <h1 className={s.title}>Luz de invernadero</h1>
        </header>

        <div className={s.controls}>
          <div className={s.seg} role="group" aria-label="Tema">
            <button type="button" onClick={() => setDark(false)} aria-pressed={!dark} className={!dark ? s.segOn : ""}>
              <Sun size={14} /> Claro
            </button>
            <button type="button" onClick={() => setDark(true)} aria-pressed={dark} className={dark ? s.segOn : ""}>
              <Moon size={14} /> Oscuro
            </button>
          </div>
          <div className={`${s.seg} ${s.desktopOnly}`} role="group" aria-label="Vista">
            <button type="button" onClick={() => setPhone(false)} aria-pressed={!phone} className={!phone ? s.segOn : ""}>
              <Monitor size={14} /> Escritorio
            </button>
            <button type="button" onClick={() => setPhone(true)} aria-pressed={phone} className={phone ? s.segOn : ""}>
              <Smartphone size={14} /> iPhone · M1 M2 M3
            </button>
          </div>
        </div>

        <div className={s.pickers}>
          <div className={s.chips} role="group" aria-label="Etapa de la planta actual">
            {STAGE_OPTIONS.map((o) => (
              <button key={o.key} type="button" onClick={() => setHeroStage(o.key)} aria-pressed={heroStage === o.key} className={`${s.chip} ${heroStage === o.key ? s.chipOn : ""}`}>
                {o.label}
              </button>
            ))}
          </div>
          <div className={s.chips} role="group" aria-label="Especie de la planta actual">
            {SPECIES_ORDER.map((sp) => (
              <button key={sp} type="button" onClick={() => setHeroSpecies(sp)} aria-pressed={heroSpecies === sp} className={`${s.chip} ${heroSpecies === sp ? s.chipOn : ""}`}>
                {SPECIES_LABEL[sp]}
              </button>
            ))}
          </div>
        </div>

        {/* Escritorio */}
        <div className={`${s.desktopOnly} ${phone ? s.hidden : ""}`}>
          <Scene layout={DESKTOP} caption {...hero} />
        </div>

        {/* Comparador de iPhone en escritorio: las tres propuestas lado a lado. */}
        {phone && (
          <div className={`${s.desktopOnly} ${s.compare}`}>
            {PHONE_VARIANTS.map((m) => (
              <section key={m.id} className={s.phoneCol}>
                <p className={s.phoneName}>{m.name}</p>
                <p className={s.phoneLine}>{m.line}</p>
                <div className={s.phoneFrame} data-m={m.id}>
                  <PhoneView id={m.id} {...hero} />
                </div>
              </section>
            ))}
          </div>
        )}

        {/* iPhone real */}
        <div className={s.phoneOnly}>
          <nav className={s.mtabs} aria-label="Propuestas de iPhone">
            {PHONE_VARIANTS.map((m) => (
              <button key={m.id} type="button" onClick={() => setMobileId(m.id)} aria-pressed={mobileId === m.id} className={`${s.chip} ${mobileId === m.id ? s.chipOn : ""}`}>
                {m.id}
              </button>
            ))}
          </nav>
          <p className={s.phoneLine}>{PHONE_VARIANTS.find((m) => m.id === mobileId)?.line}</p>
          <PhoneView id={mobileId} {...hero} />
        </div>

        <p className={s.foot}>
          Prototipo sin datos reales. <a href="/garden-lab">Ver ronda 1</a>
        </p>
      </div>
    </div>
  );
}
