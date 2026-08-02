import Link from "next/link";
import { Sprout, Leaf } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ExplorarTabs } from "@/components/explore/tabs";
import { GardenFocusButton } from "@/components/explore/garden-focus-button";
import { GardenRoom } from "@/components/explore/garden-room";
import { PlantCardTrigger } from "@/components/explore/plant-card-trigger";
import { PlantArt } from "@/components/focus/plant-art";
import { getGarden } from "@/lib/queries/focus";
import { MAX_ROOM_PLANTS } from "@/lib/garden-layout";
import { STAGES, type StageKey } from "@/lib/focus-logic";
import { SPECIES_LABEL } from "@/lib/plant-svg-v2";
import type { PlantSpeciesV2 } from "@/lib/plant-render-v2";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mi jardín" };

/* Explorar → Mi jardín — el cuarto botánico.

   Dos piezas, con papeles distintos:

   1) EL CUARTO (GardenRoom): una vitrina. La planta actual en su mesa de
      propagación y una selección de las completadas más recientes posadas en
      el alféizar, las repisas y el suelo. Tiene aforo a propósito — así se ve
      igual de bien con 6 plantas que con 600.

   2) EL INVERNADERO: la cuadrícula de siempre, con la COLECCIÓN COMPLETA y su
      paginación. Ninguna planta se esconde ni se pierde por no caber arriba.

   Sigue siendo solo lectura sobre focus_plants. Mover plantas entre sitios
   (y por tanto guardar nada) es trabajo del PR siguiente. */

const STAGE_LABEL: Record<StageKey, string> = Object.fromEntries(STAGES.map((s) => [s.key, s.label])) as Record<
  StageKey,
  string
>;

const PAGE_SIZE = 12;

/** Solo especies conocidas llegan al motor de render; cualquier otra cosa en la
 *  base (no debería existir tras el backfill) se dibuja como la primera especie. */
function asSpecies(s: string): PlantSpeciesV2 {
  return (s in SPECIES_LABEL ? s : "helecho") as PlantSpeciesV2;
}

function fecha(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

export default async function JardinPage({ searchParams }: { searchParams: Promise<{ mostrar?: string }> }) {
  const { mostrar } = await searchParams;
  const requested = Number.parseInt(mostrar ?? "", 10);
  const shown = Number.isFinite(requested) ? Math.min(Math.max(PAGE_SIZE, requested), 600) : PAGE_SIZE;

  // El cuarto puede necesitar más plantas que la primera página del invernadero.
  const garden = await getGarden(Math.max(shown, MAX_ROOM_PLANTS));
  const greenhouse = garden.completed.slice(0, shown);
  const c = garden.current;

  return (
    <div>
      <PageHeader
        icon={Sprout}
        title="Mi jardín"
        intro="Cada planta conserva el tiempo que decidiste cuidar. Crece a tu ritmo; aquí nada caduca ni se pierde."
      >
        <Link href="/explorar/jardin/especies" className="btn btn-secondary" data-testid="garden-view-species">
          <Leaf size={15} aria-hidden /> Ver especies
        </Link>
      </PageHeader>
      <ExplorarTabs />

      {/* El cuarto: la escena con la planta actual y las completadas más recientes */}
      <section aria-labelledby="planta-actual" className="mb-10" data-testid="garden-current">
        <div className="card card-raised !p-0 overflow-hidden !border-border-focus/40">
          <GardenRoom garden={garden} />

          <div className="border-t border-sand px-5 py-4 md:px-7 md:py-5 flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="min-w-0 flex-1">
              <p id="planta-actual" className="section-eyebrow">
                Planta actual
              </p>
              {c ? (
                <>
                  <h2 className="text-2xl md:text-3xl text-forest-deep mt-1" data-testid="garden-current-species">
                    {SPECIES_LABEL[c.species] ?? c.species}
                  </h2>
                  <p className="text-sm text-stone mt-0.5" data-testid="garden-current-stage">
                    {STAGE_LABEL[c.stage]} · en la mesa de propagación
                  </p>
                  <p className="text-sm text-stone mt-2" data-testid="garden-current-progress">
                    {c.next
                      ? `${c.accumulatedMinutes} de ${c.accumulatedMinutes + c.next.missingMinutes} min para ${STAGE_LABEL[c.next.key].toLowerCase()}`
                      : "Tu planta está completa"}
                  </p>
                  <p className="text-xs text-stone-soft mt-1">
                    La cuidas desde el {fecha(c.startedAt)} · {c.accumulatedMinutes} min de enfoque
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-2xl md:text-3xl text-forest-deep mt-1" data-testid="garden-current-species">
                    Semilla nueva
                  </h2>
                  <p className="text-sm text-stone mt-0.5" data-testid="garden-current-stage">
                    {STAGE_LABEL.semilla} · en la mesa de propagación
                  </p>
                  <p className="text-sm text-stone mt-2" data-testid="garden-current-progress">
                    Tu primera sesión de enfoque la hará nacer
                  </p>
                </>
              )}
            </div>
            <div className="shrink-0">
              <GardenFocusButton testid="garden-focus" />
            </div>
          </div>
        </div>
      </section>

      {/* El invernadero: la colección completa, con su cuadrícula y paginación */}
      <section aria-labelledby="tu-jardin">
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <h2 id="tu-jardin" className="section-eyebrow">
            El invernadero
          </h2>
          {garden.totalCompleted > 0 && (
            <p className="text-xs text-stone-soft">
              {garden.totalCompleted} {garden.totalCompleted === 1 ? "planta completada" : "plantas completadas"}
            </p>
          )}
        </div>
        {greenhouse.length === 0 ? (
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
              {greenhouse.map((p) => (
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
                    size="small"
                    className="h-32 w-32 text-sage-deep"
                  />
                  <p className="font-display text-lg text-forest-deep mt-2">{SPECIES_LABEL[p.species] ?? p.species}</p>
                  <p className="text-xs text-stone mt-0.5">Completada el {fecha(p.completedAt)}</p>
                  <p className="text-xs text-stone-soft">{p.accumulatedMinutes} min de enfoque</p>
                </PlantCardTrigger>
              ))}
            </ul>
            {garden.totalCompleted > greenhouse.length && (
              <div className="mt-5 flex justify-center">
                <Link
                  href={`/explorar/jardin?mostrar=${shown + PAGE_SIZE}`}
                  scroll={false}
                  className="btn btn-secondary"
                  data-testid="garden-more"
                >
                  Ver más ({garden.totalCompleted - greenhouse.length} restantes)
                </Link>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
