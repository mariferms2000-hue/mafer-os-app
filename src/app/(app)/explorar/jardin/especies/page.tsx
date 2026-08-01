import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ExplorarTabs } from "@/components/explore/tabs";
import { PlantArt } from "@/components/focus/plant-art";
import { STAGES, type StageKey } from "@/lib/focus-logic";
import { SPECIES_LABEL } from "@/lib/plant-svg-v2";
import { ILLUSTRATED_SPECIES } from "@/lib/plant-illustration-fixed";

export const dynamic = "force-dynamic";
export const metadata = { title: "Catálogo de especies" };

/* Catálogo de especies — Fase 4B, piloto de ilustración botánica fija.
   Vista de solo lectura, sin depender de plantas guardadas en la base: usa
   el motor real (PlantArt) con visualSeed fijo, así que lo que se ve aquí
   es EXACTAMENTE lo mismo que dibuja la app en Enfoque, Mi jardín y el
   popup — no una recreación aparte. Temporal mientras se revisa el piloto;
   solo muestra las especies ya migradas al motor fijo (monstera, lavanda,
   cactus). No crea ni lee ninguna planta real. */

const STAGE_LABEL: Record<StageKey, string> = Object.fromEntries(STAGES.map((s) => [s.key, s.label])) as Record<
  StageKey,
  string
>;

export default function EspeciesPage() {
  return (
    <div>
      <PageHeader
        title="Catálogo de especies"
        intro="Piloto de ilustración botánica — cada especie en sus 5 etapas, con el motor real que usa la app. Vista temporal de solo lectura, no depende de tus plantas guardadas."
      >
        <Link href="/explorar/jardin" className="btn btn-ghost" data-testid="especies-back">
          <ArrowLeft size={15} aria-hidden /> Volver a Mi jardín
        </Link>
      </PageHeader>
      <ExplorarTabs />

      <section aria-labelledby="especies-chico" className="mt-8">
        <h2 id="especies-chico" className="section-eyebrow mb-3">
          Tamaño chico — como en Enfoque / Mi jardín
        </h2>
        <div className="flex flex-col gap-4">
          {ILLUSTRATED_SPECIES.map((species) => (
            <div key={species} className="card p-4 md:p-5" data-testid={`especies-row-chico-${species}`}>
              <p className="font-display text-lg text-forest-deep mb-3">{SPECIES_LABEL[species] ?? species}</p>
              <div className="grid grid-cols-5 gap-2 md:gap-4">
                {STAGES.map((s) => (
                  <div key={s.key} className="flex flex-col items-center gap-1.5">
                    <PlantArt species={species} visualSeed={0} stage={s.key} className="h-16 w-16 md:h-20 md:w-20 text-sage-deep" />
                    <span className="text-[11px] text-stone text-center">{STAGE_LABEL[s.key]}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="especies-grande" className="mt-10">
        <h2 id="especies-grande" className="section-eyebrow mb-3">
          Tamaño grande — como en el popup
        </h2>
        <div className="flex flex-col gap-4">
          {ILLUSTRATED_SPECIES.map((species) => (
            <div key={species} className="card p-4 md:p-5" data-testid={`especies-row-grande-${species}`}>
              <p className="font-display text-lg text-forest-deep mb-3">{SPECIES_LABEL[species] ?? species}</p>
              <div className="grid grid-cols-5 gap-2 md:gap-4">
                {STAGES.map((s) => (
                  <div key={s.key} className="flex flex-col items-center gap-1.5">
                    <PlantArt species={species} visualSeed={0} stage={s.key} className="h-28 w-28 md:h-36 md:w-36 text-sage-deep" />
                    <span className="text-[11px] text-stone text-center">{STAGE_LABEL[s.key]}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
