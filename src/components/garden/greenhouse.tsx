"use client";

/* El invernadero (F4 · A2 Luz de invernadero): la escena del Jardín.

   La arquitectura y la luz son SVG vectorial; las plantas son las láminas del
   catálogo, integradas con sombra de contacto, sombra proyectada y un sombreado
   enmascarado con su propia silueta. Qué lámina y qué tratamiento lleva cada
   planta (sed, especial) lo decide plant-visual.ts; dónde va cada una,
   scene-layout.ts. Aquí solo se pinta. */

import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Image from "next/image";
import { Droplet } from "lucide-react";
import type { StageKey } from "@/lib/focus-logic";
import { BASE_X, BOTTOM_PAD, PLANT_PAD, ROOT_SPAN } from "@/lib/garden/asset-bounds";
import { plantVisual, type ArtRef } from "@/lib/garden/plant-visual";
import { SCENE_H as H, cqhPerCm, type Anchor, type Bench, type Material, type PlacedPlant, type SceneTemplate, type Support } from "@/lib/garden/scene-layout";
import { SPECIES_SCALE, type Species } from "@/lib/garden/species";
import s from "./greenhouse.module.css";

const v = (name: string) => `var(--${name})`;
const fill = (name: string): CSSProperties => ({ fill: v(name) });
const stop = (name: string, opacity?: number): CSSProperties => ({ stopColor: v(name), stopOpacity: opacity });
const useUid = () => useId().replace(/[^a-zA-Z0-9]/g, "");
const pct = (n: number, of: number) => `${(n / of) * 100}%`;

/* ───────────────────────────── estado que pinta la escena ───────────────────────────── */

export type SceneCare = { thirsty: boolean; fresh: boolean; special: boolean };
export type PlacedWithCare = PlacedPlant & SceneCare & { label: string };
export type SceneHero = {
  species: Species;
  stage: StageKey;
  seed: number;
  thirsty: boolean;
  fresh: boolean;
  label: string;
};

/** Animaciones de un instante: la planta recién regada o recién fertilizada. */
export type SceneMoment = { id: string; kind: "agua" | "especial" } | null;

/** Filtros que vuelven transparente el blanco de las láminas (de noche, todo lo
 *  claro; de día, solo el papel). Se montan una sola vez por página. */
export function GardenFilters() {
  return (
    <svg width="0" height="0" className={s.defs} aria-hidden>
      <filter id="garden-dewhite" colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -3.33 -3.33 -3.33 0 9.1" result="m" />
        <feComposite in="SourceGraphic" in2="m" operator="in" />
      </filter>
      {/* De día, solo el papel casi blanco (lavados, restos de fondo) se vuelve
          transparente; las hojas pálidas se conservan. */}
      <filter id="garden-dewhite-soft" colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -4 -4 -4 0 11.4" result="m" />
        <feComposite in="SourceGraphic" in2="m" operator="in" />
      </filter>
    </svg>
  );
}

/* ───────────────────────────── lámina ───────────────────────────── */

function Lamina({ art, species, seed }: { art: ArtRef; species?: Species; seed?: number }) {
  return (
    <span className={s.lamina} data-species={species} data-seed={seed}>
      <Image src={art.src} width={art.w} height={art.h} alt="" unoptimized draggable={false} className={s.leaf} />
      {/* Sombreado con la silueta de la propia lámina: base más oscura, sin halo. */}
      <span className={s.leafShade} style={{ maskImage: `url(${art.src})`, WebkitMaskImage: `url(${art.src})` }} aria-hidden />
    </span>
  );
}

/** La lámina con las capas de su estado, todas recortadas a su silueta: puntas
 *  secas con sed; color vivo y rocío recién regada. Lo especial (borde dorado)
 *  es un filtro que también sigue el contorno. */
function PlantArt({ art, species, seed, thirsty, fresh, moment }: { art: ArtRef; species: Species; seed: number; thirsty: boolean; fresh: boolean; moment: "agua" | "especial" | null }) {
  const m: CSSProperties = { maskImage: `url(${art.src})`, WebkitMaskImage: `url(${art.src})` };
  return (
    <>
      <Lamina art={art} species={species} seed={seed} />
      {thirsty && <span className={s.tips} style={m} aria-hidden />}
      {(fresh || moment === "agua") && (
        <>
          <span className={s.freshTint} style={m} aria-hidden />
          <span className={s.dew} style={m} aria-hidden />
        </>
      )}
    </>
  );
}

