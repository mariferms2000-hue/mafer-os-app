import { desc, eq } from "drizzle-orm";
import { Scale, Plus } from "lucide-react";
import { db, today, schema } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ExplorarTabs } from "@/components/explore/tabs";
import { createDecisionAction } from "@/lib/actions/explore";

export const dynamic = "force-dynamic";
export const metadata = { title: "Decisiones" };

export default async function DecisionesPage({
  searchParams,
}: {
  searchParams: Promise<{ proyecto?: string }>;
}) {
  const { proyecto = "" } = await searchParams;
  let decisionsRows = await db.select().from(schema.decisions).orderBy(desc(schema.decisions.date));
  if (proyecto) decisionsRows = decisionsRows.filter((d) => d.projectId === proyecto);
  const projects = await db
    .select({ id: schema.projects.id, title: schema.projects.title })
    .from(schema.projects)
    .where(eq(schema.projects.archived, false));
  const projectName = new Map(projects.map((p) => [p.id, p.title]));

  return (
    <div>
      <PageHeader
        icon={Scale}
        title="Decisiones"
        intro="Un registro simple de qué decidiste, por qué y qué esperabas. Tu yo del futuro te lo agradecerá."
      />
      <ExplorarTabs />

      <details className="card mb-6">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-forest flex items-center gap-2">
          <Plus size={15} aria-hidden /> Registrar una decisión
        </summary>
        <form action={createDecisionAction} className="px-4 pb-4 flex flex-col gap-3">
          <div className="grid md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="label" htmlFor="d-title">Decisión</label>
              <input id="d-title" name="title" className="input" required placeholder="Ej.: usar Framer en vez de WordPress" />
            </div>
            <div>
              <label className="label" htmlFor="d-date">Fecha</label>
              <input id="d-date" name="date" type="date" className="input" defaultValue={today()} />
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="d-context">Contexto</label>
              <textarea id="d-context" name="context" className="textarea" rows={2} />
            </div>
            <div>
              <label className="label" htmlFor="d-reason">Razón</label>
              <textarea id="d-reason" name="reason" className="textarea" rows={2} />
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="d-consequences">Consecuencias esperadas</label>
              <textarea id="d-consequences" name="consequences" className="textarea" rows={2} />
            </div>
            <div>
              <label className="label" htmlFor="d-project">Proyecto</label>
              <select id="d-project" name="projectId" className="select" defaultValue={proyecto}>
                <option value="">Sin proyecto</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>
          </div>
          <button type="submit" className="btn btn-primary self-start">Guardar decisión</button>
        </form>
      </details>

      {decisionsRows.length === 0 ? (
        <EmptyState
          icon={Scale}
          title="Sin decisiones registradas"
          hint="Cuando tomes una decisión importante — de proyecto, de compra, de rumbo — anótala aquí con su porqué."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {decisionsRows.map((d) => (
            <li key={d.id} className="card p-4">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <p className="text-sm font-semibold flex-1">{d.title}</p>
                <span className="chip">{d.date}</span>
                {d.projectId && projectName.get(d.projectId) && (
                  <span className="chip chip-sage">{projectName.get(d.projectId)}</span>
                )}
              </div>
              {d.context && <p className="text-sm text-stone"><strong className="text-charcoal">Contexto:</strong> {d.context}</p>}
              {d.reason && <p className="text-sm text-stone"><strong className="text-charcoal">Razón:</strong> {d.reason}</p>}
              {d.consequences && <p className="text-sm text-stone"><strong className="text-charcoal">Consecuencias:</strong> {d.consequences}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
