import Image from "next/image";
import { PlantArt } from "@/components/focus/plant-art";
import { PlantCardTrigger } from "./plant-card-trigger";
import { SPECIES_LABEL } from "@/lib/plant-svg-v2";
import type { PlantSpeciesV2 } from "@/lib/plant-render-v2";
import type { GardenData, GardenPlant } from "@/lib/queries/focus";
import { STAGES, type StageKey } from "@/lib/focus-logic";
import {
  PROPAGATION_SPOT,
  SCENE_ASPECT,
  fitPlant,
  placePlants,
  type GardenScene,
  type GardenSlot,
} from "@/lib/garden-layout";
import { POT_SHAPES, fitPotted, potAssetPath, potFor } from "@/lib/garden-pot";

/* La escena de «Mi jardín»: el cuarto botánico.

   El fondo son las ilustraciones de public/garden/, puestas como
   background-image en cada lienzo: así el navegador descarga SOLO la variante
   del tema activo (con dos <img> ocultos se bajarían las dos). Cada contenedor
   fija la proporción de su lienzo, de modo que los porcentajes de cada sitio
   caen sobre la superficie pintada exacta, a cualquier ancho de pantalla.

   ESCRITORIO: la habitación entera en un lienzo.
   MÓVIL: el mismo cuarto recorrido en DOS vistas apiladas — arriba la ventana
   con su alféizar y el banco de propagación, abajo las tres repisas y el suelo.
   Un recorte 4:5 de la ilustración horizontal mide media imagen: o conserva la
   ventana o conserva las repisas, nunca las dos. Dos vistas del mismo cuarto lo
   resuelven sin inventar arte nuevo, y suben las plantas de 38 px a 55-90.

   Cada composición monta sus propios nodos (viven en contenedores distintos y
   no pueden compartirlos), pero las URL de las imágenes se repiten, así que el
   coste de red no cambia: solo hay nodos de más en el DOM, ocultos por CSS.

   Cada planta sigue siendo un PlantCardTrigger: abre el mismo popup de siempre.
   PlantArt no se toca; solo se le da una caja con la proporción real de su
   especie para que quede posada y sin deformar.

   RECIPIENTES
   Las plantas completadas se componen dentro de una maceta (ver garden-pot).
   La maceta se pinta DOS veces desde el mismo archivo, recortada con
   clip-path: la mitad trasera va detrás de PlantArt y la delantera por delante,
   de modo que la planta queda metida dentro y su base —tierra, raíces o grava—
   queda oculta sin recortar la ilustración.

   Esto solo ocurre AQUÍ. El catálogo, el invernadero, el popup y el overlay de
   enfoque siguen usando la lámina botánica tal cual, sin maceta. Y la planta
   actual del banco tampoco lleva: sus etapas son especímenes con raíz y
   tendrán su propio frasco de propagación. */

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

type Spot = Pick<GardenSlot, "x" | "baseline" | "height" | "maxWidth" | "scene">;

/** Posición y tamaño del sitio, en variables CSS. */
function slotStyle(species: string, spot: Spot): React.CSSProperties {
  const box = fitPlant(species, spot);
  return {
    "--gx": `${spot.x}%`,
    "--gy": `${spot.baseline}%`,
    "--gw": `${box.width}%`,
    "--gh": `${box.height}%`,
  } as React.CSSProperties;
}

/** La planta actual, posada en su banco de propagación. Las etapas tempranas
 *  son láminas de espécimen —con raíces al aire—, y ahí es justo donde tienen
 *  sentido. */
function CurrentPlant({
  current,
  spot,
  testid,
}: {
  current: GardenData["current"];
  spot: Spot;
  testid: string;
}) {
  if (!current) {
    return (
      <div className="garden-slot garden-slot-current garden-slot-quiet" style={slotStyle("helecho", spot)}>
        <PlantArt species="helecho" visualSeed={0} stage="semilla" className="h-full w-full text-sage-deep" />
      </div>
    );
  }
  const nombre = SPECIES_LABEL[current.species] ?? current.species;
  return (
    <PlantCardTrigger
      plant={current}
      label={`Ver detalle de tu ${nombre} — planta actual, ${STAGE_LABEL[current.stage].toLowerCase()}`}
      testid={testid}
      className="garden-slot garden-slot-current"
      style={slotStyle(current.species, spot)}
    >
      <PlantArt
        species={asSpecies(current.species)}
        visualSeed={current.visualSeed}
        stage={current.stage}
        className="h-full w-full text-sage-deep"
      />
      <span className="garden-tip">
        {nombre} · {STAGE_LABEL[current.stage]}
      </span>
    </PlantCardTrigger>
  );
}

