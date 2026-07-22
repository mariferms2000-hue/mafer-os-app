import Link from "next/link";
import { Sprout } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ExplorarTabs } from "@/components/explore/tabs";
import { GardenFocusButton } from "@/components/explore/garden-focus-button";
import { PlantCardTrigger } from "@/components/explore/plant-card-trigger";
import { PlantArt } from "@/components/focus/plant-art";
import { getGarden } from "@/lib/queries/focus";
import { STAGES, type StageKey } from "@/lib/focus-logic";
import { SPECIES_LABEL } from "@/lib/plant-svg";
import type { PlantSpecies } from "@/lib/plant-render";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mi jardín" };

/* Explorar → Mi jardín — Fase 7E.3. Solo lectura sobre focus_plants: la planta
   actual arriba como protagonista y, debajo, el jardín de plantas completadas
   (más reciente primero, 12 iniciales + «Ver más» por parámetro de URL).
   Las tarjetas todavía no abren detalle: eso es 7E.4. */

const STAGE_LABEL: Record<StageKey, string> = Object.fromEntries(STAGES.map((s) => [s.key, s.label])) as Record<
  StageKey,
  string
>;

const PAGE_SIZE = 12;

/** Solo especies conocidas llegan al motor de render; cualquier otra cosa en la
 *  base (no debería existir tras el backfill) se dibuja como la primera especie. */
function asSpecies(s: string): PlantSpecies {
  return (s in SPECIES_LABEL ? s : "helecho") as PlantSpecies;
}

function fecha(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

export default async function JardinPage({ searchParams }: { searchParams: Promise<{ mostrar?: string }> }) {
  const { mostrar } = await searchParams;
  const requested = Number.parseInt(mostrar ?? "", 10);
  const shown = Number.isFinite(requested) ? Math.min(Math.max(PAGE_SIZE, requested), 600) : PAGE_SIZE;
  const garden = await getGarden(shown);
  const c = garden.current;

  return (
    <div>
      <PageHeader
        icon={Sprout}
        title="Mi jardín"
        intro="Cada planta conserva el tiempo que decidiste cuidar. Crece a tu ritmo; aquí nada caduca ni se pierde."
      />
      <ExplorarTabs />

      {/* Planta actual: la protagonista de la pantalla */}
      <section
        aria-labelledby="planta-actual"
        className="card p-5 md:p-7 mb-10 !border-border-focus/40"
        data-testid="garden-current"
      >
        {c ? (
          <PlantCardTrigger
            plant={c}
            label={`Ver detalle de tu ${SPECIES_LABEL[c.species] ?? c.species}`}
            testid="garden-current-open"
            className="flex flex-col sm:flex-row items-center gap-5 md:gap-9 cursor-pointer"
          >
            <PlantArt
              species={asSpecies(c.species)}
              visualSeed={c.visualSeed}
              stage={c.stage}
              rendererVersion={c.rendererVersion}
              className="h-40 w-40 md:h-48 md:w-48 shrink-0 text-sage-deep"
            />
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <p id="planta-actual" className="section-eyebrow">
                Planta actual
              </p>
              <h2 className="text-2xl md:text-3xl text-forest-deep mt-1" data-testid="garden-current-species">
                {SPECIES_LABEL[c.species] ?? c.species}
              </h2>
              <p className="text-sm text-stone mt-0.5" data-testid="garden-current-stage">
                {STAGE_LABEL[c.stage]}
              </p>
              <p className="text-sm text-stone mt-2" data-testid="garden-current-progress">
                {c.next
                  ? `${c.accumulatedMinutes} de ${c.accumulatedMinutes + c.next.missingMinutes} min para ${STAGE_LABEL[c.next.key].toLowerCase()}`
                  : "Tu planta está completa"}
              </p>
              <p className="text-xs text-stone-soft mt-1">
                La cuidas desde el {fecha(c.startedAt)} · {c.accumulatedMinutes} min de enfoque
              </p>
              <div
                className="mt-4 flex justify-center sm:justify-start"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <GardenFocusButton testid="garden-focus" />
              </div>
            </div>
          </PlantCardTrigger>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-5 md:gap-9">
            <PlantArt
              species="helecho"
              visualSeed={0}
              stage="semilla"
              rendererVersion={1}
              className="h-40 w-40 md:h-48 md:w-48 shrink-0 text-sage-deep"
            />
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <p id="planta-actual" className="section-eyebrow">
                Planta actual
              </p>
              <h2 className="text-2xl md:text-3xl text-forest-deep mt-1" data-testid="garden-current-species">
                Semilla nueva
              </h2>
              <p className="text-sm text-stone mt-0.5" data-testid="garden-current-stage">
                {STAGE_LABEL.semilla}
              </p>
              <p className="text-sm text-stone mt-2" data-testid="garden-current-progress">
                Tu primera sesión de enfoque la hará nacer
              </p>
              <div className="mt-4 flex justify-center sm:justify-start">
                <GardenFocusButton testid="garden-focus" />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Plantas completadas */}
      <section aria-labelledby="tu-jardin">
        <h2 id="tu-jardin" className="section-eyebrow mb-3">
          Tu jardín
        </h2>
        {garden.completed.length === 0 ? (
          <EmptyState
            variant="semilla"
            title="Tu jardín está esperando su primera planta."
            hint="Cada minuto de enfoque la acerca."
          >
            <GardenFocusButton variant="secondary" testid="garden-empty-focus" />
          </EmptyState>
        ) : (
          <>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="garden-grid">
              {garden.completed.map((p) => (
                <PlantCardTrigger
                  key={p.id}
                  as="li"
                  plant={{ ...p, stage: "planta-completa", next: null }}
                  label={`Ver detalle de tu ${SPECIES_LABEL[p.species] ?? p.species} completada`}
                  testid="garden-plant"
                  className="card p-4 flex flex-col items-center text-center cursor-pointer"
                >
                  <PlantArt
                    species={asSpecies(p.species)}
                    visualSeed={p.visualSeed}
                    stage="planta-completa"
                    rendererVersion={p.rendererVersion}
                    className="h-32 w-32 text-sage-deep"
                  />
                  <p className="font-display text-lg text-forest-deep mt-2">{SPECIES_LABEL[p.species] ?? p.species}</p>
                  <p className="text-xs text-stone mt-0.5">Completada el {fecha(p.completedAt)}</p>
                  <p className="text-xs text-stone-soft">{p.accumulatedMinutes} min de enfoque</p>
                </PlantCardTrigger>
              ))}
            </ul>
            {garden.totalCompleted > garden.completed.length && (
              <div className="mt-5 flex justify-center">
                <Link
                  href={`/explorar/jardin?mostrar=${shown + PAGE_SIZE}`}
                  scroll={false}
                  className="btn btn-secondary"
                  data-testid="garden-more"
                >
                  Ver más ({garden.totalCompleted - garden.completed.length} restantes)
                </Link>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
