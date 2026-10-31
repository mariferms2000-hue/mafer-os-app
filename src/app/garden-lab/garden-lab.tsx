"use client";

/* Laboratorio visual del Jardín (F4 · Bloque 1).

   Cuatro direcciones de arte sobre el MISMO jardín ficticio, con estados
   simulados de Agua y Fertilizante. Todo vive en memoria: no lee ni escribe la
   base, no usa recompensas reales y no toca /biblioteca/jardin. */

import { useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import { Droplet, Sparkles, Ruler, Sun, Moon } from "lucide-react";
import type { StageKey } from "@/lib/focus-logic";
import { PLANT_ASSET_DIMS, plantAssetPath } from "@/lib/plant-assets";
import { SPECIES_LABEL } from "@/lib/plant-svg-v2";
import {
  DEMO_COMPLETED,
  DIRECTIONS,
  HERO_ID,
  LAYOUTS,
  SPECIES_ORDER,
  SPECIES_SCALE,
  STAGE_OPTIONS,
  SURF,
  TIER_LABEL,
  cqhPerCm,
  type Direction,
  type Slot,
  type Species,
  type Support,
} from "./lab-data";
import { BOTTOM_PAD } from "./asset-bounds";
import s from "./garden-lab.module.css";

type Hydration = "ok" | "sed" | "regando";

/* ── Versión especial por especie (prototipo con las láminas actuales) ──
   Copias de la misma lámina detrás de la principal = follaje más abundante;
   flores dibujadas con CSS para las especies que florecen. El arte final de
   cada versión especial sería una lámina nueva por especie. */
type Copy = { x: number; y: number; s: number; r: number; flip?: boolean; clip?: string };
const SPECIAL: Record<Species, { copies: Copy[]; blooms?: [number, number, number][]; tint?: string }> = {
  monstera: { copies: [{ x: -30, y: 4, s: 0.86, r: -10, flip: true }, { x: 30, y: 6, s: 0.8, r: 9 }, { x: 0, y: -14, s: 0.7, r: 0, flip: true }] },
  lavanda: {
    copies: [{ x: -24, y: 3, s: 0.9, r: -7, flip: true }, { x: 24, y: 3, s: 0.88, r: 7 }],
    tint: "saturate(2.4) hue-rotate(-6deg)",
  },
  cactus: { copies: [], blooms: [[50, 4, 13], [29, 27, 11], [77, 37, 11], [62, 12, 8]] },
  helecho: { copies: [{ x: -22, y: 6, s: 0.9, r: -12, flip: true }, { x: 22, y: 6, s: 0.9, r: 12 }] },
  suculenta: { copies: [{ x: -42, y: 30, s: 0.42, r: -4 }, { x: 44, y: 32, s: 0.38, r: 6, flip: true }], blooms: [[50, 8, 9]] },
  olivo: { copies: [{ x: -14, y: -4, s: 0.85, r: -6, flip: true, clip: "inset(0 0 45% 0)" }, { x: 16, y: -2, s: 0.8, r: 6, clip: "inset(0 0 45% 0)" }] },
  bambu: { copies: [{ x: -22, y: 0, s: 0.92, r: -2, flip: true }, { x: 22, y: 2, s: 0.86, r: 3 }] },
  potos: { copies: [{ x: -8, y: 26, s: 0.95, r: -4, clip: "inset(48% 0 0 0)" }, { x: 10, y: 40, s: 0.9, r: 5, flip: true, clip: "inset(48% 0 0 0)" }] },
  sansevieria: { copies: [{ x: -20, y: 4, s: 0.82, r: -6, flip: true }, { x: 20, y: 5, s: 0.78, r: 6 }] },
  pilea: { copies: [{ x: -22, y: -6, s: 0.8, r: -8, clip: "inset(0 0 42% 0)" }, { x: 22, y: -8, s: 0.78, r: 8, flip: true, clip: "inset(0 0 42% 0)" }, { x: 0, y: -18, s: 0.66, r: 0, clip: "inset(0 0 42% 0)" }] },
  palmera: { copies: [{ x: -24, y: 8, s: 0.78, r: -10, flip: true }, { x: 24, y: 10, s: 0.74, r: 10 }] },
  eucalipto: { copies: [{ x: -20, y: 2, s: 0.88, r: -8, flip: true }, { x: 20, y: 4, s: 0.84, r: 8 }] },
};

const MATERIAL: Record<Species, string> = {
  suculenta: s.terracota, cactus: s.terracota, lavanda: s.terracota,
  monstera: s.marfil, helecho: s.marfil, pilea: s.marfil, potos: s.marfil,
  sansevieria: s.piedra, bambu: s.piedra,
  palmera: s.salvia, olivo: s.salvia, eucalipto: s.salvia,
};

/** Las dos láminas (claro/oscuro); el tema activo decide cuál se ve. */
function Lamina({ species, stage, className, style }: { species: Species; stage: StageKey; className?: string; style?: CSSProperties }) {
  const d = PLANT_ASSET_DIMS[species].large;
  return (
    <span className={`${s.lamina} ${className ?? ""}`} style={style}>
      <Image src={plantAssetPath(species, stage, "light", "large")} width={d.w} height={d.h} alt="" unoptimized className="plant-illus-light h-full w-full object-contain object-bottom" />
      <Image src={plantAssetPath(species, stage, "dark", "large")} width={d.w} height={d.h} alt="" unoptimized className="plant-illus-dark h-full w-full object-contain object-bottom" />
    </span>
  );
}

/** Planta + maceta, medida en cqh de la escena que la contiene. */
function PlantUnit({
  species,
  stage,
  k,
  hydration,
  special,
  revive,
  vessel = false,
}: {
  species: Species;
  stage: StageKey;
  /** cqh por cm */
  k: number;
  hydration: Hydration;
  special: boolean;
  revive: boolean;
  /** planta en crecimiento: vive en un frasco de propagación con agua */
  vessel?: boolean;
}) {
  if (vessel) return <VesselUnit species={species} stage={stage} k={k} hydration={hydration} revive={revive} />;
  const sc = SPECIES_SCALE[species];
  const d = PLANT_ASSET_DIMS[species].large;
  const H = sc.cm * k;
  const ph = sc.pot ? sc.pot.h * k : 0;
  const pw = sc.pot ? sc.pot.w * k : 0;
  const sink = ph * 0.32;
  const imgH = H - ph + sink;
  const imgW = imgH * (d.w / d.h);
  const rimH = pw * 0.24;
  const unitW = Math.max(imgW, pw);
  const sp = SPECIAL[species];
  const mature = stage === "planta-completa";
  const showSpecial = special && mature;

  return (
    <div
      className={`${s.unit} ${hydration === "sed" ? s.sed : ""} ${hydration === "regando" ? s.regando : ""} ${revive ? s.revive : ""} ${showSpecial ? s.special : ""} ${showSpecial ? s.esmalte : MATERIAL[species]}`}
      style={{ width: `${unitW}cqh`, height: `${H}cqh` }}
      data-species={species}
    >
      {showSpecial && <span className={s.aura} aria-hidden />}
      {sc.pot && (
        <span
          className={s.potBack}
          style={{ width: `${pw}cqh`, height: `${rimH}cqh`, bottom: `${ph - rimH / 2}cqh` }}
          aria-hidden
        />
      )}
      <div className={s.plantWrap} style={{
          height: `${imgH}cqh`,
          width: `${imgW}cqh`,
          bottom: `${ph - sink}cqh`,
          // corta raíces y tierra de la lámina a la altura de la boca de la maceta
          ["--cut" as string]: `${sink + rimH * 0.12}cqh`,
        }}
      >
        {showSpecial &&
          sp.copies.map((c, i) => (
            <Lamina
              key={i}
              species={species}
              stage={stage}
              className={s.copy}
              style={{
                transform: `translate(${c.x}%, ${c.y}%) rotate(${c.r}deg) scale(${c.flip ? -c.s : c.s}, ${c.s})`,
                clipPath: c.clip,
              }}
            />
          ))}
        <Lamina species={species} stage={stage} className={s.main} style={showSpecial && sp.tint ? { filter: sp.tint } : undefined} />
        {showSpecial &&
          sp.blooms?.map(([x, y, size], i) => (
            <span key={i} className={s.bloom} style={{ left: `${x}%`, top: `${y}%`, width: `${size}%` }} aria-hidden />
          ))}
        {revive && (
          <span
            className={s.sheen}
            style={{ maskImage: `url(${plantAssetPath(species, stage, "light", "large")})`, WebkitMaskImage: `url(${plantAssetPath(species, stage, "light", "large")})` }}
            aria-hidden
          />
        )}
      </div>
      {sc.pot && (
        <span
          className={`${s.potFront} ${s[`forma_${sc.pot.shape}`]}`}
          style={{ width: `${pw}cqh`, height: `${ph}cqh`, ["--rim" as string]: `${rimH}cqh` }}
          aria-hidden
        >
          <b />
          <i />
        </span>
      )}
      {hydration === "regando" && (
        <span className={s.drops} aria-hidden>
          <i /><i /><i /><i /><i />
        </span>
      )}
    </div>
  );
}

/** La planta actual mientras crece: frasco de cristal con agua, raíces a la
 *  vista. Al completarse pasaría a su maceta definitiva. */
function VesselUnit({ species, stage, k, hydration, revive }: { species: Species; stage: StageKey; k: number; hydration: Hydration; revive: boolean }) {
  const sc = SPECIES_SCALE[species];
  const d = PLANT_ASSET_DIMS[species].large;
  const imgH = sc.cm * k * 0.92;
  const imgW = imgH * (d.w / d.h);
  const vw = Math.max(imgW * 0.34, 14 * k);
  const vh = imgH * 0.46;
  const base = vh * 0.05;
  return (
    <div
      className={`${s.unit} ${hydration === "sed" ? s.sed : ""} ${hydration === "regando" ? s.regando : ""} ${revive ? s.revive : ""}`}
      style={{ width: `${Math.max(imgW, vw)}cqh`, height: `${imgH}cqh` }}
      data-species={species}
    >
      <span className={s.vesselBack} style={{ width: `${vw}cqh`, height: `${vh}cqh` }} aria-hidden />
      <div
        className={s.plantWrap}
        style={{ height: `${imgH}cqh`, width: `${imgW}cqh`, bottom: `${base - BOTTOM_PAD[species][stage] * imgH}cqh` }}
      >
        <Lamina species={species} stage={stage} className={s.main} />
        {revive && (
          <span
            className={s.sheen}
            style={{ maskImage: `url(${plantAssetPath(species, stage, "light", "large")})`, WebkitMaskImage: `url(${plantAssetPath(species, stage, "light", "large")})` }}
            aria-hidden
          />
        )}
      </div>
      <span className={s.vesselFront} style={{ width: `${vw}cqh`, height: `${vh}cqh` }} aria-hidden>
        <i />
      </span>
      {hydration === "regando" && (
        <span className={s.drops} aria-hidden>
          <i /><i /><i /><i /><i />
        </span>
      )}
    </div>
  );
}

function SupportEl({ support, k }: { support: Support; k: number }) {
  if (support.kind === "none" || support.kind === "hang") return null;
  const style = { height: `${support.cm * k}cqh`, width: `${support.w * k}cqh` };
  return <span className={`${s.support} ${s[`sup_${support.kind}`]}`} style={style} aria-hidden />;
}

function Mystery({ k }: { k: number }) {
  return (
    <div className={`${s.mystery} ${s.marfil}`} style={{ width: `${22 * k}cqh`, height: `${22 * k}cqh` }}>
      <span className={s.mysteryVeil} />
      <span className={`${s.potFront} ${s.forma_cuenco} ${s.marfil}`} style={{ width: `${20 * k}cqh`, height: `${11 * k}cqh`, ["--rim" as string]: `${4.4 * k}cqh` }}>
        <b />
        <i />
      </span>
      <span className={s.mysteryTag}>?</span>
    </div>
  );
}

type SceneState = {
  heroSpecies: Species;
  heroStage: StageKey;
  hydration: Record<string, Hydration>;
  revive: Record<string, boolean>;
  specialId: string | null;
  showScale: boolean;
  onPlant: (id: string) => void;
};

function SlotEl({ slot, st }: { slot: Slot; st: SceneState }) {
  const k = cqhPerCm(slot.z);
  const support = slot.support ?? { kind: "none" };
  const zIndex = Math.round((1 - slot.z) * 100) + (slot.plant === HERO_ID ? 20 : 0);
  const depth: CSSProperties = {
    left: `${slot.x}%`,
    top: `${support.kind === "hang" ? support.drop : slot.y}%`,
    zIndex,
    ["--haze" as string]: String(Math.max(0, slot.z - 0.35) * 0.55),
  };

  if (slot.plant === "misterio") {
    return (
      <div className={s.slot} style={depth} title="Próxima especie: sorpresa">
        <Mystery k={k} />
        <SupportEl support={support} k={k} />
        <span className={s.contact} aria-hidden />
      </div>
    );
  }

  const isHero = slot.plant === HERO_ID;
  const plant = DEMO_COMPLETED.find((p) => p.id === slot.plant);
  const species: Species = isHero ? st.heroSpecies : plant!.species;
  const stage: StageKey = isHero ? st.heroStage : "planta-completa";
  const hyd = st.hydration[slot.plant] ?? "ok";
  const sc = SPECIES_SCALE[species];

  return (
    <div className={`${s.slot} ${isHero ? s.hero : ""}`} style={depth}>
      {support.kind === "hang" && <span className={s.rope} aria-hidden />}
      <button
        type="button"
        className={s.plantBtn}
        onClick={() => st.onPlant(slot.plant)}
        aria-label={`${SPECIES_LABEL[species]}${hyd === "sed" ? " · tiene sed" : ""}`}
      >
        <PlantUnit
          species={species}
          stage={stage}
          k={k}
          hydration={hyd}
          special={st.specialId === slot.plant}
          revive={!!st.revive[slot.plant]}
          vessel={isHero && stage !== "planta-completa"}
        />
        {hyd === "sed" && (
          <span className={s.thirstMark} aria-hidden>
            <Droplet size={10} />
          </span>
        )}
      </button>
      <SupportEl support={support} k={k} />
      {support.kind !== "hang" && <span className={s.contact} aria-hidden />}
      {st.showScale && (
        <span className={s.scaleTag}>
          {TIER_LABEL[sc.tier]} · {sc.cm} cm
        </span>
      )}
    </div>
  );
}

/* ── Decorado de cada dirección (solo CSS) ── */

function DecorA({ narrow }: { narrow: boolean }) {
  return (
    <>
      <span className={s.aGlass} />
      <span className={s.aRoof} />
      <span className={s.aOutside} />
      <span className={s.aStemWall} />
      <span className={s.floor}><span className={s.aTiles} /></span>
      <span className={s.aShaft} />
      {!narrow && (
        <span className={s.aEtagere}>
          {SURF.A.etagere.map((y) => (
            <i key={y} style={{ top: `${y}%` }} />
          ))}
        </span>
      )}
    </>
  );
}

function DecorB({ narrow }: { narrow: boolean }) {
  return (
    <>
      <span className={s.bWall} />
      <span className={s.bWindow} style={narrow ? { left: "30%", width: "52%", top: "10%", height: "40%" } : undefined}>
        <i />
      </span>
      <span className={s.bCurtain} style={narrow ? { left: "18%" } : undefined} />
      <span className={s.floor}><span className={s.bPlanks} /></span>
      <span className={s.bSun} style={narrow ? { left: "26%" } : undefined} />
      <span className={s.bRug} />
      {!narrow && (
        <span className={s.bLadder}>
          {SURF.B.ladder.map((y) => (
            <i key={y} style={{ top: `${y}%` }} />
          ))}
        </span>
      )}
    </>
  );
}

function DecorC({ narrow }: { narrow: boolean }) {
  return (
    <>
      <span className={s.cCyclo} />
      <span className={s.cNiche} style={narrow ? { width: "56%" } : undefined} />
      <span className={s.cSpot} />
      <span className={s.cShelf} style={narrow ? { top: `${33}%`, left: "4%", width: "34%" } : { top: `${SURF.C.shelf}%` }} />
    </>
  );
}

function DecorD({ narrow }: { narrow: boolean }) {
  const arches = narrow ? [20, 50, 80] : [9, 29.5, 50, 70.5, 91];
  return (
    <>
      <span className={s.dWall} />
      {arches.map((x) => {
        const edge = Math.abs(x - 50) / 50;
        return (
          <span
            key={x}
            className={s.dArch}
            style={{
              left: `${x}%`,
              width: `${(narrow ? 26 : 17) - edge * 3}%`,
              top: `${6 + edge * 6}%`,
              height: `${58 - edge * 8}%`,
              ["--dim" as string]: String(edge * 0.35),
            }}
          >
            <i />
          </span>
        );
      })}
      <span className={s.dDome} />
      <span className={s.floor} />
      {SURF.D.steps.map((y, i) => (
        <span key={y} className={s.dStep} style={{ top: `${y}%`, left: `${8 - i * 3}%`, right: `${8 - i * 3}%` }} />
      ))}
    </>
  );
}

function ForegroundD() {
  return (
    <>
      <span className={`${s.dFore} ${s.dForeL}`}><Lamina species="monstera" stage="planta-completa" /></span>
      <span className={`${s.dFore} ${s.dForeR}`}><Lamina species="helecho" stage="planta-completa" /></span>
    </>
  );
}

function Scene({ dir, narrow, st }: { dir: Direction; narrow: boolean; st: SceneState }) {
  const slots = LAYOUTS[dir][narrow ? "narrow" : "wide"];
  const label = STAGE_OPTIONS.find((o) => o.key === st.heroStage)!;
  return (
    <div className={`${s.scene} ${s[`dir${dir}`]} ${narrow ? s.narrow : s.wide}`}>
      {dir === "A" && <DecorA narrow={narrow} />}
      {dir === "B" && <DecorB narrow={narrow} />}
      {dir === "C" && <DecorC narrow={narrow} />}
      {dir === "D" && <DecorD narrow={narrow} />}
      <span className={s.heroGlow} style={{ left: `${slots.find((x) => x.plant === HERO_ID)!.x}%` }} aria-hidden />
      {slots.map((slot) => (
        <SlotEl key={slot.plant} slot={slot} st={st} />
      ))}
      {dir === "D" && <ForegroundD />}
      <span className={s.vignette} aria-hidden />
      <div className={s.caption}>
        <p className={s.captionEyebrow}>Planta actual</p>
        <p className={s.captionTitle}>{SPECIES_LABEL[st.heroSpecies]}</p>
        <p className={s.captionMeta}>
          {label.label} · {label.minutes} de 150 min
        </p>
        <span className={s.captionBar}>
          <i style={{ width: `${(label.minutes / 150) * 100}%` }} />
        </span>
      </div>
    </div>
  );
}

/* ── Comparador de estados ── */

const STATES: { key: string; label: string; hint: string; hyd: Hydration; special: boolean }[] = [
  { key: "hidratada", label: "Hidratada", hint: "Viva, saturada, erguida", hyd: "ok", special: false },
  { key: "sed", label: "Con sed", hint: "Apagada y algo vencida", hyd: "sed", special: false },
  { key: "madura", label: "Madura", hint: "Planta completa normal", hyd: "ok", special: false },
  { key: "especial", label: "Especial", hint: "Con Fertilizante", hyd: "ok", special: true },
];

function Compare({ species, dir }: { species: Species; dir: Direction }) {
  const sc = SPECIES_SCALE[species];
  // Cada tarjeta encuadra la especie entera: 62 % del alto para la planta.
  const k = 62 / sc.cm;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {STATES.map((x) => (
        <figure key={x.key} className={`${s.compareCard} ${s[`dir${dir}`]}`}>
          <div className={s.compareStage}>
            <span className={s.compareBackdrop} />
            <div className={s.slot} style={{ left: "50%", top: "86%", zIndex: 2, ["--haze" as string]: "0" }}>
              <PlantUnit species={species} stage="planta-completa" k={k} hydration={x.hyd} special={x.special} revive={false} />
              <span className={s.contact} aria-hidden />
            </div>
          </div>
          <figcaption className="px-3 py-2">
            <p className="text-sm text-forest-deep font-medium">{x.label}</p>
            <p className="text-xs text-stone">{x.hint}</p>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

/* ── El laboratorio ── */

const THIRSTY_DEMO = [HERO_ID, "p-helecho", "p-lavanda", "p-palmera", "p-pilea"];

export function GardenLab({ initialDir }: { initialDir: Direction }) {
  const [dir, setDir] = useState<Direction>(initialDir);
  const [heroSpecies, setHeroSpecies] = useState<Species>("monstera");
  const [heroStage, setHeroStage] = useState<StageKey>("planta-joven");
  const [hydration, setHydration] = useState<Record<string, Hydration>>({});
  const [revive, setRevive] = useState<Record<string, boolean>>({});
  const [specialId, setSpecialId] = useState<string | null>("p-cactus");
  const [mode, setMode] = useState<"regar" | "fertilizar">("regar");
  const [agua, setAgua] = useState(4);
  const [showScale, setShowScale] = useState(false);
  const [compareSpecies, setCompareSpecies] = useState<Species>("monstera");
  const [note, setNote] = useState<string>("Toca una planta con sed para regarla.");
  const [dark, setDark] = useState(false);
  const timers = useRef<number[]>([]);

  function pickDir(d: Direction) {
    setDir(d);
    const url = new URL(window.location.href);
    url.searchParams.set("d", d);
    window.history.replaceState(null, "", url);
  }

  function water(id: string) {
    if ((hydration[id] ?? "ok") !== "sed") {
      setNote("Esta planta está bien: no gasta Agua.");
      return;
    }
    if (agua <= 0) {
      setNote("Sin Agua en el inventario. La planta espera tranquila, no empeora.");
      return;
    }
    setAgua((n) => n - 1);
    setHydration((h) => ({ ...h, [id]: "regando" }));
    setNote("Regando…");
    timers.current.push(
      window.setTimeout(() => {
        setHydration((h) => ({ ...h, [id]: "ok" }));
        setRevive((r) => ({ ...r, [id]: true }));
        setNote("Se recuperó. −1 Agua.");
      }, 900),
      window.setTimeout(() => setRevive((r) => ({ ...r, [id]: false })), 2600)
    );
  }

  function fertilize(id: string) {
    const isHero = id === HERO_ID;
    if (isHero && heroStage !== "planta-completa") {
      setNote("El Fertilizante solo se aplica a plantas completas.");
      return;
    }
    setSpecialId((prev) => (prev === id ? null : id));
    setNote(specialId === id ? "Volvió a su versión normal." : "Versión especial activa (solo una a la vez).");
  }

  function onPlant(id: string) {
    if (mode === "regar") water(id);
    else fertilize(id);
  }

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
  }

  const st: SceneState = { heroSpecies, heroStage, hydration, revive, specialId, showScale, onPlant };
  const anyThirsty = Object.values(hydration).some((h) => h === "sed");

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-8 py-6 md:py-10">
      <header className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <p className="section-eyebrow">Laboratorio · F4 · solo preview</p>
          <h1 className="text-3xl md:text-4xl text-forest-deep mt-1">Jardín — direcciones visuales</h1>
          <p className="text-sm text-stone mt-1 max-w-2xl">
            Las cuatro escenas usan las mismas 12 plantas ficticias. Nada se guarda ni toca tus datos.
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={toggleTheme}>
          {dark ? <Sun size={15} aria-hidden /> : <Moon size={15} aria-hidden />} {dark ? "Claro" : "Oscuro"}
        </button>
      </header>

      {/* Selector de dirección */}
      <div className={s.dirTabs} role="tablist" aria-label="Dirección visual">
        {DIRECTIONS.map((d) => (
          <button
            key={d.key}
            type="button"
            role="tab"
            aria-selected={dir === d.key}
            className={`${s.dirTab} ${dir === d.key ? s.dirTabOn : ""}`}
            onClick={() => pickDir(d.key)}
          >
            <span className={s.dirKey}>{d.key}</span>
            <span className="min-w-0">
              <span className="block text-sm font-medium truncate">{d.name}</span>
              <span className="hidden md:block text-xs opacity-75 truncate">{d.line}</span>
            </span>
          </button>
        ))}
      </div>

      {/* Escena */}
      <div className="hidden md:block">
        <Scene dir={dir} narrow={false} st={st} />
      </div>
      <div className="md:hidden">
        <Scene dir={dir} narrow st={st} />
      </div>
      <p className="text-xs text-stone-soft mt-2" aria-live="polite">
        {note}
      </p>

      {/* Controles */}
      <div className="grid gap-4 md:grid-cols-2 mt-5">
        <section className="card p-4">
          <p className="section-eyebrow mb-2">Planta actual (Pomodoro)</p>
          <div className="flex flex-wrap gap-1.5">
            {SPECIES_ORDER.map((sp) => (
              <button key={sp} type="button" className={`chip ${heroSpecies === sp ? "chip-on" : ""}`} onClick={() => setHeroSpecies(sp)}>
                {SPECIES_LABEL[sp]}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {STAGE_OPTIONS.map((o) => (
              <button key={o.key} type="button" className={`chip ${heroStage === o.key ? "chip-on" : ""}`} onClick={() => setHeroStage(o.key)}>
                {o.label}
              </button>
            ))}
          </div>
          <button type="button" className={`chip mt-3 ${showScale ? "chip-on" : ""}`} onClick={() => setShowScale((v) => !v)}>
            <Ruler size={12} aria-hidden /> Ver escala por especie
          </button>
        </section>

        <section className="card p-4">
          <p className="section-eyebrow mb-2">Agua y Fertilizante (simulado)</p>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={`chip ${mode === "regar" ? "chip-on" : ""}`} onClick={() => setMode("regar")}>
              <Droplet size={12} aria-hidden /> Tocar = regar
            </button>
            <button type="button" className={`chip ${mode === "fertilizar" ? "chip-on" : ""}`} onClick={() => setMode("fertilizar")}>
              <Sparkles size={12} aria-hidden /> Tocar = fertilizar
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setHydration(Object.fromEntries(THIRSTY_DEMO.map((id) => [id, "sed" as Hydration])));
                setNote("5 plantas con sed. Toca una para regarla.");
              }}
            >
              Simular sed
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={!anyThirsty}
              onClick={() => {
                setHydration({});
                setNote("Todo hidratado (sin gastar Agua).");
              }}
            >
              Restablecer
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setAgua(4)}>
              Agua: {agua}
            </button>
          </div>
          <p className="text-xs text-stone mt-3">
            Especial activa:{" "}
            <strong className="text-forest-deep">
              {specialId === null
                ? "ninguna"
                : SPECIES_LABEL[specialId === HERO_ID ? heroSpecies : DEMO_COMPLETED.find((p) => p.id === specialId)!.species]}
            </strong>
            . Fertilizar otra mueve la versión especial; tocar la misma la retira.
          </p>
        </section>
      </div>

      {/* Comparador */}
      <section className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <h2 className="section-eyebrow">Estados de una planta</h2>
          <div className="flex flex-wrap gap-1.5">
            {SPECIES_ORDER.map((sp) => (
              <button key={sp} type="button" className={`chip ${compareSpecies === sp ? "chip-on" : ""}`} onClick={() => setCompareSpecies(sp)}>
                {SPECIES_LABEL[sp]}
              </button>
            ))}
          </div>
        </div>
        <Compare species={compareSpecies} dir={dir} />
      </section>

      {/* Escala */}
      <section className="mt-8">
        <h2 className="section-eyebrow mb-3">Sistema de escala</h2>
        <div className={s.scaleRow}>
          {SPECIES_ORDER.map((sp) => {
            const k = 0.42;
            return (
              <div key={sp} className={s.scaleItem}>
                <div className={s.scaleStage}>
                  <div className={s.slot} style={{ left: "50%", top: "100%", zIndex: 1, ["--haze" as string]: "0" }}>
                    <PlantUnit species={sp} stage="planta-completa" k={k} hydration="ok" special={false} revive={false} />
                  </div>
                </div>
                <p className="text-xs text-forest-deep mt-1">{SPECIES_LABEL[sp]}</p>
                <p className="text-[11px] text-stone-soft">
                  {TIER_LABEL[SPECIES_SCALE[sp].tier]} · {SPECIES_SCALE[sp].cm} cm
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
