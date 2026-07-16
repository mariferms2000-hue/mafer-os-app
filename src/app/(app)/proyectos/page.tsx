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
          variant="semilla"
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
                  className="card p-5 flex flex-col gap-3 hover:shadow-lift transition-shadow h-full"
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

                  {/* 2-6. Ruta visual del proyecto: estado → siguiente acción → fecha (datos reales) */}
                  <ul className="flex flex-col">
                    <li className="relative pl-6 pb-2.5">
                      <span className="absolute left-[6px] top-[16px] bottom-0 w-px bg-sand" aria-hidden />
                      <span
                        className={`absolute left-0 top-[3px] h-3.5 w-3.5 rounded-full border-2 ${
                          p.status === "activo"
                            ? "border-sage-deep bg-sage-soft"
                            : p.status === "esperando"
                              ? "border-waiting bg-waiting-soft"
                              : p.status === "terminado"
                                ? "border-done bg-done-soft"
                                : "border-stone-soft bg-transparent"
                        }`}
                        aria-hidden
                      />
                      <p className="text-xs text-stone leading-relaxed">
                        <span className="capitalize font-medium text-charcoal">{p.status}</span>
                        {" · "}
                        <ListTodo size={11} className="inline -mt-0.5" aria-hidden /> {o.openCount} abiertas
                        {o.blockedCount > 0 && (
                          <span className="text-blocked"> · <Ban size={11} className="inline -mt-0.5" aria-hidden /> {o.blockedCount} bloqueada{o.blockedCount > 1 ? "s" : ""}</span>
                        )}
                        {o.waitingCount > 0 && (
                          <span className="text-waiting"> · <Hourglass size={11} className="inline -mt-0.5" aria-hidden /> {o.waitingCount} esperando</span>
                        )}
                      </p>
                    </li>
                    <li className={`relative pl-6 ${o.nextDate ? "pb-2.5" : ""}`}>
                      {o.nextDate && <span className="absolute left-[6px] top-[16px] bottom-0 w-px bg-sand" aria-hidden />}
                      <span className="absolute left-0 top-[2px] flex h-3.5 w-3.5 items-center justify-center text-sage-deep" aria-hidden>
                        <ArrowRight size={13} />
                      </span>
                      {o.nextActionCard && !o.nextActionCompleted ? (
                        <p className="text-sm text-ink-green font-medium line-clamp-2 leading-snug">{o.nextActionCard.title}</p>
                      ) : o.nextActionText ? (
                        <p className="text-sm text-ink-green line-clamp-2 leading-snug">{o.nextActionText}</p>
                      ) : (
                        <p className="text-sm text-stone-soft flex items-center gap-1.5" data-testid="card-no-next">
                          <CircleAlert size={14} aria-hidden /> Falta definir la siguiente acción.
                        </p>
                      )}
                    </li>
                    {o.nextDate && (
                      <li className="relative pl-6">
                        <span className="absolute left-0 top-[2px] flex h-3.5 w-3.5 items-center justify-center text-stone-soft" aria-hidden>
                          <CalendarClock size={12} />
                        </span>
                        <p className="text-xs text-stone">{o.nextDate}</p>
                      </li>
                    )}
                  </ul>

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
