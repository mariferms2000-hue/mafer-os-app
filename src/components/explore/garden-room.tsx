import { PlantArt } from "@/components/focus/plant-art";
import { PlantCardTrigger } from "./plant-card-trigger";
import { RoomArt } from "./room-art";
import { SPECIES_LABEL } from "@/lib/plant-svg-v2";
import type { PlantSpeciesV2 } from "@/lib/plant-render-v2";
import type { GardenData, GardenPlant } from "@/lib/queries/focus";
import { STAGES, type StageKey } from "@/lib/focus-logic";
import {
  PROPAGATION_SPOT,
  fitPlant,
  placePlants,
  type GardenSlot,
} from "@/lib/garden-layout";

/* La escena de «Mi jardín»: el cuarto botánico.

   Una sola capa de plantas para las DOS composiciones. Cada planta se pinta una
   vez y su posición viaja en variables CSS (--gx/--gy para escritorio,
   --gx-n/--gy-n para móvil); la media query de .garden-slot elige cuál manda.
   Así no se duplican <img> por breakpoint —lo que habría doblado el peso de la
   página— ni hace falta JavaScript para medir la pantalla.

   Cada planta sigue siendo un PlantCardTrigger: abre el mismo popup de detalle
   de siempre. PlantArt no se toca; solo se le da una caja con la proporción
   real de su especie para que quede posada y sin deformar. */

const STAGE_LABEL: Record<StageKey, string> = Object.fromEntries(STAGES.map((s) => [s.key, s.label])) as Record<
  StageKey,
  string
>;

function asSpecies(s: string): PlantSpeciesV2 {
  return (s in SPECIES_LABEL ? s : "helecho") as PlantSpeciesV2;
}

function fecha(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

type SpotLike = Pick<GardenSlot, "x" | "baseline" | "height" | "maxWidth">;

/** Variables CSS de posición y tamaño para las dos composiciones. */
function slotStyle(species: string, wide: SpotLike, narrow: SpotLike | null): React.CSSProperties {
  const w = fitPlant(species, wide, "wide");
  const vars: Record<string, string> = {
    "--gx": `${wide.x}%`,
    "--gy": `${wide.baseline}%`,
    "--gw": `${w.width}%`,
    "--gh": `${w.height}%`,
  };
  if (narrow) {
    const n = fitPlant(species, narrow, "narrow");
    vars["--gx-n"] = `${narrow.x}%`;
    vars["--gy-n"] = `${narrow.baseline}%`;
    vars["--gw-n"] = `${n.width}%`;
    vars["--gh-n"] = `${n.height}%`;
  }
  return vars as React.CSSProperties;
}

export function GardenRoom({ garden }: { garden: GardenData }) {
  const c = garden.current;

  // Mismo orden de entrada en ambas composiciones, así que la planta i cae en
  // el sitio i del orden de llenado de cada una.
  const wide = placePlants<GardenPlant>(garden.completed, "wide");
  const narrow = placePlants<GardenPlant>(garden.completed, "narrow");
  const narrowByPlant = new Map(narrow.map((p) => [p.plant.id, p.slot]));

  // DOM en orden de lectura visual (arriba→abajo, izquierda→derecha): es el
  // orden en que el tabulador recorre la escena.
  const placed = [...wide].sort((a, b) => a.slot.order - b.slot.order);

  return (
    <div className="garden-scene relative w-full aspect-[4/5] md:aspect-[8/5] overflow-hidden">
      <RoomArt variant="narrow" className="absolute inset-0 h-full w-full md:hidden" />
      <RoomArt variant="wide" className="absolute inset-0 h-full w-full hidden md:block" />

      {/* Planta actual, en la mesa de propagación. Las etapas tempranas son
          láminas de espécimen (semilla, raíces al aire): dentro del frasco es
          justo donde tienen sentido. */}
      {c ? (
        <PlantCardTrigger
          plant={c}
          label={`Ver detalle de tu ${SPECIES_LABEL[c.species] ?? c.species} — planta actual, ${STAGE_LABEL[c.stage].toLowerCase()}`}
          testid="garden-room-current"
          className="garden-slot garden-slot-current"
          style={slotStyle(c.species, PROPAGATION_SPOT.wide, PROPAGATION_SPOT.narrow)}
        >
          <PlantArt
            species={asSpecies(c.species)}
            visualSeed={c.visualSeed}
            stage={c.stage}
            className="h-full w-full text-sage-deep"
          />
          <span className="garden-tip">{SPECIES_LABEL[c.species] ?? c.species} · {STAGE_LABEL[c.stage]}</span>
        </PlantCardTrigger>
      ) : (
        <div
          className="garden-slot garden-slot-current garden-slot-quiet"
          style={slotStyle("helecho", PROPAGATION_SPOT.wide, PROPAGATION_SPOT.narrow)}
        >
          <PlantArt species="helecho" visualSeed={0} stage="semilla" className="h-full w-full text-sage-deep" />
        </div>
      )}

      {/* Plantas completadas: cada una en su sitio, cada una con su popup */}
      {placed.map(({ slot, plant }) => {
        const narrowSlot = narrowByPlant.get(plant.id) ?? null;
        return (
          <PlantCardTrigger
            key={plant.id}
            plant={{ ...plant, stage: "planta-completa", next: null }}
            label={`Ver detalle de tu ${SPECIES_LABEL[plant.species] ?? plant.species} completada el ${fecha(plant.completedAt)}`}
            testid="garden-room-plant"
            className={`garden-slot ${narrowSlot ? "" : "hidden md:block"}`}
            style={slotStyle(plant.species, slot, narrowSlot)}
          >
            <PlantArt
              species={asSpecies(plant.species)}
              visualSeed={plant.visualSeed}
              stage="planta-completa"
              size="small"
              className="h-full w-full text-sage-deep"
            />
            <span className="garden-tip">{SPECIES_LABEL[plant.species] ?? plant.species}</span>
          </PlantCardTrigger>
        );
      })}
    </div>
  );
}
