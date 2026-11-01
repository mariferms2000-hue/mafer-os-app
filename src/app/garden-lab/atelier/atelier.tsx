"use client";

/* Laboratorio del jardín · Ronda 2 — refinamiento de A (Atelier Invernadero).

   La arquitectura y la luz son SVG vectorial (nítido a cualquier tamaño); las
   plantas son las láminas actuales, siempre la versión clara, integradas con
   sombra de contacto, sombra proyectada y un sombreado enmascarado con su propia
   silueta. Todo vive en memoria: no lee ni escribe la base. */

import { useEffect, useId, useState, type CSSProperties, type ReactNode } from "react";
import Image from "next/image";
import { Moon, Sun, Monitor, Smartphone } from "lucide-react";
import type { StageKey } from "@/lib/focus-logic";
import { PLANT_ASSET_DIMS, plantAssetPath } from "@/lib/plant-assets";
import { SPECIES_LABEL } from "@/lib/plant-svg-v2";
import { SPECIES_ORDER, SPECIES_SCALE, STAGE_OPTIONS, type Species } from "../lab-data";
import { BOTTOM_PAD } from "../asset-bounds";
import {
  LATIN,
  LAYOUTS,
  VARIANTS,
  cqhPerCm,
  type Frame,
  type Material,
  type Slot,
  type Support,
  type Variant,
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

  return (
    <div className={`${s.unit} ${hero ? s.hero : ""}`} style={{ width: `${unitW}cqh`, height: `${unitH}cqh` }}>
      {hang && <span className={s.rope} style={{ bottom: `${imgH * 0.55}cqh` }} aria-hidden />}
      {!hang && <span className={s.contact} style={{ width: `${Math.max(potW, supW, imgW * 0.3) * 1.5}cqh`, height: `${Math.max(potW, supW, 8 * k) * 0.36}cqh` }} aria-hidden />}
      {!hang && !raised && (
        <span className={s.cast} style={{ width: `${imgW}cqh`, height: `${imgH + supH + potH}cqh` }} aria-hidden>
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
        <div className={s.cut} style={{ bottom: `${cut}cqh`, width: `${imgW}cqh`, height: `${imgH}cqh` }}>
          <div className={s.plant} style={{ width: `${imgW}cqh`, height: `${imgH}cqh`, bottom: `${plantBottom}cqh` }}>
            <Lamina species={species} stage={stage} />
          </div>
        </div>
      ) : (
        <div className={s.plant} style={{ width: `${imgW}cqh`, height: `${imgH}cqh`, bottom: `${plantBottom}cqh` }}>
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
  const pad = BOTTOM_PAD[species][stage];
  const plantCm = sc.cm - (sc.pot?.h ?? 0);
  const imgH = ((plantCm + 4) * k) / (1 - padFull);
  const imgW = imgH * (d.w / d.h);
  const supH = support.kind === "plinth" ? support.cm * k : 0;
  const supW = support.kind === "plinth" ? support.w * k : 0;
  const seat = supH > 0 ? supH - (supW * RIM) / 100 * 0.7 : 0;
  const jw = Math.max(imgW * 0.3, 15 * k);
  const jh = Math.min(Math.max(imgH * 0.4, 18 * k), 34 * k);
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
      <div className={s.plant} style={{ width: `${imgW}cqh`, height: `${imgH}cqh`, bottom: `${seat + jh * 0.05 - pad * imgH}cqh` }}>
        <Lamina species={species} stage={stage} />
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

type ArchProps = { W: number; uid: string };

/** Proyección de una ventana sobre el suelo: (x, y) → (x + a·(B−y), B + b·(B−y)). */
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

function ArchA1({ W, uid }: ArchProps) {
  const B = 700;
  const cx = W / 2;
  const wide = W > 1000;
  const ww = wide ? 470 : 360;
  const L = cx - ww / 2;
  const R = cx + ww / 2;
  const rad = ww / 2;
  const spring = wide ? 320 : 330;
  const win = `M${L} ${B} L${L} ${spring} A${rad} ${rad} 0 0 1 ${R} ${spring} L${R} ${B} Z`;
  const fan = rad * 0.4;
  const cols = [1, 2, 3].map((i) => L + (ww * i) / 4);
  const bars = (
    <>
      {cols.map((x) => (
        <line key={x} x1={x} x2={x} y1={B} y2={spring - Math.sqrt(Math.max(0, rad * rad - (x - cx) ** 2)) * (Math.abs(x - cx) < 1 ? 0 : 1) - (Math.abs(x - cx) < 1 ? fan : 0)} />
      ))}
      <line x1={L} x2={R} y1={spring} y2={spring} />
      <line x1={L} x2={R} y1={spring + (B - spring) * 0.5} y2={spring + (B - spring) * 0.5} />
      <path d={`M${cx - fan} ${spring} A${fan} ${fan} 0 0 1 ${cx + fan} ${spring}`} fill="none" />
      {[30, 60, 120, 150].map((deg) => {
        const r = (deg * Math.PI) / 180;
        return <line key={deg} x1={cx + Math.cos(r) * fan} y1={spring - Math.sin(r) * fan} x2={cx + Math.cos(r) * rad} y2={spring - Math.sin(r) * rad} />;
      })}
    </>
  );
  const niches = wide
    ? [
        { l: 150, r: 390 },
        { l: 1210, r: 1450 },
      ]
    : [];
  return (
    <svg className={s.arch} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={`${uid}wall`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" style={stop("wall-top")} />
          <stop offset="1" style={stop("wall-low")} />
        </linearGradient>
        <linearGradient id={`${uid}floor`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" style={stop("floor-far")} />
          <stop offset="1" style={stop("floor-near")} />
        </linearGradient>
        <linearGradient id={`${uid}glass`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" style={stop("sky-top")} />
          <stop offset="1" style={stop("sky-low")} />
        </linearGradient>
        <radialGradient id={`${uid}glow`}>
          <stop offset="0" style={stop("wall-glow")} />
          <stop offset="1" style={stop("wall-glow", 0)} />
        </radialGradient>
        <clipPath id={`${uid}win`}>
          <path d={win} />
        </clipPath>
        <mask id={`${uid}panes`}>
          <path d={win} fill="#fff" />
          <g stroke="#000" strokeWidth="9" fill="none">{bars}</g>
        </mask>
        <filter id={`${uid}b6`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <filter id={`${uid}b22`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="22" />
        </filter>
      </defs>
      <rect width={W} height={B} fill={`url(#${uid}wall)`} />
      <ellipse cx={cx} cy={spring + 40} rx={ww * 1.05} ry={460} fill={`url(#${uid}glow)`} />
      {niches.map((n) => (
        <g key={n.l}>
          <path d={`M${n.l} ${B} L${n.l} 330 A${(n.r - n.l) / 2} ${(n.r - n.l) / 2} 0 0 1 ${n.r} 330 L${n.r} ${B} Z`} style={fill("niche")} />
          <path d={`M${n.l} ${B} L${n.l} 330 A${(n.r - n.l) / 2} ${(n.r - n.l) / 2} 0 0 1 ${n.r} 330`} fill="none" style={{ stroke: v("niche-edge") }} strokeWidth="5" />
        </g>
      ))}
      {wide && (
        <g>
          <ellipse cx={1330} cy={538} rx={110} ry={10} style={fill("contact")} filter={`url(#${uid}b6)`} />
          <rect x={1222} y={520} width={216} height={11} rx={1.5} style={fill("wood")} />
          <rect x={1222} y={529} width={216} height={3} style={fill("wood-lo")} />
        </g>
      )}
      {/* Ventanal: derrame del muro, cielo, jardín exterior y herrería. */}
      <path d={`M${L - 18} ${B} L${L - 18} ${spring} A${rad + 18} ${rad + 18} 0 0 1 ${R + 18} ${spring} L${R + 18} ${B} Z`} style={fill("reveal")} />
      <path d={win} fill={`url(#${uid}glass)`} />
      <g clipPath={`url(#${uid}win)`}>
        <g filter={`url(#${uid}b6)`} style={fill("outside")}>
          <ellipse cx={L + 40} cy={560} rx={120} ry={110} />
          <ellipse cx={cx + 30} cy={600} rx={170} ry={80} />
          <ellipse cx={R - 30} cy={540} rx={110} ry={130} />
        </g>
        <rect x={L} y={636} width={ww} height={70} style={fill("outside-low")} filter={`url(#${uid}b6)`} />
      </g>
      <g style={{ stroke: v("frame") }} strokeWidth="3.6" fill="none">{bars}</g>
      <path d={win} fill="none" style={{ stroke: v("frame") }} strokeWidth="7" />
      <rect x={0} y={B - 12} width={W} height={12} style={fill("skirting")} />
      <rect x={L - 26} y={B - 6} width={ww + 52} height={10} rx={2} style={fill("plinth-top")} />
      <rect y={B} width={W} height={H - B} fill={`url(#${uid}floor)`} />
      <FloorJoints W={W} B={B} vpY={250} step={wide ? 190 : 150} rows={[0.14, 0.36, 0.7]} />
      <rect y={B} width={W} height={36} style={fill("floor-ao")} filter={`url(#${uid}b6)`} />
      {/* Luz del ventanal proyectada en el suelo, con la sombra de la herrería. */}
      <g transform={project(-0.08, 0.6, B)} filter={`url(#${uid}b6)`}>
        <rect x={L - 10} y={0} width={ww + 20} height={B} mask={`url(#${uid}panes)`} style={fill("sun")} />
      </g>
    </svg>
  );
}

function ArchA2({ W, uid }: ArchProps) {
  const B = 700;
  const knee = 592;
  const top = 112;
  const cx = W / 2;
  const wide = W > 1000;
  const posts: number[] = [];
  for (let x = 0; x <= W; x += 200) posts.push(x);
  const bars: number[] = [];
  for (let x = 50; x < W; x += 50) if (x % 200) bars.push(x);
  const transoms = [262, 428];
  const glazing = (scale = 1) => (
    <>
      {bars.map((x) => <line key={`b${x}`} x1={x} x2={x} y1={top} y2={knee} strokeWidth={2.2 * scale} />)}
      {transoms.map((y) => <line key={`t${y}`} x1={0} x2={W} y1={y} y2={y} strokeWidth={4.5 * scale} />)}
      {posts.map((x) => <line key={`p${x}`} x1={x} x2={x} y1={top} y2={knee} strokeWidth={8 * scale} />)}
    </>
  );
  const bench = wide ? { l: 150, r: 620 } : { l: 20, r: 290 };
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
      <FloorJoints W={W} B={B} vpY={360} step={wide ? 160 : 130} rows={[0.1, 0.26, 0.5, 0.84]} />
      <rect y={B} width={W} height={30} style={fill("floor-ao")} filter={`url(#${uid}b8)`} />
      {/* El sol atraviesa el cristal y dibuja la retícula de la herrería en el suelo. */}
      <g transform={project(0.42, 0.5, B)} filter={`url(#${uid}b3)`}>
        <rect y={top} width={W} height={knee - top} mask={`url(#${uid}panes)`} style={fill("sun")} />
      </g>
      {/* Banco de trasplante. */}
      <ellipse cx={(bench.l + bench.r) / 2} cy={885} rx={(bench.r - bench.l) * 0.55} ry={16} style={fill("contact")} filter={`url(#${uid}b8)`} />
      <g style={{ stroke: v("iron") }} strokeWidth="5" strokeLinecap="round">
        <line x1={bench.l + 18} y1={790} x2={bench.l + 22} y2={882} />
        <line x1={bench.r - 18} y1={790} x2={bench.r - 22} y2={882} />
        <line x1={bench.l + 20} y1={850} x2={bench.r - 20} y2={850} strokeWidth="3" />
      </g>
      <path d={`M${bench.l + 10} 762 L${bench.r - 10} 762 L${bench.r} 774 L${bench.l} 774 Z`} style={fill("wood-top")} />
      <rect x={bench.l} y={774} width={bench.r - bench.l} height={16} style={fill("wood")} />
      <rect x={bench.l} y={788} width={bench.r - bench.l} height={3} style={fill("wood-lo")} />
    </svg>
  );
}

function ArchA3({ W, uid }: ArchProps) {
  const cx = W / 2;
  const wide = W > 1000;
  const bw = wide ? 380 : 230;
  const bl = cx - bw / 2;
  const br = cx + bw / 2;
  const bt = 285;
  const bb = 640;
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const ribs = [0.16, 0.4, 0.58, 0.72, 0.83];
  const sideBars = [0.12, 0.3, 0.5, 0.7, 0.88];
  return (
    <svg className={s.arch} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={`${uid}side`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" style={stop("side-near")} />
          <stop offset="1" style={stop("sky-low")} />
        </linearGradient>
        <linearGradient id={`${uid}sideR`} x1="1" x2="0" y1="0" y2="0">
          <stop offset="0" style={stop("side-near")} />
          <stop offset="1" style={stop("sky-low")} />
        </linearGradient>
        <linearGradient id={`${uid}roof`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" style={stop("roof-top")} />
          <stop offset="1" style={stop("sky-top")} />
        </linearGradient>
        <linearGradient id={`${uid}floor`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" style={stop("floor-far")} />
          <stop offset="1" style={stop("floor-near")} />
        </linearGradient>
        <radialGradient id={`${uid}back`} cx="50%" cy="60%" r="70%">
          <stop offset="0" style={stop("back-glow")} />
          <stop offset="1" style={stop("sky-low")} />
        </radialGradient>
        <filter id={`${uid}b8`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
      </defs>
      <rect width={W} height={H} style={fill("sky-low")} />
      <path d={`M0 0 L${W} 0 L${br} ${bt} L${bl} ${bt} Z`} fill={`url(#${uid}roof)`} />
      <path d={`M0 0 L${bl} ${bt} L${bl} ${bb} L0 ${H} Z`} fill={`url(#${uid}side)`} />
      <path d={`M${W} 0 L${br} ${bt} L${br} ${bb} L${W} ${H} Z`} fill={`url(#${uid}sideR)`} />
      <rect x={bl} y={bt} width={bw} height={bb - bt} fill={`url(#${uid}back)`} />
      <g filter={`url(#${uid}b8)`} style={fill("outside")}>
        <ellipse cx={cx - bw * 0.3} cy={bb - 40} rx={bw * 0.32} ry={60} />
        <ellipse cx={cx + bw * 0.25} cy={bb - 30} rx={bw * 0.36} ry={50} />
      </g>
      <g style={{ stroke: v("frame") }} fill="none">
        {/* Travesaños de cristal en las paredes laterales y el techo, hacia el punto de fuga. */}
        {sideBars.map((f) => {
          const yL = f * H;
          const yB = lerp(bt, bb, f);
          return (
            <g key={f} strokeWidth="2">
              <line x1={0} y1={yL} x2={bl} y2={yB} />
              <line x1={W} y1={yL} x2={br} y2={yB} />
              <line x1={f * W} y1={0} x2={lerp(bl, br, f)} y2={bt} />
            </g>
          );
        })}
        <rect x={bl} y={bt} width={bw} height={bb - bt} strokeWidth="4" />
        <line x1={cx} x2={cx} y1={bt + 70} y2={bb} strokeWidth="3" />
        <path d={`M${bl + bw * 0.18} ${bb} L${bl + bw * 0.18} ${bt + 120} A${bw * 0.32} ${bw * 0.32} 0 0 1 ${br - bw * 0.18} ${bt + 120} L${br - bw * 0.18} ${bb}`} strokeWidth="4" />
        {ribs.map((t) => {
          const L = lerp(0, bl, t);
          const R = lerp(W, br, t);
          const fl = lerp(H + 40, bb, t);
          const tp = lerp(-30, bt, t);
          const sp = lerp(tp, fl, 0.3);
          return (
            <path
              key={t}
              d={`M${L} ${fl} L${L} ${sp} A${(R - L) / 2} ${sp - tp} 0 0 1 ${R} ${sp} L${R} ${fl}`}
              strokeWidth={lerp(15, 3.5, t)}
            />
          );
        })}
      </g>
      <path d={`M0 ${H} L${W} ${H} L${br} ${bb} L${bl} ${bb} Z`} fill={`url(#${uid}floor)`} />
      <path d={`M${cx - (wide ? 300 : 170)} ${H} L${cx + (wide ? 300 : 170)} ${H} L${cx + bw * 0.16} ${bb} L${cx - bw * 0.16} ${bb} Z`} style={fill("aisle")} />
      <g style={{ stroke: v("joint") }} strokeWidth="2" fill="none">
        <line x1={cx - (wide ? 300 : 170)} y1={H} x2={cx - bw * 0.16} y2={bb} />
        <line x1={cx + (wide ? 300 : 170)} y1={H} x2={cx + bw * 0.16} y2={bb} />
      </g>
      <rect x={bl} y={bb - 4} width={bw} height={30} style={fill("floor-ao")} filter={`url(#${uid}b8)`} />
    </svg>
  );
}

/* ───────────────────────────── atmósfera ───────────────────────────── */

/** Capa de luz por encima de las plantas (modo «screen»). */
function Atmosphere({ variant, W, heroX, uid }: { variant: Variant; W: number; heroX: number; uid: string }) {
  const cx = W / 2;
  const wide = W > 1000;
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
        <radialGradient id={`${uid}pool`}>
          <stop offset="0" style={stop("lamp")} />
          <stop offset="1" style={stop("lamp", 0)} />
        </radialGradient>
        <radialGradient id={`${uid}haze`}>
          <stop offset="0" style={stop("haze")} />
          <stop offset="1" style={stop("haze", 0)} />
        </radialGradient>
        <filter id={`${uid}b18`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="18" />
        </filter>
        <filter id={`${uid}b4`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>

      {/* Foco sobre la planta actual: luz cálida de noche, apenas un velo de día. */}
      <g className={s.lampOnly}>
        <path d={`M${heroX - 26} 0 L${heroX + 26} 0 L${heroX + 250} 960 L${heroX - 250} 960 Z`} fill={`url(#${uid}cone)`} filter={`url(#${uid}b18)`} opacity="0.55" />
      </g>
      <ellipse cx={heroX} cy={945} rx={250} ry={52} fill={`url(#${uid}pool)`} opacity="0.9" />

      {variant === "1" && <ellipse cx={cx} cy={520} rx={wide ? 420 : 300} ry={360} fill={`url(#${uid}haze)`} />}

      {variant === "2" && (
        <>
          <g className={s.sunOnly} filter={`url(#${uid}b18)`}>
            {(wide ? [60, 330, 640, 1000] : [-40, 200, 480]).map((x, i) => (
              <path key={x} d={`M${x} 110 L${x + 90 + i * 10} 110 L${x + 470} ${H} L${x + 330} ${H} Z`} fill={`url(#${uid}beam)`} />
            ))}
          </g>
          <g className={s.nightOnly}>
            <StringLights W={W} uid={uid} />
            <Pendant x={heroX} y={250} uid={uid} />
            <Pendant x={wide ? 385 : 150} y={330} uid={uid} small />
          </g>
          <g className={s.motes} style={fill("mote")}>
            {Array.from({ length: wide ? 16 : 9 }, (_, i) => (
              <circle key={i} cx={(i * 97 + 140) % W} cy={240 + ((i * 131) % 520)} r={1.2 + (i % 3) * 0.6} style={{ animationDelay: `${-i * 1.7}s` }} />
            ))}
          </g>
        </>
      )}

      {variant === "3" && (
        <>
          <ellipse cx={cx} cy={520} rx={wide ? 420 : 260} ry={300} fill={`url(#${uid}haze)`} />
          <rect y={560} width={W} height={140} style={fill("mist")} filter={`url(#${uid}b18)`} />
          <g className={s.sunOnly} filter={`url(#${uid}b18)`}>
            <path d={`M${cx - 260} 0 L${cx - 120} 0 L${cx + 60} 800 L${cx - 120} 800 Z`} fill={`url(#${uid}beam)`} />
            <path d={`M${cx + 80} 0 L${cx + 170} 0 L${cx + 330} 760 L${cx + 200} 760 Z`} fill={`url(#${uid}beam)`} />
          </g>
          <g className={s.nightOnly}>
            {[0.32, 0.56, 0.76].flatMap((t) => {
              const half = (wide ? 300 : 170) * (1 - t) + 70 * t;
              const y = H - (H - 645) * t;
              const r = 70 * (1 - t) + 16 * t;
              return [-1, 1].map((side) => (
                <g key={`${t}${side}`}>
                  <circle cx={cx + side * half} cy={y - r * 0.3} r={r} fill={`url(#${uid}pool)`} />
                  <circle cx={cx + side * half} cy={y - r * 0.32} r={Math.max(2, r * 0.07)} style={fill("bulb")} />
                </g>
              ));
            })}
          </g>
        </>
      )}
    </svg>
  );
}

function StringLights({ W, uid }: { W: number; uid: string }) {
  const swags: ReactNode[] = [];
  for (let x = 0; x < W; x += 400) {
    const x2 = Math.min(x + 400, W);
    const y = 92;
    const sag = 36;
    const pts = Array.from({ length: 8 }, (_, i) => {
      const t = (i + 0.5) / 8;
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
      <circle cx={x} cy={y} r={r * 6} fill={`url(#${uid}pool)`} opacity="0.55" />
      <circle cx={x} cy={y} r={r} style={fill("bulb")} opacity="0.92" />
      <path d={`M${x - r * 0.55} ${y - r * 0.82} A${r} ${r} 0 0 1 ${x + r * 0.55} ${y - r * 0.82}`} style={fill("cord")} />
    </g>
  );
}

/* ───────────────────────────── escena ───────────────────────────── */

const pct = (n: number, of: number) => `${(n / of) * 100}%`;

function SlotEl({ slot, W, heroSpecies, heroStage }: { slot: Slot; W: number; heroSpecies: Species; heroStage: StageKey }) {
  const k = cqhPerCm(slot.z);
  const support = slot.support ?? { kind: "none" };
  const style = {
    left: pct(slot.x, W),
    bottom: pct(H - slot.y, H),
    zIndex: Math.round(slot.y) + (slot.what === "hero" ? 200 : 0),
    ["--z" as string]: Math.max(0, slot.z),
    ["--dof" as string]: `${slot.dof ?? 0}px`,
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
    <div className={s.slot} style={style}>
      {body}
    </div>
  );
}

function FrameEl({ f, W }: { f: Frame; W: number }) {
  const d = PLANT_ASSET_DIMS[f.species].large;
  return (
    <div
      className={s.frame}
      style={{
        left: pct(f.x, W),
        bottom: pct(H - f.y, H),
        height: pct(f.h, H),
        aspectRatio: `${d.w} / ${d.h}`,
        transform: `translateX(-50%) rotate(${f.rot ?? 0}deg) scaleX(${f.flip ? -1 : 1})`,
      }}
      aria-hidden
    >
      <Image src={src(f.species, "planta-completa")} width={d.w} height={d.h} alt="" unoptimized draggable={false} />
    </div>
  );
}

const STAGE_MIN: Record<StageKey, number> = Object.fromEntries(STAGE_OPTIONS.map((o) => [o.key, o.minutes])) as Record<StageKey, number>;
const STAGE_LABEL: Record<StageKey, string> = Object.fromEntries(STAGE_OPTIONS.map((o) => [o.key, o.label])) as Record<StageKey, string>;

function Caption({ species, stage, className }: { species: Species; stage: StageKey; className?: string }) {
  const min = STAGE_MIN[stage];
  return (
    <div className={`${s.caption} ${className ?? ""}`}>
      <p className={s.eyebrow}>Planta actual</p>
      <p className={s.name}>{SPECIES_LABEL[species]}</p>
      <p className={s.latin}>{LATIN[species]}</p>
      <p className={s.meta}>
        {STAGE_LABEL[stage]} · {min} de 150 min
      </p>
      <span className={s.bar}>
        <i style={{ width: `${(min / 150) * 100}%` }} />
      </span>
    </div>
  );
}

function Scene({ variant, narrow, heroSpecies, heroStage }: { variant: Variant; narrow: boolean; heroSpecies: Species; heroStage: StageKey }) {
  const uid = useUid();
  const W = narrow ? 800 : 1600;
  const layout = LAYOUTS[variant][narrow ? "narrow" : "wide"];
  const heroX = layout.slots.find((x) => x.what === "hero")?.x ?? W / 2;
  const Arch = variant === "1" ? ArchA1 : variant === "2" ? ArchA2 : ArchA3;
  return (
    <div className={`${s.sceneWrap} ${narrow ? s.narrowWrap : ""}`}>
      <div className={`${s.scene} ${narrow ? s.narrow : s.wide}`}>
        <Arch W={W} uid={uid} />
        {layout.slots
          .filter((sl) => sl.what !== heroSpecies)
          .map((sl, i) => (
            <SlotEl key={`${variant}${i}`} slot={sl} W={W} heroSpecies={heroSpecies} heroStage={heroStage} />
          ))}
        <Atmosphere variant={variant} W={W} heroX={heroX} uid={`${uid}a`} />
        {layout.frames?.map((f, i) => <FrameEl key={i} f={f} W={W} />)}
        <span className={s.vignette} aria-hidden />
        {!narrow && <Caption species={heroSpecies} stage={heroStage} className={s.captionOver} />}
      </div>
      {narrow && <Caption species={heroSpecies} stage={heroStage} className={s.captionBelow} />}
    </div>
  );
}

/* ───────────────────────────── laboratorio ───────────────────────────── */

export function AtelierLab({ initialVariant }: { initialVariant: Variant }) {
  const [variant, setVariant] = useState<Variant>(initialVariant);
  const [dark, setDark] = useState(false);
  const [phone, setPhone] = useState(false);
  const [heroSpecies, setHeroSpecies] = useState<Species>("monstera");
  const [heroStage, setHeroStage] = useState<StageKey>("planta-joven");

  useEffect(() => {
    // Arranca con el tema de la app; luego el lab lo cambia solo dentro de sí mismo.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(document.documentElement.getAttribute("data-theme") === "dark");
  }, []);

  const pick = (id: Variant) => {
    setVariant(id);
    const url = new URL(window.location.href);
    url.searchParams.set("v", id);
    window.history.replaceState(null, "", url);
  };

  return (
    <div className={`${s.lab} ${s[`v${variant}`]} ${dark ? s.dark : ""}`}>
      {/* De noche, el papel blanco de las láminas (lavados, brillos) se vuelve
          transparente en vez de verse como un halo gris. */}
      <svg width="0" height="0" className={s.defs} aria-hidden>
        <filter id="lab-dewhite" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -3.33 -3.33 -3.33 0 9.1" result="m" />
          <feComposite in="SourceGraphic" in2="m" operator="in" />
        </filter>
      </svg>
      <div className={s.inner}>
        <header className={s.head}>
          <p className={s.kicker}>Laboratorio del jardín · Ronda 2</p>
          <h1 className={s.title}>Atelier Invernadero</h1>
        </header>

        <nav className={s.tabs} aria-label="Variantes">
          {VARIANTS.map((x) => (
            <button key={x.id} type="button" onClick={() => pick(x.id)} className={`${s.tab} ${variant === x.id ? s.tabOn : ""}`} aria-pressed={variant === x.id}>
              <span>{x.name}</span>
              <small>{x.line}</small>
            </button>
          ))}
        </nav>

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
              <Smartphone size={14} /> iPhone
            </button>
          </div>
        </div>

        <div className={s.stageArea}>
          <div className={`${s.desktopOnly} ${phone ? s.hidden : ""}`}>
            <Scene variant={variant} narrow={false} heroSpecies={heroSpecies} heroStage={heroStage} />
          </div>
          <div className={`${s.phoneOnly} ${phone ? s.phoneShown : ""}`}>
            <Scene variant={variant} narrow heroSpecies={heroSpecies} heroStage={heroStage} />
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
        <p className={s.foot}>
          Prototipo sin datos reales. <a href="/garden-lab">Ver ronda 1</a>
        </p>
      </div>
    </div>
  );
}
