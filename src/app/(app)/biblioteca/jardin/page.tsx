import Link from "next/link";
import { Sprout, Leaf } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { GardenView } from "@/components/garden/garden-view";
import { getCompletedPlantsByIds, getGarden } from "@/lib/queries/focus";
import { getProgressOverview } from "@/lib/queries/progress";
import { getCareState, settleThirst } from "@/lib/garden/care";
import { GardenRewards } from "@/components/explore/garden-rewards";
import { BibliotecaBack } from "@/components/library/section-nav";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mi jardín" };

/* Explorar → Mi jardín — el invernadero (F4).

   1) LA ESCENA (GardenView): el invernadero con la planta actual en su frasco
      de propagación, bajo su lámpara, y una selección de las completadas
      repartidas según su tamaño (banco, suelo, pedestal, colgadas). Tiene aforo
      a propósito: se ve igual de bien con 3 plantas que con 600.
   2) LAS RECOMPENSAS: el camino hacia la próxima y el inventario.
   3) EL INVERNADERO: la cuadrícula con la COLECCIÓN COMPLETA y su paginación.

   El cuidado (sed, Agua, Fertilizante, planta especial) vive aparte de
   focus_plants, en garden_plant_care: nunca cambia minutos ni etapas. */

const PAGE_SIZE = 12;
/** Cuántas completadas recientes se ofrecen a la escena (que elige por tamaño). */
const SCENE_CANDIDATES = 40;

export default async function JardinPage({
  searchParams,
}: {
  searchParams: Promise<{ mostrar?: string; recompensa?: string }>;
}) {
  const { mostrar, recompensa } = await searchParams;
  const requested = Number.parseInt(mostrar ?? "", 10);
  const shown = Number.isFinite(requested) ? Math.min(Math.max(PAGE_SIZE, requested), 600) : PAGE_SIZE;

  // La sed avanza al abrir el jardín (no hay tareas programadas).
  await settleThirst();
  const [garden, progress, care] = await Promise.all([getGarden(Math.max(shown, SCENE_CANDIDATES)), getProgressOverview(), getCareState()]);
  // La especial y las que tienen sed salen primero en la escena aunque sean antiguas.
  const priorityIds = Object.entries(care.care)
    .filter(([, c]) => c.special || c.thirsty)
    .map(([id]) => id)
    .filter((id) => !garden.completed.some((p) => p.id === id));
  const extraPlants = await getCompletedPlantsByIds(priorityIds).catch(() => []);

  return (
    <div>
      <BibliotecaBack />
      <PageHeader
        icon={Sprout}
        title="Mi jardín"
        intro="Cada planta conserva el tiempo que decidiste cuidar. Crece a tu ritmo; aquí nada caduca ni se pierde."
      >
        <Link href="/biblioteca/jardin/especies" className="btn btn-secondary" data-testid="garden-view-species">
          <Leaf size={15} aria-hidden /> Ver especies
        </Link>
      </PageHeader>

      <GardenView
        garden={garden}
        extraPlants={extraPlants}
        greenhouse={garden.completed.slice(0, shown)}
        shown={shown}
        care={care}
        rewards={progress ? <GardenRewards progress={progress} highlight={recompensa} /> : null}
      />
    </div>
  );
}
