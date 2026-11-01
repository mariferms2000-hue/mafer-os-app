"use client";

/* Laboratorio de cuidado (F4 · pulido): cómo se ve una planta con sed, recién
   regada y especial, con 4 especies representativas. Las láminas son las
   actuales; todo el efecto sale de capas enmascaradas con la silueta de la
   propia lámina, así ningún efecto se sale del contorno de la planta. */

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import Image from "next/image";
import { RotateCcw, Sun, Moon } from "lucide-react";
import type { StageKey } from "@/lib/focus-logic";
import { BASE_X, BOTTOM_PAD, PLANT_PAD, ROOT_SPAN } from "@/lib/garden/asset-bounds";
import { baseArt } from "@/lib/garden/plant-visual";
import { SPECIES_SCALE, type Species } from "@/lib/garden/species";
import { GardenFilters, Pot, greenhouseStyles } from "@/components/garden/greenhouse";
import s from "./care-lab.module.css";

type Look = "normal" | "sed" | "regada" | "especial";
const LOOKS: { id: Look; label: string; note: string }[] = [
  { id: "normal", label: "Normal", note: "Hidratada" },
  { id: "sed", label: "Con sed", note: "Seca, caída, apagada" },
  { id: "regada", label: "Recién regada", note: "1 Agua" },
  { id: "especial", label: "Especial", note: "1 Fertilizante" },
];
const SPECIES: Species[] = ["lavanda", "helecho", "monstera", "cactus"];
const NAME: Record<string, string> = { lavanda: "Lavanda", helecho: "Helecho", monstera: "Monstera", cactus: "Cactus" };
const RIM = 11;

/** Lo especial de cada especie, siempre DENTRO de su silueta. */
const SPECIAL_NOTE: Record<string, string> = {
  lavanda: "Floración intensa: espigas violeta profundo",
  helecho: "Verde profundo, frondas más plenas",
  monstera: "Hojas brillantes, verde esmeralda",
  cactus: "Floración: una corona en cada brazo",
};

/** Flores del cactus en la punta de cada brazo (fracción del lienzo, medida en la lámina). */
const CACTUS_BLOOMS: [number, number, number][] = [
  [0.46, 0.035, 0.085],
  [0.282, 0.275, 0.07],
  [0.65, 0.272, 0.07],
  [0.779, 0.512, 0.058],
];

function mask(src: string): CSSProperties {
  return { maskImage: `url(${src})`, WebkitMaskImage: `url(${src})` };
}

function Flower({ x, y, size }: { x: number; y: number; size: number }) {
  return (
    <svg className={s.flower} style={{ left: `${x * 100}%`, top: `${y * 100}%`, width: `${size * 100}%` }} viewBox="-10 -10 20 20" aria-hidden>
      {[0, 60, 120, 180, 240, 300].map((r) => (
        <ellipse key={r} cx="0" cy="-5" rx="3.2" ry="5.2" transform={`rotate(${r})`} className={s.petal} />
      ))}
      {[30, 90, 150, 210, 270, 330].map((r) => (
        <ellipse key={r} cx="0" cy="-3.6" rx="2.2" ry="3.6" transform={`rotate(${r})`} className={s.petalIn} />
      ))}
      <circle r="2.1" className={s.pistil} />
    </svg>
  );
}

/** Capas de la planta según el estado. Todas se recortan a la silueta. */
function PlantLayers({ species, stage, look }: { species: Species; stage: StageKey; look: Look }) {
  const art = baseArt(species, stage);
  const m = mask(art.src);
  return (
    <>
      <Image src={art.src} width={art.w} height={art.h} alt="" unoptimized draggable={false} className={s.leaf} />
      <span className={s.ao} style={m} aria-hidden />
      {look === "sed" && <span className={s.tips} style={m} aria-hidden />}
      {look === "regada" && (
        <>
          <span className={s.fresh} style={m} aria-hidden />
          <span className={s.dew} style={m} aria-hidden />
        </>
      )}
      {look === "especial" && species === "lavanda" && <span className={s.lavender} style={{
            maskImage: `url(${art.src}), linear-gradient(180deg, #000 0 52%, transparent 66%)`,
            WebkitMaskImage: `url(${art.src}), linear-gradient(180deg, #000 0 52%, transparent 66%)`,
            maskComposite: "intersect",
            WebkitMaskComposite: "source-in",
          }} aria-hidden />}
      {look === "especial" && species === "monstera" && (
        <>
          <span className={s.emerald} style={m} aria-hidden />
          <span className={s.gloss} style={m} aria-hidden />
        </>
      )}
      {look === "especial" && species === "helecho" && <span className={s.emerald} style={m} aria-hidden />}
      {look === "especial" && species === "cactus" && CACTUS_BLOOMS.map(([x, y, z], i) => <Flower key={i} x={x} y={y} size={z} />)}
    </>
  );
}