function CompletedPlant({ plant, slot, testid }: { plant: GardenPlant; slot: GardenSlot; testid: string }) {
  const nombre = SPECIES_LABEL[plant.species] ?? plant.species;
  const maceta = potFor(plant.species);
  const capas = maceta ? fitPotted(plant.species, slot, SCENE_ASPECT[slot.scene]) : null;

  const arte = (
    <PlantArt
      species={asSpecies(plant.species)}
      visualSeed={plant.visualSeed}
      stage="planta-completa"
      size="small"
      className="h-full w-full text-sage-deep"
    />
  );

  return (
    <PlantCardTrigger
      plant={{ ...plant, stage: "planta-completa", next: null }}
      label={`Ver detalle de tu ${nombre} completada el ${fecha(plant.completedAt)}`}
      testid={testid}
      className={`garden-slot${capas ? " garden-slot-potted" : ""}`}
      style={
        capas
          ? ({
              "--gx": `${slot.x}%`,
              "--gy": `${slot.baseline}%`,
              "--gw": `${capas.assemblyWidth}%`,
              "--gh": `${capas.assemblyHeight}%`,
            } as React.CSSProperties)
          : slotStyle(plant.species, slot)
      }
    >
      {capas && maceta ? (
        <>
          <Image
            className="garden-pot"
            src={potAssetPath(maceta.shape, "claro")}
            width={POT_SHAPES[maceta.shape].dims.w}
            height={POT_SHAPES[maceta.shape].dims.h}
            unoptimized
            alt=""
            aria-hidden
            style={potStyle(capas, "trasera")}
          />
          <Image
            className="garden-pot garden-pot-dark"
            src={potAssetPath(maceta.shape, "oscuro")}
            width={POT_SHAPES[maceta.shape].dims.w}
            height={POT_SHAPES[maceta.shape].dims.h}
            unoptimized
            alt=""
            aria-hidden
            style={potStyle(capas, "trasera")}
          />
          <span className="garden-planta" style={plantaStyle(capas)}>
            {arte}
          </span>
          <Image
            className="garden-pot garden-pot-front"
            src={potAssetPath(maceta.shape, "claro")}
            width={POT_SHAPES[maceta.shape].dims.w}
            height={POT_SHAPES[maceta.shape].dims.h}
            unoptimized
            alt=""
            aria-hidden
            style={potStyle(capas, "frontal")}
          />
          <Image
            className="garden-pot garden-pot-front garden-pot-dark"
            src={potAssetPath(maceta.shape, "oscuro")}
            width={POT_SHAPES[maceta.shape].dims.w}
            height={POT_SHAPES[maceta.shape].dims.h}
            unoptimized
            alt=""
            aria-hidden
            style={potStyle(capas, "frontal")}
          />
        </>
      ) : (
        arte
      )}
      <span className="garden-tip">{nombre}</span>
    </PlantCardTrigger>
  );
}

/** Las dos capas salen del MISMO archivo: solo cambia dónde se corta. */
function potStyle(c: NonNullable<ReturnType<typeof fitPotted>>, capa: "trasera" | "frontal"): React.CSSProperties {
  return {
    width: `${c.pot.width}%`,
    height: `${c.pot.height}%`,
    bottom: `${c.pot.bottom}%`,
    clipPath:
      capa === "trasera" ? `inset(0 0 ${100 - c.splitY}% 0)` : `inset(${c.splitY}% 0 0 0)`,
  };
}

function plantaStyle(c: NonNullable<ReturnType<typeof fitPotted>>): React.CSSProperties {
  return { width: `${c.plant.width}%`, height: `${c.plant.height}%`, bottom: `${c.plant.bottom}%` };
}

export function GardenRoom({ garden }: { garden: GardenData }) {
  const c = garden.current;
  const wide = placePlants<GardenPlant>(garden.completed, "wide");
  const narrow = placePlants<GardenPlant>(garden.completed, "narrow");

  // DOM en orden de lectura visual: es el orden en que el tabulador recorre.
  const porOrden = (a: { slot: GardenSlot }, b: { slot: GardenSlot }) => a.slot.order - b.slot.order;
  const enPanel = (scene: GardenScene) => narrow.filter((p) => p.slot.scene === scene).sort(porOrden);

  return (
    <>
      {/* ── Escritorio: la habitación entera ── */}
      <div className="garden-scene garden-scene-wide" data-testid="garden-scene-wide">
        <CurrentPlant current={c} spot={PROPAGATION_SPOT.wide} testid="garden-room-current" />
        {[...wide].sort(porOrden).map(({ slot, plant }) => (
          <CompletedPlant key={plant.id} plant={plant} slot={slot} testid="garden-room-plant" />
        ))}
      </div>

      {/* ── Móvil: el mismo cuarto en dos vistas apiladas ── */}
      <div className="garden-movil" data-testid="garden-scene-movil">
        <div className="garden-scene garden-panel-a">
          <CurrentPlant current={c} spot={PROPAGATION_SPOT.narrow} testid="garden-movil-current" />
          {enPanel("movil-a").map(({ slot, plant }) => (
            <CompletedPlant key={plant.id} plant={plant} slot={slot} testid="garden-movil-plant" />
          ))}
        </div>
        <div className="garden-scene garden-panel-b">
          {enPanel("movil-b").map(({ slot, plant }) => (
            <CompletedPlant key={plant.id} plant={plant} slot={slot} testid="garden-movil-plant" />
          ))}
        </div>
      </div>
    </>
  );
}