/* ───────────────────────────── macetas y soportes ───────────────────────────── */

const POT_SHAPE = {
  cuenco: { taper: 13, round: 16 },
  media: { taper: 8, round: 5 },
  alta: { taper: 6, round: 4 },
} as const;
const RIM = 11; // semieje vertical de la boca, en unidades de un ancho de 100

/** Maceta en dos capas: la boca (detrás de la planta) y el cuerpo (delante). */
export function Pot({ w, h, shape, material, layer }: { w: number; h: number; shape: keyof typeof POT_SHAPE; material: Material; layer: "back" | "front" }) {
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
      <path d={`M0.8 ${RIM} A49.2 ${RIM} 0 0 0 99.2 ${RIM}`} fill="none" style={{ stroke: v(material === "esmalte" ? "m-esmalte-rim" : m("hi")) }} strokeWidth={material === "esmalte" ? 3.2 : 2.2} />
    </svg>
  );
}

function SupportEl({ support, k }: { support: Support; k: number }) {
  const id = useUid();
  if (support.kind !== "plinth" && support.kind !== "stand") return null;
  const w = support.w * k;
  const h = support.cm * k;
  const vh = (100 * h) / w;
  return (
    <svg className={s.support} style={{ width: `${w}cqh`, height: `${h}cqh` }} viewBox={`0 0 100 ${vh}`} preserveAspectRatio="none" aria-hidden>
      {support.kind === "plinth" ? (
        <>
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
        </>
      ) : (
        <>
          <g style={{ stroke: v("iron") }} strokeWidth="3.2" fill="none" strokeLinecap="round">
            <path d={`M14 ${RIM} L4 ${vh}`} />
            <path d={`M86 ${RIM} L96 ${vh}`} />
            <path d={`M50 ${RIM + 6} L50 ${vh - 1}`} />
            <ellipse cx="50" cy={vh * 0.62} rx="40" ry="4.5" strokeWidth="2" />
          </g>
          <ellipse cx="50" cy={RIM} rx="44" ry={RIM * 0.7} style={fill("iron")} />
        </>
      )}
    </svg>
  );
}

const supportSize = (support: Support, k: number) =>
  support.kind === "plinth" || support.kind === "stand" ? { h: support.cm * k, w: support.w * k } : { h: 0, w: 0 };

/** Dónde se asienta la maceta: el centro de la cara superior del soporte. */
const seatOf = (h: number, w: number) => (h > 0 ? h - ((w * RIM) / 100) * 0.7 : 0);

const Drops = () => (
  <span className={s.drops} aria-hidden>
    <i />
    <i />
    <i />
    <i />
    <i />
  </span>
);

/* ───────────────────────────── unidades ───────────────────────────── */

type UnitProps = {
  species: Species;
  seed: number;
  k: number;
  material: Material;
  support: Support;
  raised?: boolean;
  thirsty: boolean;
  fresh: boolean;
  special: boolean;
  moment: "agua" | "especial" | null;
  /** el botón de la planta: se monta en su zona tocable (ver HIT_CORE) */
  hit?: ReactNode;
};

/** Ancho tocable de una planta, en fracción de su lámina: el centro de la mata,
 *  no el lienzo entero, para que las plantas vecinas no se roben el toque. */
const HIT_CORE = 0.5;

/** Alto de una planta en su maceta y soporte (cqh): la gota de sed va encima. */
function pottedHeight(species: Species, k: number, support: Support): number {
  const sc = SPECIES_SCALE[species];
  return supportSize(support, k).h + (sc.pot ? sc.pot.h * k : 0) + (sc.cm - (sc.pot?.h ?? 0)) * k;
}