/** Planta completada en su maceta, medida para llenar la tarjeta. */
function PottedPlant({ species, look, play }: { species: Species; look: Look; play: number }) {
  const stage: StageKey = "planta-completa";
  const art = baseArt(species, stage);
  const sc = SPECIES_SCALE[species];
  const pot = sc.pot!;
  const k = 74 / sc.cm; // cqh por cm: la planta ocupa ~74 % del alto de la tarjeta
  const pad = BOTTOM_PAD[species][stage];
  const potW = pot.w * k;
  const potH = pot.h * k;
  const ry = (potW * RIM) / 100;
  const plantCm = sc.cm - pot.h;
  const sinkCm = Math.max(pot.w * 0.1, plantCm * 0.08);
  const imgH = ((plantCm + sinkCm) * k) / (1 - pad);
  const imgW = imgH * (art.w / art.h);
  const shift = `${-BASE_X[species][stage] * 100}% 0`;
  return (
    <div key={play} className={`${s.unit} ${s[look]} ${play ? s.play : ""}`} style={{ width: `${Math.max(imgW, potW)}cqh`, height: `${potH + plantCm * k}cqh` }}>
      {look === "especial" && <span className={s.halo} style={{ width: `${imgW * 1.25}cqh`, height: `${imgH}cqh`, bottom: `${potH * 0.6}cqh` }} aria-hidden />}
      <span className={s.contact} style={{ width: `${potW * 1.7}cqh`, height: `${potW * 0.4}cqh` }} aria-hidden />
      <span className={s.layer}>
        <Pot w={potW} h={potH} shape={pot.shape} material={look === "especial" ? "esmalte" : "marfil"} layer="back" />
      </span>
      {/* La tierra cambia con el agua: seca y clara con sed, oscura y brillante recién regada. */}
      <span className={s.soil} style={{ width: `${potW * 0.9}cqh`, height: `${ry * 1.5}cqh`, bottom: `${potH - ry * 1.75}cqh` }} aria-hidden />
      <div className={s.cut} style={{ bottom: `${potH - ry}cqh`, width: `${imgW}cqh`, height: `${imgH}cqh`, translate: shift }}>
        <div className={s.plant} style={{ width: `${imgW}cqh`, height: `${imgH}cqh`, bottom: `${-(sinkCm * k) - pad * imgH}cqh` }}>
          <PlantLayers species={species} stage={stage} look={look} />
        </div>
      </div>
      <span className={s.layer}>
        <Pot w={potW} h={potH} shape={pot.shape} material={look === "especial" ? "esmalte" : "marfil"} layer="front" />
      </span>
      {look === "sed" && <span className={s.fallen} style={{ width: `${potW * 0.34}cqh` }} aria-hidden />}
      {look === "regada" && <Drops />}
      {look === "especial" && <Sparkles />}
    </div>
  );
}

const Drops = () => (
  <span className={s.drops} aria-hidden>
    {Array.from({ length: 7 }, (_, i) => (
      <i key={i} style={{ left: `${12 + ((i * 37) % 76)}%`, animationDelay: `${(i % 4) * 0.11}s` }} />
    ))}
  </span>
);

