import Image from "next/image";
import type { StageKey } from "@/lib/focus-logic";
import { plantRenderSpecV2, type PlantSpeciesV2 } from "@/lib/plant-render-v2";
import { plantSceneV2 } from "@/lib/plant-svg-v2";
import { STAGE_ART, STAGE_VIEW } from "./plant";
import {
  isIllustratedPlantSpecies,
  plantAssetPath,
  PLANT_ASSET_DIMS,
  type PlantAssetSize,
} from "@/lib/plant-assets";

/* Ilustración de una planta CON identidad. Componente presentacional puro:
   species + visual_seed + stage → el mismo resultado siempre.

   DOS CAMINOS, una sola puerta de decisión (isIllustratedPlantSpecies):

   1) Especies con asset botánico aprobado (monstera, lavanda, cactus): se
      dibujan con el WebP fijo del piloto (public/plants/, Fase 4B/4C),
      eligiendo etapa + tema + tamaño. El seed no participa: los assets son
      fijos por especie+etapa (decisión aprobada en el piloto). Se muestran
      dos <img> (claro/oscuro) y el tema activo decide cuál se ve, vía las
      clases plant-illus-light/plant-illus-dark de globals.css.

   2) Las otras 9 especies: FALLBACK idéntico a como estaban en Production —
      motor SVG v2 (hojas en adelante) y arte compartido de plant.tsx para
      semilla/brote. No cambia ni un pixel para ellas.

   Nada de esto toca los datos de la planta (especie, seed, renderer_version,
   minutos, etapa) — solo cambia CÓMO se dibujan las 3 especies ilustradas.
   Las plantas antiguas conservan su especie guardada, así que jamás hay un
   salto de identidad al abrir una planta vieja: una Monstera guardada usa
   los assets de Monstera, y punto. */

export function PlantArt({
  species,
  visualSeed,
  stage,
  className,
  size = "large",
}: {
  /** Ya validada por el llamador (ver asSpecies() en jardín/popup). */
  species: PlantSpeciesV2;
  visualSeed: number;
  stage: StageKey;
  className?: string;
  /** Tamaño del asset ilustrado a cargar. Los contenedores chicos (grid de
   *  Mi jardín) piden "small"; el resto usa "large" (nítido a cualquier
   *  tamaño de uso). Irrelevante para el fallback SVG. */
  size?: PlantAssetSize;
}) {
  // ── Camino 1: assets botánicos aprobados ──
  if (isIllustratedPlantSpecies(species)) {
    const dims = PLANT_ASSET_DIMS[species][size];
    return (
      <span
        className={`inline-flex items-center justify-center ${className ?? ""}`}
        aria-hidden="true"
        data-species={species}
        data-stage={stage}
        data-seed={visualSeed}
        data-illustrated="true"
      >
        <Image
          src={plantAssetPath(species, stage, "light", size)}
          width={dims.w}
          height={dims.h}
          alt=""
          aria-hidden
          unoptimized
          className="plant-illus-light h-full w-full object-contain"
        />
        <Image
          src={plantAssetPath(species, stage, "dark", size)}
          width={dims.w}
          height={dims.h}
          alt=""
          aria-hidden
          unoptimized
          className="plant-illus-dark h-full w-full object-contain"
        />
      </span>
    );
  }

  // ── Camino 2 (fallback): motor SVG v2 + arte compartido, sin cambios ──
  if (stage === "semilla" || stage === "brote") {
    const Art = STAGE_ART[stage];
    const v = STAGE_VIEW[stage];
    const tx = 48 - v.cx * v.k;
    const ty = 46 - v.cy * v.k;
    return (
      <svg
        viewBox="0 0 96 88"
        fill="none"
        className={className}
        aria-hidden="true"
        data-stage={stage}
        data-species={species}
        data-seed={visualSeed}
      >
        <g key={stage} className="transition-opacity duration-500 starting:opacity-0" transform={`translate(${tx} ${ty}) scale(${v.k})`}>
          <Art />
        </g>
      </svg>
    );
  }

  const spec = plantRenderSpecV2({ species, visualSeed, stage });
  const scene = plantSceneV2(spec);
  const { k, cx, cy } = scene.frame;
  const tx = 48 - cx * k;
  const ty = 46 - cy * k;
  return (
    <svg
      viewBox="0 0 96 88"
      fill="none"
      className={className}
      aria-hidden="true"
      data-stage={stage}
      data-species={species}
      data-seed={visualSeed}
    >
      <g key={stage} className="transition-opacity duration-500 starting:opacity-0" transform={`translate(${tx} ${ty}) scale(${k})`}>
        {scene.strokes.map((s, i) => (
          <path
            key={i}
            d={s.d}
            stroke="currentColor"
            strokeWidth={s.w}
            opacity={s.o}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </g>
    </svg>
  );
}