/** Planta completada en su maceta (o en su recipiente propio, como pilea y potos). */
function PottedUnit({ species, seed, k, material, support, raised, thirsty, fresh, special, moment, hit }: UnitProps) {
  const stage: StageKey = "planta-completa";
  const look = special ? "especial" : thirsty ? "sed" : "normal";
  const { art } = plantVisual(species, stage, look);
  const sc = SPECIES_SCALE[species];
  const pad = BOTTOM_PAD[species][stage];
  const sup = supportSize(support, k);
  const seat = seatOf(sup.h, sup.w);
  const pot = sc.pot;
  const potW = pot ? pot.w * k : 0;
  const potH = pot ? pot.h * k : 0;
  const ry = (potW * RIM) / 100;
  const plantCm = sc.cm - (pot?.h ?? 0);
  const sinkCm = pot ? Math.max(pot.w * 0.1, plantCm * 0.08) : 0;
  const imgH = ((plantCm + sinkCm) * k) / (1 - pad);
  const imgW = imgH * (art.w / art.h);
  const unitW = Math.max(imgW, potW, sup.w);
  const unitH = pottedHeight(species, k, support);
  const hang = support.kind === "hang";
  const plantBottom = pot ? -(sinkCm * k) - pad * imgH : seat - pad * imgH;
  // El tallo (no el lienzo) va al centro de la maceta.
  const shift = `${-BASE_X[species][stage] * 100}% 0`;
  const plant = (
    <div className={s.plant} style={{ width: `${imgW}cqh`, height: `${imgH}cqh`, bottom: `${plantBottom}cqh`, translate: pot ? undefined : shift }}>
      <PlantArt art={art} species={species} seed={seed} thirsty={thirsty} fresh={fresh} moment={moment} />
    </div>
  );
  return (
    <div className={s.unit} style={{ width: `${unitW}cqh`, height: `${unitH}cqh` }}>
      {special && <span className={s.aura} style={{ width: `${imgW * 1.5}cqh`, height: `${imgH * 1.1}cqh`, bottom: `${seat}cqh` }} aria-hidden />}
      {hang && <span className={s.rope} style={{ bottom: `${imgH * 0.55}cqh` }} aria-hidden />}
      {!hang && <span className={s.contact} style={{ width: `${Math.max(potW, sup.w, imgW * 0.3) * 1.5}cqh`, height: `${Math.max(potW, sup.w, 8 * k) * 0.36}cqh` }} aria-hidden />}
      {!hang && !raised && (
        <span className={s.cast} style={{ width: `${imgW}cqh`, height: `${imgH + sup.h + potH}cqh`, translate: shift }} aria-hidden>
          <Image src={art.src} width={art.w} height={art.h} alt="" unoptimized draggable={false} />
        </span>
      )}
      {sup.h > 0 && <SupportEl support={support} k={k} />}
      {pot && (
        <span className={s.layer} style={{ bottom: `${seat}cqh` }}>
          <Pot w={potW} h={potH} shape={pot.shape} material={material} layer="back" />
        </span>
      )}
      {/* La tierra cuenta el agua: clara y seca con sed, oscura y brillante recién regada. */}
      {pot && <span className={s.soil} style={{ width: `${potW * 0.9}cqh`, height: `${ry * 1.5}cqh`, bottom: `${seat + potH - ry * 1.75}cqh` }} aria-hidden />}
      {pot ? (
        <div className={s.cut} style={{ bottom: `${seat + potH - ry}cqh`, width: `${imgW}cqh`, height: `${imgH}cqh`, translate: shift }}>
          {plant}
        </div>
      ) : (
        plant
      )}
      {pot && (
        <span className={s.layer} style={{ bottom: `${seat}cqh` }}>
          <Pot w={potW} h={potH} shape={pot.shape} material={material} layer="front" />
        </span>
      )}
      {thirsty && !hang && <span className={s.fallen} style={{ width: `${Math.max(potW, 8 * k) * 0.34}cqh`, left: `calc(50% + ${Math.max(potW, 8 * k) * 0.55}cqh)` }} aria-hidden />}
      {moment === "agua" && <Drops />}
      {hit && (
        <span className={s.hitArea} style={{ width: `${Math.max(potW, sup.w, imgW * HIT_CORE)}cqh`, height: `${unitH}cqh` }}>
          {hit}
        </span>
      )}
    </div>
  );
}

/** La planta actual mientras crece: frasco de propagación con agua. Con sed,
 *  el agua baja. */
