import type { StageKey } from "@/lib/focus-logic";
import { plantRenderSpecV2, type PlantSpeciesV2 } from "@/lib/plant-render-v2";
import { plantSceneV2 } from "@/lib/plant-svg-v2";
import { STAGE_ART, STAGE_VIEW } from "./plant";

/* Ilustración de una planta CON identidad — v2 (rediseño). Componente
   presentacional puro: species + visual_seed + stage → el mismo SVG siempre.

   ADAPTADOR DE COMPATIBILIDAD: toda planta (nacida bajo renderer_version 1
   o 2) se dibuja SIEMPRE con el motor v2, alimentándolo con su especie/seed/
   etapa ya guardadas — v1 y v2 comparten los nombres de las 5 especies
   originales, así que no hace falta traducir nada. Los datos de la planta
   (especie, seed, etapa, minutos, fechas) nunca cambian; solo cambia CÓMO se
   dibuja. El motor v1 (plant-render.ts/plant-svg.ts) queda intacto en el
   repo como referencia congelada — ya ningún componente lo usa, pero sus
   pruebas y snapshot lo siguen protegiendo.

   Las etapas semilla y brote usan el arte compartido de plant.tsx — aprobado:
   la identidad de especie se hace evidente conforme la planta crece. Trazo
   lineal botánico con currentColor: funciona en claro y oscuro sin hex propios.
   Sin animaciones permanentes; el cambio de etapa hereda la transición breve de
   opacidad que prefers-reduced-motion anula (regla global en globals.css). */

export function PlantArt({
  species,
  visualSeed,
  stage,
  className,
}: {
  /** Ya validada por el llamador (ver asSpecies() en jardín/popup) — funciona
   *  igual para especies nacidas bajo v1 (subconjunto de 5) o v2 (12). */
  species: PlantSpeciesV2;
  visualSeed: number;
  stage: StageKey;
  className?: string;
}) {
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
