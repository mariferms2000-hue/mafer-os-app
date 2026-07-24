"use client";

import { X } from "lucide-react";
import { PlantArt } from "@/components/focus/plant-art";
import { SPECIES_LABEL } from "@/lib/plant-svg";
import { STAGES, type StageKey } from "@/lib/focus-logic";
import type { PlantSpecies } from "@/lib/plant-render";
import type { GardenPlant } from "@/lib/queries/focus";

/* Popup de detalle de una planta del Jardín de enfoque — abre desde Mi jardín
   al tocar la tarjeta de la planta actual o cualquiera del grid de completadas.
   Solo lectura: la misma información que ya se calcula en esa página, en un
   layout centrado con el arte de la planta más grande. name/note de
   focus_plants quedan fuera (fuera de la interfaz v1 en el schema). */

export type PlantDetailData = GardenPlant & {
  stage: StageKey;
  next: { key: StageKey; missingMinutes: number } | null;
};

const STAGE_LABEL: Record<StageKey, string> = Object.fromEntries(STAGES.map((s) => [s.key, s.label])) as Record<
  StageKey,
  string
>;

function asSpecies(s: string): PlantSpecies {
  return (s in SPECIES_LABEL ? s : "helecho") as PlantSpecies;
}

function fecha(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

export function PlantDetailModal({ plant, onClose }: { plant: PlantDetailData; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[55] overlay-screen flex items-end md:items-center justify-center px-3 pb-0 md:p-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Detalle de tu ${SPECIES_LABEL[plant.species] ?? plant.species}`}
        className="card card-raised w-full md:max-w-[450px] max-h-[90dvh] overflow-y-auto rounded-b-none md:rounded-b-[18px] p-6 pb-safe"
        data-testid="plant-detail-modal"
      >
        <div className="flex flex-col items-center text-center gap-3.5">
          <div className="w-full flex items-center justify-between gap-3">
            <p className="section-eyebrow">{plant.completedAt ? "Planta completada" : "Planta actual"}</p>
            <button type="button" onClick={onClose} aria-label="Cerrar" className="btn btn-ghost !p-1.5 -mr-1.5">
              <X size={16} aria-hidden />
            </button>
          </div>
          <PlantArt
            species={asSpecies(plant.species)}
            visualSeed={plant.visualSeed}
            stage={plant.stage}
            rendererVersion={plant.rendererVersion}
            className="h-44 w-44 text-sage-deep"
          />
          <h2 className="text-2xl font-display text-forest-deep">{SPECIES_LABEL[plant.species] ?? plant.species}</h2>
          <p className="text-sm text-stone">
            {plant.next
              ? `${STAGE_LABEL[plant.stage]} · ${plant.accumulatedMinutes} de ${plant.accumulatedMinutes + plant.next.missingMinutes} min`
              : STAGE_LABEL[plant.stage]}
          </p>
          <p className="text-xs text-stone-soft">
            {plant.completedAt
              ? `Completada el ${fecha(plant.completedAt)} · ${plant.accumulatedMinutes} min de enfoque`
              : `La cuidas desde el ${fecha(plant.startedAt)} · ${plant.accumulatedMinutes} min de enfoque`}
          </p>
        </div>
      </div>
    </div>
  );
}