function JarUnit({ species, seed, stage, k, support, thirsty, fresh, moment, hit, drop }: {
  species: Species;
  seed: number;
  stage: StageKey;
  k: number;
  support: Support;
  thirsty: boolean;
  fresh: boolean;
  moment: "agua" | "especial" | null;
  hit?: ReactNode;
  drop?: ReactNode;
}) {
  const id = useUid();
  const { art } = plantVisual(species, stage, thirsty ? "sed" : "normal");
  const sc = SPECIES_SCALE[species];
  const padFull = BOTTOM_PAD[species]["planta-completa"];
  const pad = PLANT_PAD[species][stage];
  const plantCm = sc.cm - (sc.pot?.h ?? 0);
  const imgH = ((plantCm + 4) * k) / (1 - padFull);
  const imgW = imgH * (art.w / art.h);
  const sup = supportSize(support, k);
  const seat = seatOf(sup.h, sup.w);
  // Nunca más angosto que las raíces de la etapa más ancha que vive en el frasco.
  const jw = Math.max(imgW * Math.max(0.34, ROOT_SPAN[species] * 1.12), 15 * k);
  const jh = Math.min(Math.max(imgH * 0.4, 18 * k), 46 * k);
  const vh = (100 * jh) / jw;
  // Nivel del agua: casi vacío con sed, lleno recién regado.
  const level = thirsty ? 0.14 : fresh || moment === "agua" ? 0.86 : 0.7;
  const water = vh * (1 - level);
  const unitW = Math.max(imgW, jw, sup.w);
  const jarPath = `M2 ${RIM} L2 ${vh - 10} Q2 ${vh} 14 ${vh} L86 ${vh} Q98 ${vh} 98 ${vh - 10} L98 ${RIM}`;
  const waterPath = `M2 ${water} L2 ${vh - 10} Q2 ${vh} 14 ${vh} L86 ${vh} Q98 ${vh} 98 ${vh - 10} L98 ${water} A48 ${RIM * 0.8} 0 0 1 2 ${water} Z`;
  return (
    <div className={s.unit} style={{ width: `${unitW}cqh`, height: `${sup.h + imgH}cqh` }}>
      <span className={s.contact} style={{ width: `${Math.max(jw, sup.w) * 1.5}cqh`, height: `${Math.max(jw, sup.w) * 0.36}cqh` }} aria-hidden />
      {sup.h > 0 && <SupportEl support={support} k={k} />}
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
          <path d={jarPath} fill={`url(#${id}g)`} />
          <path d={waterPath} style={fill("water")} />
        </svg>
      </span>
      {/* La planta se apoya en el fondo del frasco; lo que la lámina dibuje debajo (líneas de suelo) se recorta. */}
      <div className={s.cut} style={{ bottom: `${seat + jh * 0.05}cqh`, width: `${imgW}cqh`, height: `${imgH}cqh`, translate: `${-BASE_X[species][stage] * 100}% 0` }}>
        <div className={s.plant} style={{ width: `${imgW}cqh`, height: `${imgH}cqh`, bottom: `${-pad * imgH}cqh` }}>
          <PlantArt art={art} species={species} seed={seed} thirsty={thirsty} fresh={fresh} moment={moment} />
        </div>
      </div>
      <span className={s.layer} style={{ bottom: `${seat}cqh` }}>
        <svg className={s.pot} style={{ width: `${jw}cqh`, height: `${jh}cqh` }} viewBox={`0 0 100 ${vh}`} preserveAspectRatio="none" aria-hidden>
          <path d={waterPath} style={{ ...fill("water"), opacity: 0.55 }} />
          <ellipse cx="50" cy={water} rx="48" ry={RIM * 0.8} fill="none" style={{ stroke: v("water-line") }} strokeWidth="1.2" />
          {/* Con sed queda la marca de hasta dónde llegaba el agua. */}
          {thirsty && <line x1="3" x2="97" y1={vh * 0.3} y2={vh * 0.3} className={s.residue} />}
          {(fresh || moment === "agua") &&
            [30, 55, 72].map((x, i) => <circle key={x} cx={x} cy={vh - 6} r="2.2" className={s.bubble} style={{ animationDelay: `${i * 0.7}s` }} />)}
          <path d={`M2 ${RIM} A48 ${RIM * 0.8} 0 0 0 98 ${RIM}`} fill="none" style={{ stroke: v("glass-rim") }} strokeWidth="2.4" />
          <path d={`M12 ${RIM + 8} L12 ${vh - 16}`} style={{ stroke: v("glass-hi") }} strokeWidth="3.5" strokeLinecap="round" />
          <path d={`M20 ${RIM + 10} L20 ${vh * 0.45}`} style={{ stroke: v("glass-hi") }} strokeWidth="1.4" strokeLinecap="round" opacity="0.6" />
          <path d={jarPath} fill="none" style={{ stroke: v("glass-edge") }} strokeWidth="1.4" />
        </svg>
      </span>
      {moment === "agua" && <Drops />}
      {/* La gota de sed se apoya sobre el borde del frasco, no en lo alto del lienzo. */}
      {hit && (
        <span className={s.hitArea} style={{ width: `${Math.max(jw, sup.w, imgW * HIT_CORE)}cqh`, height: `${sup.h + imgH}cqh` }}>
          {hit}
        </span>
      )}
      {thirsty && drop && (
        <span className={s.dropAt} style={{ bottom: `${seat + jh + 1.5}cqh` }}>
          {drop}
        </span>
      )}
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
  return (
    <g style={{ stroke: v("joint") }} strokeWidth="1.2">
      {lines}
    </g>
  );
}

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
      {bars.map((x) => (
        <line key={`b${x}`} x1={x} x2={x} y1={top} y2={knee} strokeWidth={2.2 * scale} />
      ))}
      {transoms.map((y) => (
        <line key={`t${y}`} x1={0} x2={W} y1={y} y2={y} strokeWidth={4.5 * scale} />
      ))}
      {posts.map((x) => (
        <line key={`p${x}`} x1={x} x2={x} y1={top} y2={knee} strokeWidth={8 * scale} />
      ))}
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
        {posts.map((x) => (
          <line key={x} x1={x} y1={top} x2={cx + (x - cx) * 1.8} y2={0} strokeWidth="6" />
        ))}
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
        {[620, 648, 676].map((y) => (
          <line key={y} x1={0} x2={W} y1={y} y2={y} />
        ))}
      </g>
      <rect y={knee - 4} width={W} height={13} style={fill("plinth-top")} />
      <rect y={B} width={W} height={H - B} fill={`url(#${uid}floor)`} />
      <FloorJoints W={W} B={B} vpY={360} step={160} rows={[0.1, 0.26, 0.5, 0.84]} />
      <rect y={B} width={W} height={30} style={fill("floor-ao")} filter={`url(#${uid}b8)`} />
      {/* El sol atraviesa el cristal y dibuja la retícula de la herrería en el suelo. */}
      <g transform={project(0.42, 0.5, B)} filter={`url(#${uid}b3)`}>
        <rect y={top} width={W} height={knee - top} mask={`url(#${uid}panes)`} style={fill("sun")} />
      </g>
      {[...benches]
        .sort((a, b) => a.y - b.y)
        .map((b) => (
          <BenchEl key={`${b.l}${b.y}`} b={b} uid={uid} />
        ))}
    </svg>
  );
}

