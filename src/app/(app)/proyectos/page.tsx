import Link from "next/link";
import { SquareKanban, Ban, Hourglass, ListTodo, ArrowRight, CalendarClock, CircleAlert } from "lucide-react";
import { today } from "@/lib/db";
import { getProjectsOverview, type ProjectOverview } from "@/lib/queries/projects";
import { humanDate, type ProjectIssueKind } from "@/lib/project-health";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { NewProjectButton } from "@/components/projects/new-project";
import { ProjectIcon } from "@/components/projects/project-icon";
import { ProjectsFilter } from "@/components/projects/projects-filter";

export const dynamic = "force-dynamic";
export const metadata = { title: "Proyectos" };

const URGENCIA: ProjectIssueKind[] = ["tarea-vencida", "bloqueado", "esperando-mucho", "sin-accion", "inactivo"];
const urgencia = (o: ProjectOverview) =>
  o.issues.length ? URGENCIA.indexOf(o.issues[0].kind) : URGENCIA.length;

export default async function ProyectosPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string; area?: string; nuevo?: string }>;
}) {
  const { f = "activos", area = "", nuevo } = await searchParams;
  const d = today();
  const overview = await getProjectsOverview();

  const activos = overview.filter((o) => o.project.status === "activo" && !o.project.archived);
  const atencionCount = activos.filter((o) => o.issues.length > 0).length;

  let list = overview;
  if (f === "activos") list = activos;
  else if (f === "atencion") list = activos.filter((o) => o.issues.length > 0).sort((a, b) => urgencia(a) - urgencia(b));
  else if (f === "pausados") list = overview.filter((o) => o.project.status === "pausado" && !o.project.archived);
  else if (f === "esperando") list = overview.filter((o) => o.project.status === "esperando" && !o.project.archived);
  else if (f === "terminados") list = overview.filter((o) => o.project.status === "terminado" && !o.project.archived);
  else if (f === "archivados") list = overview.filter((o) => o.project.archived);
  else list = overview.filter((o) => !o.project.archived); // todos
  if (area) list = list.filter((o) => o.project.area === area);

  return (
    <div>
      <PageHeader
        icon={SquareKanban}
        title="Proyectos"
        intro="Qué necesita atención, cuál es el siguiente paso y dónde te quedaste — sin reconstruir nada de memoria."
      >
        <NewProjectButton autoOpen={nuevo === "1"} />
      </PageHeader>

      <ProjectsFilter f={f} area={area} atencion={atencionCount} />

      {f === "atencion" && list.length === 0 ? (
        <EmptyState icon={SquareKanban} title="Nada necesita atención 🌿" hint="Todos tus proyectos activos tienen siguiente acción, sin bloqueos ni tareas vencidas." />
      ) : list.length === 0 ? (
        <EmptyState
          icon={SquareKanban}
          title={f === "activos" ? "Aún no hay proyectos activos" : "Nada con este filtro"}
          hint="Un proyecto es algo con un resultado deseado y más de un paso. Lo demás puede vivir tranquilamente en la Incubadora."
        >
          <NewProjectButton />
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((o) => {
            const p = o.project;
            const alerts = o.issues.slice(0, 2); // máximo dos, la más urgente primero
            return (
              <li key={p.id}>
                <Link
                  href={`/proyectos/${p.id}`}
                  className="card p-5 flex flex-col gap-2.5 hover:shadow-lift transition-shadow h-full"
                  data-testid={`project-card-${p.id}`}
                >
                  {/* 1. Nombre */}
                  <div className="flex items-center gap-3">
                    <ProjectIcon name={p.icon ?? "folder"} className="h-10 w-10" />
                    <div className="min-w-0">
                      <h2 className="text-base font-body font-semibold truncate">{p.title}</h2>
                      <p className="text-xs text-stone capitalize">{p.area}</p>
                    </div>
                  </div>

                  {/* 2. Siguiente acción concreta */}
                  {o.nextActionCard && !o.nextActionCompleted ? (
                    <p className="text-sm flex items-start gap-1.5 text-ink-green">
                      <ArrowRight size={14} className="mt-0.5 shrink-0 text-olive" aria-hidden />
                      <span className="line-clamp-2 font-medium">{o.nextActionCard.title}</span>
                    </p>
                  ) : o.nextActionText ? (
                    <p className="text-sm flex items-start gap-1.5 text-ink-green">
                      <ArrowRight size={14} className="mt-0.5 shrink-0 text-olive" aria-hidden />
                      <span className="line-clamp-2">{o.nextActionText}</span>
                    </p>
                  ) : (
                    <p className="text-sm text-stone-soft flex items-center gap-1.5" data-testid="card-no-next">
                      <CircleAlert size={14} aria-hidden /> Falta definir la siguiente acción.
                    </p>
                  )}

                  {/* 3-5. Estado, abiertas, bloqueo/espera */}
                  <div className="flex flex-wrap gap-1.5">
                    <span className={`chip ${p.status === "activo" ? "chip-sage" : ""} capitalize`}>{p.status}</span>
                    <span className="chip"><ListTodo size={11} aria-hidden /> {o.openCount} abiertas</span>
                    {o.blockedCount > 0 && (
                      <span className="chip chip-blocked"><Ban size={11} aria-hidden /> {o.blockedCount}</span>
                    )}
                    {o.waitingCount > 0 && (
                      <span className="chip chip-waiting"><Hourglass size={11} aria-hidden /> {o.waitingCount}</span>
                    )}
                    {/* 6. Fecha relevante más próxima */}
                    {o.nextDate && <span className="chip"><CalendarClock size={11} aria-hidden /> {o.nextDate}</span>}
                  </div>

                  {/* Progreso honesto: tareas, no proyecto */}
                  {o.totalCount > 0 && (
                    <div className="flex items-center gap-2.5">
                      <div
                        className="progress-track flex-1"
                        role="progressbar"
                        aria-valuenow={o.doneCount}
                        aria-valuemin={0}
                        aria-valuemax={o.totalCount}
                        aria-label={`Tareas completadas de ${p.title}`}
                      >
                        <div className="progress-fill" style={{ width: `${Math.round((o.doneCount / o.totalCount) * 100)}%` }} />
                      </div>
                      <span className="text-xs text-stone tabular-nums shrink-0" data-testid="task-progress">
                        {o.doneCount}/{o.totalCount} tareas
                      </span>
                    </div>
                  )}

                  {/* 7. Última actividad + máx. 2 alertas (la más urgente con más jerarquía) */}
                  <div className="mt-auto pt-1 flex flex-col gap-1.5">
                    <p className="text-xs text-stone-soft">Actividad: {humanDate(o.lastActivity, d)}</p>
                    {alerts.length > 0 && (
                      <div className="flex flex-wrap gap-1.5" data-testid="card-alerts">
                        {alerts.map((a, i) => (
                          <span key={a.kind} className={`chip ${i === 0 ? "chip-blocked" : "chip-waiting"}`}>
                            <CircleAlert size={11} aria-hidden /> {a.label}
                          </span>
                        ))}
                      </div>
                    )}
                    {p.isStarter && <span className="chip self-start">Ejemplo</span>}
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
