import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ExplorarTabs } from "@/components/explore/tabs";
import { PlantArt } from "@/components/focus/plant-art";
import { STAGES, type StageKey } from "@/lib/focus-logic";
import type { PlantSpeciesV2 } from "@/lib/plant-render-v2";

export const dynamic = "force-dynamic";
export const metadata = { title: "Catálogo de especies" };

/* Catálogo de especies — vista temporal de revisión (Fase 4C).
   Simula las 15 combinaciones (Monstera, Lavanda, Cactus × 5 etapas) usando
   EXACTAMENTE el mismo componente que la app real: <PlantArt>. Lo que se ve
   aquí es, pieza por pieza, lo que se dibuja en Enfoque, Mi jardín, el grid
   y el popup — no una recreación. No depende de plantas guardadas ni crea
   datos. El tema claro/oscuro lo maneja el propio PlantArt. */

const PILOT_SPECIES = [
  { key: "monstera", label: "Monstera" },
  { key: "lavanda", label: "Lavanda" },
  { key: "cactus", label: "Cactus" },
  { key: "helecho", label: "Helecho" },
  { key: "suculenta", label: "Suculenta" },
  { key: "olivo", label: "Olivo" },
  { key: "bambu", label: "Bambú" },
  { key: "potos", label: "Potos" },
  { key: "sansevieria", label: "Sansevieria" },
] as const;

const STAGE_LABEL: Record<StageKey, string> = Object.fromEntries(STAGES.map((s) => [s.key, s.label])) as Record<
  StageKey,
  string
>;

function SpeciesRow({
  species,
  label,
  size,
  boxClass,
}: {
  species: PlantSpeciesV2;
  label: string;
  size: "small" | "large";
  boxClass: string;
}) {
  return (
    <div className="card p-4 md:p-5" data-testid={`especies-${size}-${species}`}>
      <p className="font-display text-lg text-forest-deep mb-3">{label}</p>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 md:gap-4 items-end">
        {STAGES.map((s) => (
          <div key={s.key} className="flex flex-col items-center gap-1.5">
            <PlantArt species={species} visualSeed={0} stage={s.key} size={size} className={`${boxClass} text-sage-deep`} />
            <span className="text-[11px] text-stone text-center">{STAGE_LABEL[s.key]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function EspeciesPage() {
  return (
    <div>
      <PageHeader
        title="Catálogo de especies"
        intro="Las especies con ilustración botánica, en sus 5 etapas, dibujadas con el mismo componente que usa la app (Enfoque, Mi jardín, grid y popup). Vista de solo lectura, no depende de tus plantas guardadas."
      >
        <Link href="/explorar/jardin" className="btn btn-ghost" data-testid="especies-back">
          <ArrowLeft size={15} aria-hidden /> Volver a Mi jardín
        </Link>
      </PageHeader>
      <ExplorarTabs />

      <section aria-labelledby="especies-chico" className="mt-8">
        <h2 id="especies-chico" className="section-eyebrow mb-3">
          Tamaño chico — como en Mi jardín / grid (h-32)
        </h2>
        <div className="flex flex-col gap-4">
          {PILOT_SPECIES.map((sp) => (
            <SpeciesRow key={sp.key} species={sp.key as PlantSpeciesV2} label={sp.label} size="small" boxClass="h-32 w-32" />
          ))}
        </div>
      </section>

      <section aria-labelledby="especies-grande" className="mt-10">
        <h2 id="especies-grande" className="section-eyebrow mb-3">
          Tamaño grande — como en Enfoque / popup (h-44)
        </h2>
        <div className="flex flex-col gap-4">
          {PILOT_SPECIES.map((sp) => (
            <SpeciesRow key={sp.key} species={sp.key as PlantSpeciesV2} label={sp.label} size="large" boxClass="h-44 w-44" />
          ))}
        </div>
      </section>
    </div>
  );
}