const Sparkles = () => (
  <span className={s.sparkles} aria-hidden>
    {[
      [18, 22],
      [80, 30],
      [30, 62],
      [72, 8],
      [58, 48],
    ].map(([x, y], i) => (
      <i key={i} style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * 0.7}s` }} />
    ))}
  </span>
);

/** La planta actual en su frasco: el agua cuenta la historia. */
function JarPlant({ look, play }: { look: Exclude<Look, "especial">; play: number }) {
  const species: Species = "monstera";
  const stage: StageKey = "planta-joven";
  const art = baseArt(species, stage);
  const sc = SPECIES_SCALE[species];
  const k = 70 / sc.cm;
  const plantCm = sc.cm - (sc.pot?.h ?? 0);
  const imgH = ((plantCm + 4) * k) / (1 - BOTTOM_PAD[species]["planta-completa"]);
  const imgW = imgH * (art.w / art.h);
  const jw = Math.max(imgW * Math.max(0.34, ROOT_SPAN[species] * 1.12), 15 * k);
  const jh = Math.min(Math.max(imgH * 0.4, 18 * k), 46 * k);
  const level = look === "sed" ? 0.14 : look === "regada" ? 0.86 : 0.7;
  return (
    <div key={play} className={`${s.unit} ${s[look]} ${play ? s.play : ""}`} style={{ width: `${Math.max(imgW, jw)}cqh`, height: `${imgH}cqh` }}>
      <span className={s.contact} style={{ width: `${jw * 1.5}cqh`, height: `${jw * 0.36}cqh` }} aria-hidden />
      <span className={s.jarBack} style={{ width: `${jw}cqh`, height: `${jh}cqh` }} aria-hidden />
      <span className={s.water} style={{ width: `${jw * 0.96}cqh`, height: `${jh * level}cqh`, ["--level" as string]: level } as CSSProperties} aria-hidden>
        {look === "regada" && (
          <>
            <b />
            <b />
            <b />
          </>
        )}
      </span>
      {look === "sed" && <span className={s.ring} style={{ width: `${jw * 0.96}cqh`, bottom: `${jh * 0.7}cqh` }} aria-hidden />}
      <div className={s.cut} style={{ bottom: `${jh * 0.05}cqh`, width: `${imgW}cqh`, height: `${imgH}cqh`, translate: `${-BASE_X[species][stage] * 100}% 0` }}>
        <div className={s.plant} style={{ width: `${imgW}cqh`, height: `${imgH}cqh`, bottom: `${-PLANT_PAD[species][stage] * imgH}cqh` }}>
          <PlantLayers species={species} stage={stage} look={look} />
        </div>
      </div>
      <span className={s.jarFront} style={{ width: `${jw}cqh`, height: `${jh}cqh` }} aria-hidden />
      {look === "regada" && <Drops />}
    </div>
  );
}

function Cell({ label, note, children, onReplay }: { label: string; note: string; children: ReactNode; onReplay?: () => void }) {
  return (
    <figure className={s.cell}>
      <div className={s.stage}>{children}</div>
      <figcaption className={s.caption}>
        <span>
          <b>{label}</b> · {note}
        </span>
        {onReplay && (
          <button type="button" onClick={onReplay} className={s.replay} aria-label={`Repetir animación: ${label}`}>
            <RotateCcw size={13} aria-hidden /> Repetir
          </button>
        )}
      </figcaption>
    </figure>
  );
}

export function CareLab() {
  const [dark, setDark] = useState(false);
  const [plays, setPlays] = useState<Record<string, number>>({});
  const replay = (key: string) => setPlays((p) => ({ ...p, [key]: (p[key] ?? 0) + 1 }));

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(document.documentElement.getAttribute("data-theme") === "dark");
  }, []);
  const theme = (d: boolean) => {
    setDark(d);
    document.documentElement.setAttribute("data-theme", d ? "dark" : "light");
  };

  return (
    <div className={`${greenhouseStyles.garden} ${s.lab}`}>
      <GardenFilters />
      <div className={s.inner}>
        <header className={s.head}>
          <div>
            <p className={s.kicker}>Laboratorio del jardín · Cuidado</p>
            <h1 className={s.title}>Sed, Agua y Fertilizante</h1>
          </div>
          <div className={s.seg} role="group" aria-label="Tema">
            <button type="button" onClick={() => theme(false)} aria-pressed={!dark} className={!dark ? s.segOn : ""}>
              <Sun size={14} /> Claro
            </button>
            <button type="button" onClick={() => theme(true)} aria-pressed={dark} className={dark ? s.segOn : ""}>
              <Moon size={14} /> Oscuro
            </button>
          </div>
        </header>

        {SPECIES.map((sp) => (
          <section key={sp} className={s.row}>
            <h2 className={s.rowTitle}>
              {NAME[sp]} <small>{SPECIAL_NOTE[sp]}</small>
            </h2>
            <div className={s.grid}>
              {LOOKS.map((l) => {
                const key = `${sp}-${l.id}`;
                const animated = l.id === "regada" || l.id === "especial";
                return (
                  <Cell key={l.id} label={l.label} note={l.note} onReplay={animated ? () => replay(key) : undefined}>
                    <PottedPlant species={sp} look={l.id} play={plays[key] ?? 0} />
                  </Cell>
                );
              })}
            </div>
          </section>
        ))}

        <section className={s.row}>
          <h2 className={s.rowTitle}>
            Planta actual <small>El agua del frasco también cuenta la historia</small>
          </h2>
          <div className={s.grid}>
            {LOOKS.filter((l) => l.id !== "especial").map((l) => {
              const key = `jar-${l.id}`;
              return (
                <Cell key={l.id} label={l.label} note={l.id === "regada" ? "1 Agua" : l.note} onReplay={l.id === "regada" ? () => replay(key) : undefined}>
                  <JarPlant look={l.id as Exclude<Look, "especial">} play={plays[key] ?? 0} />
                </Cell>
              );
            })}
            <Cell label="Especial" note="Solo plantas completadas">
              <p className={s.na}>El Fertilizante se usa cuando la planta ya está completa.</p>
            </Cell>
          </div>
        </section>
      </div>
    </div>
  );
}
