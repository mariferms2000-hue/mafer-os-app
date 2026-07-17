import type { StageKey } from "@/lib/focus-logic";
import { plantRenderSpec, type PlantSpecies } from "@/lib/plant-render";
import { plantScene } from "@/lib/plant-svg";
import { STAGE_ART, STAGE_VIEW } from "./plant";

/* Ilustración de una planta CON identidad — Fase 7E.3. Componente presentacional
   puro: species + visual_seed + stage + renderer_version → el mismo SVG siempre
   (la especificación viene del motor determinista de 7E.2 y la geometría de
   plant-svg.ts; aquí no se calcula nada aleatorio).

   Las etapas semilla y brote usan el arte compartido de plant.tsx — aprobado:
   la identidad de especie se hace evidente conforme la planta crece. Trazo
   lineal botánico con currentColor: funciona en claro y oscuro sin hex propios.
   Sin animaciones permanentes; el cambio de etapa hereda la transición breve de
   opacidad que prefers-reduced-motion anula (regla global en globals.css). */

export function PlantArt({
  species,
  visualSeed,
  stage,
  rendererVersion,
  className,
}: {
  species: PlantSpecies;
  visualSeed: number;
  stage: StageKey;
  rendererVersion: number;
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

  const spec = plantRenderSpec({ species, visualSeed, stage, rendererVersion });
  const scene = plantScene(spec);
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
