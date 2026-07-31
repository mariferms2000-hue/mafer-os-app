import type { StageKey } from "@/lib/focus-logic";
import { illustratedPlantScene, type IllustratedSpecies, type PlantShape } from "@/lib/plant-illustration-fixed";

/* Ilustración botánica FIJA — piloto de rediseño (Fase 4B), solo Monstera,
   Lavanda y Cactus. Componente presentacional puro: species + stage → el
   mismo SVG siempre (sin variación por seed — ver plant-illustration-fixed.ts
   para el porqué). Mismo contrato visual (viewBox, encuadre) que PlantArt,
   para poder sustituirlo sin cambiar el layout de quien lo usa. */

function renderShape(s: PlantShape, i: number) {
  switch (s.kind) {
    case "path":
      return <path key={i} d={s.d} fill={s.fill} fillRule={s.fillRule} opacity={s.opacity} />;
    case "stroke":
      return (
        <path
          key={i}
          d={s.d}
          fill="none"
          stroke={s.stroke}
          strokeWidth={s.width}
          opacity={s.opacity}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    case "circle":
      return <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={s.fill} opacity={s.opacity} />;
    case "ellipse":
      return (
        <ellipse
          key={i}
          cx={s.cx}
          cy={s.cy}
          rx={s.rx}
          ry={s.ry}
          fill={s.fill}
          opacity={s.opacity}
          transform={s.rotateDeg ? `rotate(${s.rotateDeg} ${s.cx} ${s.cy})` : undefined}
        />
      );
  }
}

export function FixedIllustratedPlantArt({
  species,
  stage,
  className,
}: {
  species: IllustratedSpecies;
  stage: StageKey;
  className?: string;
}) {
  const scene = illustratedPlantScene(species, stage);
  const { k, cx, cy } = scene.frame;
  const tx = 48 - cx * k;
  const ty = 46 - cy * k;
  return (
    <svg viewBox="0 0 96 88" fill="none" className={className} aria-hidden="true" data-stage={stage} data-species={species}>
      <g key={stage} className="transition-opacity duration-500 starting:opacity-0" transform={`translate(${tx} ${ty}) scale(${k})`}>
        {scene.shapes.map(renderShape)}
      </g>
    </svg>
  );
}
