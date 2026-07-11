import { desc, eq, inArray } from "drizzle-orm";
import { Lightbulb, Sprout } from "lucide-react";
import { db, schema } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ExplorarTabs } from "@/components/explore/tabs";
import { IdeaCard } from "@/components/explore/idea-card";
import { createIdeaAction } from "@/lib/actions/explore";

export const dynamic = "force-dynamic";
export const metadata = { title: "Explorar" };

export default async function ExplorarPage() {
  const incubando = await db
    .select()
    .from(schema.ideas)
    .where(inArray(schema.ideas.status, ["incubando", "algun-dia"]))
    .orderBy(desc(schema.ideas.updatedAt));
  const resto = await db
    .select()
    .from(schema.ideas)
    .where(inArray(schema.ideas.status, ["graduada", "archivada", "rechazada"]))
    .orderBy(desc(schema.ideas.updatedAt))
    .limit(12);

  return (
    <div>
      <PageHeader
        icon={Lightbulb}
        title="Incubadora"
        intro="Aquí viven las posibilidades sin presión: ideas, maestrías, negocios, curiosidades. Nada de esto es un compromiso todavía — y eso está bien."
      />
      <ExplorarTabs />

      <form action={createIdeaAction} className="card p-4 mb-6 flex flex-col md:flex-row gap-2.5">
        <label className="sr-only" htmlFor="idea-title">Nueva idea</label>
        <input
          id="idea-title"
          name="title"
          className="input flex-1"
          placeholder="¿Qué idea quieres dejar incubando?"
          required
          data-testid="new-idea-input"
        />
        <select name="category" className="select md:!w-52" aria-label="Categoría">
          <option value="general">Por explorar</option>
          <option value="proyecto">Posible proyecto</option>
          <option value="estudio">Estudios / formación</option>
          <option value="negocio">Idea de negocio</option>
          <option value="experimento">Experimento personal</option>
        </select>
        <button type="submit" className="btn btn-primary" data-testid="new-idea-save">
          <Sprout size={15} aria-hidden /> Incubar
        </button>
      </form>

      {incubando.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title="La incubadora está vacía"
          hint="Cuando algo te llame la atención pero no sepas si es un proyecto de verdad, déjalo aquí. Crecerá (o no) sin ocupar tu cabeza."
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="idea-list">
          {incubando.map((idea) => (
            <IdeaCard key={idea.id} idea={idea} />
          ))}
        </ul>
      )}

      {resto.length > 0 && (
        <details className="mt-8">
          <summary className="text-sm text-stone cursor-pointer">
            Graduadas, archivadas y rechazadas ({resto.length})
          </summary>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-3">
            {resto.map((idea) => (
              <IdeaCard key={idea.id} idea={idea} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
