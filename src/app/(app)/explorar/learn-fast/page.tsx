import Link from "next/link";
import { desc } from "drizzle-orm";
import { Rocket, Plus } from "lucide-react";
import { db, schema } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ExplorarTabs } from "@/components/explore/tabs";
import { EvidenceChip } from "@/components/explore/evidence";
import { createLearningAction } from "@/lib/actions/explore";

export const dynamic = "force-dynamic";
export const metadata = { title: "Learn Fast" };

import { DEPTH_LABEL } from "@/components/explore/learning-labels";

const STATUS_LABEL: Record<string, string> = {
  idea: "Idea",
  activo: "Activo",
  pausado: "Pausado",
  terminado: "Terminado",
  archivado: "Archivado",
};

export default async function LearnFastPage() {
  const topics = await db.select().from(schema.learningTopics).orderBy(desc(schema.learningTopics.updatedAt));
  const active = topics.filter((t) => t.status === "activo");
  const rest = topics.filter((t) => t.status !== "activo" && t.status !== "archivado");
  const archived = topics.filter((t) => t.status === "archivado");

  return (
    <div>
      <PageHeader
        icon={Rocket}
        title="Learn Fast"
        intro="Para cuando quieres volverte buena en algo, rápido y con foco. Un sprint activo a la vez funciona mejor que cinco a medias."
      />
      <ExplorarTabs />

      <form action={createLearningAction} className="card p-4 mb-6 flex flex-col md:flex-row gap-2.5">
        <label className="sr-only" htmlFor="lf-title">Nuevo tema</label>
        <input id="lf-title" name="title" className="input flex-1" placeholder="¿Qué quieres aprender?" required data-testid="new-learning-input" />
        <select name="depth" className="select md:!w-44" aria-label="Profundidad deseada">
          <option value="exploracion">Exploración</option>
          <option value="fundamentos">Fundamentos</option>
          <option value="aplicacion">Aplicación</option>
          <option value="dominio">Dominio</option>
        </select>
        <button type="submit" className="btn btn-primary" data-testid="new-learning-save">
          <Plus size={15} aria-hidden /> Crear espacio
        </button>
      </form>

      {topics.length === 0 && (
        <EmptyState
          icon={Rocket}
          title="Sin temas de aprendizaje aún"
          hint="Crea un espacio para ese tema que quieres dominar. Definir qué significa «suficientemente bueno» es la mitad del camino."
        />
      )}

      {active.length > 0 && (
        <>
          <h2 className="text-lg text-forest-deep mb-3">Sprint activo</h2>
          <TopicGrid topics={active} highlight />
        </>
      )}
      {rest.length > 0 && (
        <>
          <h2 className="text-lg text-forest-deep mt-8 mb-3">En pausa e ideas</h2>
          <TopicGrid topics={rest} />
        </>
      )}
      {archived.length > 0 && (
        <details className="mt-8">
          <summary className="text-sm text-stone cursor-pointer">Archivados ({archived.length})</summary>
          <div className="mt-3">
            <TopicGrid topics={archived} />
          </div>
        </details>
      )}
    </div>
  );
}

function TopicGrid({
  topics,
  highlight,
}: {
  topics: (typeof schema.learningTopics.$inferSelect)[];
  highlight?: boolean;
}) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {topics.map((t) => (
        <li key={t.id}>
          <Link
            href={`/explorar/learn-fast/${t.id}`}
            className={`card p-4 flex flex-col gap-2 h-full hover:shadow-lift transition-shadow ${
              highlight ? "!border-sage-deep" : ""
            }`}
            data-testid={`learning-${t.id}`}
          >
            <p className="text-sm font-semibold">{t.title}</p>
            {t.motivation && <p className="text-sm text-stone line-clamp-2">{t.motivation}</p>}
            {(t.progress ?? 0) > 0 && (
              <div className="h-1.5 rounded-full bg-beige overflow-hidden" role="progressbar" aria-valuenow={t.progress ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label={`Progreso de ${t.title}`}>
                <div className="h-full bg-sage-deep rounded-full" style={{ width: `${t.progress}%` }} />
              </div>
            )}
            <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
              <span className="chip chip-sage">{DEPTH_LABEL[t.depth ?? "exploracion"]}</span>
              <span className="chip">{STATUS_LABEL[t.status] ?? t.status}</span>
              <EvidenceChip value={t.evidenceClass} />
              {t.isStarter && <span className="chip">Ejemplo</span>}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
