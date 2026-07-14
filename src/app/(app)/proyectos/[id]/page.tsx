import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { ArrowLeft, ArrowRight, Scale, CircleAlert } from "lucide-react";
import { db, today, schema } from "@/lib/db";
import { getOrCreateBoard, touchRecent } from "@/lib/db/helpers";
import { getProjectsOverview } from "@/lib/queries/projects";
import { humanDate } from "@/lib/project-health";
import { Board } from "@/components/board/board";
import { ProjectIcon } from "@/components/projects/project-icon";
import { EditProjectButton } from "@/components/projects/edit-project";
import { NextActionBlock } from "@/components/projects/next-action";
import { ResumePanel, type ResumeData } from "@/components/projects/resume-panel";

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
  const d = today();
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
  const promptsCount = (
    await db.select({ id: schema.prompts.id }).from(schema.prompts).where(eq(schema.prompts.projectId, id))
  ).length;
  const resourcesCount = (
    await db.select({ id: schema.resources.id }).from(schema.resources).where(eq(schema.resources.projectId, id))
  ).length;

  const overview = (await getProjectsOverview()).find((o) => o.project.id === id)!;
  const colKind = new Map(cols.map((c) => [c.id, c.kind]));
  const open = cards.filter((c) => !c.completedAt);
  const enProceso = open
    .filter((c) => colKind.get(c.columnId ?? "") === "proceso")
    .sort((a, b) => (b.updatedAt < a.updatedAt ? -1 : 1))[0];
  const ultimaCompletada = cards
    .filter((c) => c.completedAt)
    .sort((a, b) => ((b.completedAt ?? "") < (a.completedAt ?? "") ? -1 : 1))[0];

  // «Dónde me quedé»: transparente, sin inventar nada.
  let whereIWas: string | null = null;
  if (enProceso) whereIWas = `Estabas trabajando en «${enProceso.title}» (${humanDate(enProceso.updatedAt, d)}).`;
  else if (ultimaCompletada)
    whereIWas = `Lo último que terminaste: «${ultimaCompletada.title}» (${humanDate(ultimaCompletada.completedAt, d)}).`;

  const blocked = open.filter((c) => c.blockedReason || colKind.get(c.columnId ?? "") === "bloqueado");
  const waiting = open.filter((c) => c.waitingFor || colKind.get(c.columnId ?? "") === "esperando");
  const upcoming = open
    .filter((c) => c.dueDate && c.dueDate >= d)
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))
    .slice(0, 3);

  const nextCard = overview.nextActionCard && !overview.nextActionCompleted ? overview.nextActionCard : null;
  const dec = decisionsRows[0];

  const resume: ResumeData = {
    projectId: id,
    objective: project.objective ?? "",
    statusLabel: `${project.status} · ${open.length} tarea${open.length !== 1 ? "s" : ""} abierta${open.length !== 1 ? "s" : ""}`,
    whereIWas,
    lastActivityHuman: humanDate(overview.lastActivity, d),
    lastDecision: dec ? `«${dec.title}» (${dec.date})${dec.decision ? ` — ${dec.decision}` : ""}` : null,
    inProgressTask: enProceso ? { id: enProceso.id, title: enProceso.title } : null,
    nextAction: nextCard ? { id: nextCard.id, title: nextCard.title } : null,
    nextActionLegacy: overview.nextActionText,
    blocked: blocked.slice(0, 3).map((c) => ({ id: c.id, title: c.title, reason: c.blockedReason || "en lista Bloqueado" })),
    waiting: waiting.slice(0, 3).map((c) => ({ id: c.id, title: c.title, who: c.waitingFor || "—" })),
    upcoming: upcoming.map((c) => ({ id: c.id, title: c.title, date: c.dueDate! })),
    promptsCount,
    resourcesCount,
    links: project.links ?? [],
    resumeNote: project.resumeNote ?? "",
    openTasks: open.map((c) => ({ id: c.id, title: c.title })),
  };

  await touchRecent("proyecto", id, project.title, `/proyectos/${id}`);

  return (
    <div>
      <Link href="/proyectos" className="text-sm text-stone hover:text-charcoal inline-flex items-center gap-1 mb-3">
        <ArrowLeft size={14} aria-hidden /> Proyectos
      </Link>

      {/* 1. Encabezado y objetivo */}
      <header className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3 min-w-0">
          <ProjectIcon name={project.icon ?? "folder"} className="h-12 w-12" />
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl text-forest-deep">{project.title}</h1>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              <span className={`chip capitalize ${project.status === "activo" ? "chip-sage" : ""}`}>{project.status}</span>
              <span className="chip capitalize">{project.area}</span>
              {project.targetDate && <span className="chip">Meta: {project.targetDate}</span>}
              {overview.totalCount > 0 && (
                <span className="chip" data-testid="project-progress">
                  Tareas completadas: {overview.doneCount}/{overview.totalCount}
                </span>
              )}
              {project.isStarter && <span className="chip">Ejemplo — edítalo o bórralo</span>}
            </div>
            {project.objective && <p className="text-sm text-stone mt-2 max-w-2xl">{project.objective}</p>}
          </div>
        </div>
        <EditProjectButton project={project} />
      </header>

      {/* 2. Siguiente acción */}
      <NextActionBlock
        projectId={id}
        info={{ card: overview.nextActionCard, legacyText: overview.nextActionText }}
        openTasks={open.map((c) => ({ id: c.id, title: c.title }))}
      />

      {/* 3. Retomar proyecto */}
      <ResumePanel data={resume} open={retomar === "1"} />

      {/* 4. Alertas importantes */}
      {overview.issues.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4" data-testid="project-alerts">
          {overview.issues.map((a, i) => (
            <span key={a.kind} className={`chip ${i === 0 ? "chip-blocked" : "chip-waiting"}`}>
              <CircleAlert size={11} aria-hidden /> {a.label}
            </span>
          ))}
        </div>
      )}

      {/* 5. Tablero (la siguiente acción va marcada discretamente) */}
      <div id="tablero">
        <Board
          columns={cols.map((c) => ({ id: c.id, title: c.title, kind: c.kind }))}
          cards={cards}
          nextActionCardId={nextCard?.id ?? null}
        />
      </div>

      {/* 6. Decisiones, prompts y recursos vinculados */}
      <div className="mt-6 flex flex-wrap gap-4 text-sm">
        <Link href={`/biblioteca/prompts?proyecto=${id}`} className="text-forest underline underline-offset-4 hover:text-forest-deep inline-flex items-center gap-1">
          Prompts ({promptsCount}) <ArrowRight size={13} aria-hidden />
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
