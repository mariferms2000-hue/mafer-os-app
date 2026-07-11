import Link from "next/link";
import { and, eq, isNull } from "drizzle-orm";
import { SquareKanban, Ban, ListTodo, ArrowRight, CalendarClock } from "lucide-react";
import { db, schema } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { NewProjectButton } from "@/components/projects/new-project";
import { ProjectIcon } from "@/components/projects/project-icon";

export const dynamic = "force-dynamic";
export const metadata = { title: "Proyectos" };

const FILTROS = [
  { key: "activos", label: "Activos" },
  { key: "pausados", label: "Pausados" },
  { key: "esperando", label: "Esperando" },
  { key: "terminados", label: "Terminados" },
  { key: "archivados", label: "Archivados" },
  { key: "todos", label: "Todos" },
];

const AREAS = [
  { key: "", label: "Todas las áreas" },
  { key: "personal", label: "Personal" },
  { key: "profesional", label: "Profesional" },
  { key: "aprendizaje", label: "Aprendizaje" },
  { key: "familia", label: "Familia y colaboración" },
];

export default async function ProyectosPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string; area?: string; nuevo?: string }>;
}) {
  const { f = "activos", area = "", nuevo } = await searchParams;
  const all = await db.select().from(schema.projects);
  const openCards = await db
    .select({ id: schema.cards.id, projectId: schema.cards.projectId, blocked: schema.cards.blockedReason })
    .from(schema.cards)
    .where(and(eq(schema.cards.archived, false), isNull(schema.cards.completedAt)));

  const counts = new Map<string, { open: number; blocked: number }>();
  for (const c of openCards) {
    if (!c.projectId) continue;
    const e = counts.get(c.projectId) ?? { open: 0, blocked: 0 };
    e.open++;
    if (c.blocked) e.blocked++;
    counts.set(c.projectId, e);
  }

  let projects = all;
  if (f === "activos") projects = all.filter((p) => p.status === "activo" && !p.archived);
  else if (f === "pausados") projects = all.filter((p) => p.status === "pausado" && !p.archived);
  else if (f === "esperando") projects = all.filter((p) => p.status === "esperando" && !p.archived);
  else if (f === "terminados") projects = all.filter((p) => p.status === "terminado" && !p.archived);
  else if (f === "archivados") projects = all.filter((p) => p.archived);
  if (area) projects = projects.filter((p) => p.area === area);

  return (
    <div>
      <PageHeader
        icon={SquareKanban}
        title="Proyectos"
        intro="Tu portafolio completo: qué está vivo, qué espera y cuál es el siguiente paso de cada cosa."
      >
        <NewProjectButton autoOpen={nuevo === "1"} />
      </PageHeader>

      <div className="flex flex-wrap items-center gap-1.5 mb-5">
        {FILTROS.map((fl) => (
          <Link
            key={fl.key}
            href={`/proyectos?f=${fl.key}${area ? `&area=${area}` : ""}`}
            className={`chip transition-colors ${f === fl.key ? "!bg-forest !text-cream !border-forest" : "hover:bg-sand"}`}
          >
            {fl.label}
          </Link>
        ))}
        <span className="mx-1 text-sand-deep" aria-hidden>·</span>
        {AREAS.map((a) => (
          <Link
            key={a.key}
            href={`/proyectos?f=${f}${a.key ? `&area=${a.key}` : ""}`}
            className={`chip transition-colors ${area === a.key ? "!bg-olive !text-cream !border-olive" : "hover:bg-sand"}`}
          >
            {a.label}
          </Link>
        ))}
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={SquareKanban}
          title={f === "activos" ? "Aún no hay proyectos activos" : "Nada con este filtro"}
          hint="Un proyecto es algo con un resultado deseado y más de un paso. Lo demás puede vivir tranquilamente en la Incubadora."
        >
          <NewProjectButton />
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const c = counts.get(p.id) ?? { open: 0, blocked: 0 };
            return (
              <li key={p.id}>
                <Link
                  href={`/proyectos/${p.id}`}
                  className="card p-5 flex flex-col gap-3 hover:shadow-lift transition-shadow h-full"
                  data-testid={`project-card-${p.id}`}
                >
                  <div className="flex items-center gap-3">
                    <ProjectIcon name={p.icon ?? "folder"} className="h-10 w-10" />
                    <div className="min-w-0">
                      <h2 className="text-base font-body font-semibold truncate">{p.title}</h2>
                      <p className="text-xs text-stone capitalize">{p.area}</p>
                    </div>
                  </div>
                  {p.objective && <p className="text-sm text-stone line-clamp-2">{p.objective}</p>}
                  {p.nextAction && (
                    <p className="text-sm flex items-start gap-1.5 text-ink-green">
                      <ArrowRight size={14} className="mt-0.5 shrink-0" aria-hidden />
                      <span className="line-clamp-2">{p.nextAction}</span>
                    </p>
                  )}
                  <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
                    <span className={`chip ${p.status === "activo" ? "chip-sage" : ""} capitalize`}>{p.status}</span>
                    {p.health && p.health !== "bien" && (
                      <span className={`chip ${p.health === "riesgo" ? "chip-blocked" : "chip-waiting"}`}>
                        {p.health === "riesgo" ? "En riesgo" : "Atención"}
                      </span>
                    )}
                    <span className="chip"><ListTodo size={11} aria-hidden /> {c.open} abiertas</span>
                    {c.blocked > 0 && <span className="chip chip-blocked"><Ban size={11} aria-hidden /> {c.blocked}</span>}
                    {p.targetDate && <span className="chip"><CalendarClock size={11} aria-hidden /> {p.targetDate}</span>}
                    {p.isStarter && <span className="chip">Ejemplo</span>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

    </div>
  );
}
