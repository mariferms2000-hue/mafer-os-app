import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { ArrowLeft, ArrowRight, RotateCcw, Scale } from "lucide-react";
import { db, schema } from "@/lib/db";
import { getOrCreateBoard, touchRecent } from "@/lib/db/helpers";
import { Board } from "@/components/board/board";
import { ProjectIcon } from "@/components/projects/project-icon";
import { EditProjectButton } from "@/components/projects/edit-project";

export const dynamic = "force-dynamic";

export default async function ProyectoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ retomar?: string }>;
}) {
  const { id } = await params;
  const { retomar } = await searchParams;
  const project = await db.select().from(schema.projects).where(eq(schema.projects.id, id)).get();
  if (!project) notFound();

  const boardId = await getOrCreateBoard(id);
  const cols = await db
    .select()
    .from(schema.columns)
    .where(eq(schema.columns.boardId, boardId))
    .orderBy(asc(schema.columns.position));
  const cards = await db
    .select()
    .from(schema.cards)
    .where(and(eq(schema.cards.projectId, id), eq(schema.cards.archived, false)))
    .orderBy(asc(schema.cards.position));
  const decisionsRows = await db
    .select()
    .from(schema.decisions)
    .where(eq(schema.decisions.projectId, id))
    .orderBy(desc(schema.decisions.date));
  const lastTouched = [...cards].sort((a, b) => (b.updatedAt < a.updatedAt ? -1 : 1))[0];
  const open = cards.filter((c) => !c.completedAt);
  const resourcesCount = (
    await db.select({ id: schema.resources.id }).from(schema.resources).where(eq(schema.resources.projectId, id))
  ).length;

  await touchRecent("proyecto", id, project.title, `/proyectos/${id}`);

  return (
    <div>
      <Link href="/proyectos" className="text-sm text-stone hover:text-charcoal inline-flex items-center gap-1 mb-3">
        <ArrowLeft size={14} aria-hidden /> Proyectos
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div className="flex items-start gap-3 min-w-0">
          <ProjectIcon name={project.icon ?? "folder"} className="h-12 w-12" />
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl text-forest-deep">{project.title}</h1>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              <span className={`chip capitalize ${project.status === "activo" ? "chip-sage" : ""}`}>{project.status}</span>
              <span className="chip capitalize">{project.area}</span>
              {project.targetDate && <span className="chip">Meta: {project.targetDate}</span>}
              {project.isStarter && <span className="chip">Ejemplo — edítalo o bórralo</span>}
            </div>
            {project.objective && <p className="text-sm text-stone mt-2 max-w-2xl">{project.objective}</p>}
          </div>
        </div>
        <EditProjectButton project={project} />
      </header>

      {/* Panel Retomar proyecto */}
      <details className="card mb-5 group" open={retomar === "1"}>
        <summary className="flex items-center gap-2 cursor-pointer list-none px-5 py-3.5 text-sm font-medium text-forest">
          <RotateCcw size={16} aria-hidden /> Retomar proyecto — ¿dónde me quedé?
          <span className="ml-auto text-stone-soft text-xs group-open:hidden">abrir</span>
        </summary>
        <div className="px-5 pb-5 grid gap-4 md:grid-cols-2 text-sm">
          <div>
            <p className="label">Próxima acción concreta</p>
            <p className={project.nextAction ? "text-ink-green font-medium" : "text-stone-soft"}>
              {project.nextAction || "Sin definir — edita el proyecto y escribe el siguiente paso."}
            </p>
          </div>
          <div>
            <p className="label">Última actividad</p>
            <p className="text-stone">
              {lastTouched
                ? `«${lastTouched.title}» — ${lastTouched.updatedAt.slice(0, 10)}`
                : "Todavía no hay tarjetas en este proyecto."}
            </p>
          </div>
          <div>
            <p className="label">Trabajo abierto</p>
            <p className="text-stone">
              {open.length} tarjeta{open.length !== 1 ? "s" : ""} abiertas
              {open.some((c) => c.blockedReason) && " · hay bloqueos"}
              {open.some((c) => c.waitingFor) && " · hay esperas"}
            </p>
          </div>
          <div>
            <p className="label">Última decisión</p>
            {decisionsRows[0] ? (
              <p className="text-stone">
                «{decisionsRows[0].title}» ({decisionsRows[0].date})
                {decisionsRows[0].decision && ` — ${decisionsRows[0].decision}`}
              </p>
            ) : (
              <p className="text-stone-soft">Sin decisiones registradas.</p>
            )}
          </div>
          {project.notes && (
            <div className="md:col-span-2">
              <p className="label">Notas del proyecto</p>
              <p className="text-stone whitespace-pre-wrap">{project.notes}</p>
            </div>
          )}
          {project.links && project.links.length > 0 && (
            <div className="md:col-span-2">
              <p className="label">Enlaces</p>
              <ul className="flex flex-wrap gap-2">
                {project.links.map((l, i) => (
                  <li key={i}>
                    <a href={l.url} target="_blank" rel="noreferrer" className="chip hover:bg-sand">
                      {l.label || l.url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </details>

      <Board
        columns={cols.map((c) => ({ id: c.id, title: c.title, kind: c.kind }))}
        cards={cards}
      />

      <div className="mt-6 flex flex-wrap gap-4 text-sm">
        <Link href={`/biblioteca/prompts?proyecto=${id}`} className="text-forest underline underline-offset-4 hover:text-forest-deep inline-flex items-center gap-1">
          Prompts de este proyecto <ArrowRight size={13} aria-hidden />
        </Link>
        <Link href={`/explorar/decisiones?proyecto=${id}`} className="text-forest underline underline-offset-4 hover:text-forest-deep inline-flex items-center gap-1">
          <Scale size={13} aria-hidden /> Decisiones ({decisionsRows.length})
        </Link>
        <Link href={`/biblioteca/recursos?proyecto=${id}`} className="text-forest underline underline-offset-4 hover:text-forest-deep inline-flex items-center gap-1">
          Recursos ({resourcesCount}) <ArrowRight size={13} aria-hidden />
        </Link>
      </div>
    </div>
  );
}