/* ───────────────────────────── luz ───────────────────────────── */

/** Capa de luz por encima de las plantas (modo «screen»). De día, rayos de sol;
 *  de noche, guirnaldas, lámparas y luces secundarias que nunca superan el foco
 *  de la planta actual. */
function Atmosphere({ template, plants, uid }: { template: SceneTemplate; plants: PlacedWithCare[]; uid: string }) {
  const { W, hero } = template;
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
        {plants
          .filter((p) => p.glow)
          .map((p) => {
            const k = cqhPerCm(p.z, template.scale) * 10; // unidades del SVG por cm
            const h = SPECIES_SCALE[p.plant.species].cm * k;
            const w = Math.max(40, (SPECIES_SCALE[p.plant.species].pot?.w ?? 20) * k);
            return p.glow === "up" ? (
              <g key={p.plant.id}>
                <path
                  d={`M${p.x - w * 0.3} ${p.y} L${p.x + w * 0.3} ${p.y} L${p.x + h * 0.32} ${p.y - h * 0.95} L${p.x - h * 0.32} ${p.y - h * 0.95} Z`}
                  fill={`url(#${uid}up)`}
                  filter={`url(#${uid}b10)`}
                  opacity="0.5"
                />
                <ellipse cx={p.x} cy={p.y + 4} rx={w * 1.1} ry={w * 0.22} fill={`url(#${uid}soft)`} />
              </g>
            ) : (
              <ellipse key={p.plant.id} cx={p.x} cy={p.y + 4} rx={w * 2.4} ry={w * 0.5} fill={`url(#${uid}soft)`} />
            );
          })}
        {template.lamps.map((l) => (
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
    swags.push(
      <g key={x}>
        <path d={`M${x} ${y} Q${(x + x2) / 2} ${y + sag * 2} ${x2} ${y}`} fill="none" style={{ stroke: v("cord") }} strokeWidth="1.2" />
        {Array.from({ length: n }, (_, i) => {
          const t = (i + 0.5) / n;
          const px = x + (x2 - x) * t;
          const py = y + 4 * sag * t * (1 - t) + 5;
          return (
            <g key={i}>
              <circle cx={px} cy={py} r="9" style={fill("lamp")} opacity="0.5" filter={`url(#${uid}b4)`} />
              <circle cx={px} cy={py} r="2.6" style={fill("bulb")} />
            </g>
          );
        })}
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

/** Dónde termina, ya dibujada, cada planta con sed (en % del alto de la escena,
 *  desde abajo). La gota se posa ahí y no en lo alto del lienzo: la lámina rara
 *  vez llena su altura y con sed además se encoge, así que una gota calculada
 *  quedaba flotando sobre la planta vecina. Antes de medir se usa el cálculo. */
function useDrawnTops(plants: PlacedWithCare[]) {
  const ref = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<Record<string, number>>({});
  const key = plants
    .filter((p) => p.thirsty)
    .map((p) => p.plant.id)
    .join(",");
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const measure = () => {
      const r = root.getBoundingClientRect();
      if (!r.height) return;
      // La ficha de la planta actual (escritorio) tapa la esquina: una gota que
      // caería debajo baja hasta asomar bajo la ficha.
      const card = (root.querySelector(`.${s.captionOver}`) ?? root.parentElement?.closest("[data-garden-stage]")?.querySelector("[data-scene-cover]"))?.getBoundingClientRect();
      const dropPx = Math.max(22, r.height * 0.042) + 14;
      const next: Record<string, number> = {};
      for (const id of key ? key.split(",") : []) {
        const slot = root.querySelector(`[data-plant-id="${CSS.escape(id)}"]`);
        const art = slot?.querySelector("[data-species]");
        if (!slot || !art) continue;
        let top = art.getBoundingClientRect().top;
        const sr = slot.getBoundingClientRect();
        const x = sr.left + sr.width / 2;
        if (card && x > card.left - dropPx && x < card.right + dropPx && top > card.top && top - dropPx < card.bottom) top = card.bottom + dropPx;
        next[id] = ((r.bottom - top) / r.height) * 100;
      }
      setAt(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    // la caída de la sed es una transición: se vuelve a medir al terminar
    root.addEventListener("transitionend", measure);
    return () => {
      ro.disconnect();
      root.removeEventListener("transitionend", measure);
    };
  }, [key]);
  return [ref, at] as const;
}

/** Gotas sobre todas las plantas y debajo de la ficha de la planta actual. */
const DROP_Z = 1700;

/** La gota de una planta con sed: abre exactamente esa planta. */
function ThirstDrop({ id, label, onSelect }: { id: string; label: string; onSelect?: (id: string | "actual") => void }) {
  return (
    <button
      type="button"
      className={s.badge}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(id);
      }}
      aria-label={label}
      data-testid="garden-thirst-drop"
      data-plant-id={id}
    >
      <Droplet strokeWidth={2} aria-hidden />
    </button>
  );
}

function anchorStyle(a: Anchor, W: number, z: number, extra = 0): CSSProperties {
  return {
    left: pct(a.x, W),
    bottom: pct(H - a.y, H),
    zIndex: Math.round(a.y) + extra,
    ["--z" as string]: Math.max(0, z),
  } as CSSProperties;
}

export function GreenhouseScene({
  template,
  plants,
  hero,
  moment,
  onSelect,
  caption,
  className,
  label,
}: {
  template: SceneTemplate;
  plants: PlacedWithCare[];
  /** null = esta escena no lleva la planta actual */
  hero: SceneHero | null;
  moment: SceneMoment;
  onSelect?: (id: string | "actual") => void;
  caption?: ReactNode;
  className?: string;
  label: string;
}) {
  const uid = useUid();
  const { W } = template;
  const momentFor = (id: string) => (moment?.id === id ? moment.kind : null);
  const [sceneRef, drawnTop] = useDrawnTops(plants);
  return (
    <div ref={sceneRef} className={`${s.garden} ${s.scene} ${className ?? ""}`} style={{ aspectRatio: `${W} / ${H}` }} role="group" aria-label={label}>
      <Greenhouse W={W} benches={template.benches} uid={uid} />

      {/* Cada planta es un contenedor que no recibe toques: solo su botón (el
          centro de la mata) y su gota. Así una lámina ancha no tapa a la vecina. */}
      {plants.map((p) => {
        const k = cqhPerCm(p.z, template.scale);
        const m = momentFor(p.plant.id);
        return (
          <div
            key={p.plant.id}
            className={`${s.slot} ${p.glow ? s.lit : ""} ${p.thirsty ? s.thirsty : ""} ${p.special ? s.special : ""} ${p.fresh ? s.fresh : ""} ${m === "agua" ? s.revive : ""} ${m === "especial" ? s.justSpecial : ""}`}
            style={anchorStyle(p, W, p.z)}
            data-testid="garden-room-plant"
            data-plant-id={p.plant.id}
            data-thirsty={p.thirsty || undefined}
            data-special={p.special || undefined}
          >
            <PottedUnit
              species={p.plant.species}
              seed={p.plant.seed}
              k={k}
              material={p.material}
              support={p.support ?? { kind: "none" }}
              raised={p.raised}
              thirsty={p.thirsty}
              fresh={p.fresh}
              special={p.special}
              moment={m}
              hit={<button type="button" className={s.pick} onClick={() => onSelect?.(p.plant.id)} aria-label={p.label} />}
            />
          </div>
        );
      })}

      {hero && template.hero && (
        <div
          className={`${s.slot} ${s.hero} ${hero.thirsty ? s.thirsty : ""} ${momentFor("actual") === "agua" ? s.revive : ""}`}
          style={anchorStyle(template.hero, W, template.hero.z, 200)}
          data-testid="garden-room-current"
          data-thirsty={hero.thirsty || undefined}
        >
          <JarUnit
            species={hero.species}
            seed={hero.seed}
            stage={hero.stage}
            k={cqhPerCm(template.hero.z, template.scale)}
            support={template.hero.support ?? { kind: "none" }}
            thirsty={hero.thirsty}
            fresh={hero.fresh}
            moment={momentFor("actual")}
            hit={<button type="button" className={s.pick} onClick={() => onSelect?.("actual")} aria-label={hero.label} />}
            drop={<ThirstDrop id="actual" label={hero.label} onSelect={onSelect} />}
          />
        </div>
      )}

      {/* Las gotas de sed van en su propia capa, encima de todas las plantas: una
          gota nunca queda debajo de la lámina de una vecina. */}
      {plants
        .filter((p) => p.thirsty)
        .map((p) => {
          const top = drawnTop[p.plant.id];
          const h = pottedHeight(p.plant.species, cqhPerCm(p.z, template.scale), p.support ?? { kind: "none" });
          const bottom = top === undefined ? `calc(${pct(H - p.y, H)} + ${h + 0.6}cqh)` : `calc(${top}% + 0.6cqh)`;
          return (
            <span key={p.plant.id} className={s.dropAt} style={{ left: pct(p.x, W), bottom, zIndex: DROP_Z }}>
              <ThirstDrop id={p.plant.id} label={p.label} onSelect={onSelect} />
            </span>
          );
        })}

      {template.mystery && (
        <div className={`${s.slot} ${s.still}`} style={anchorStyle(template.mystery, W, template.mystery.z)} aria-hidden>
          <Mystery k={cqhPerCm(template.mystery.z, template.scale)} />
        </div>
      )}

      <Atmosphere template={template} plants={plants} uid={`${uid}a`} />
      <span className={s.vignette} aria-hidden />
      {caption && <div className={s.captionOver}>{caption}</div>}
    </div>
  );
}

export { s as greenhouseStyles };
