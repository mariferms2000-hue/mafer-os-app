import "server-only";
import { asc, eq } from "drizzle-orm";
import { db, today, schema } from "@/lib/db";
import { projectIssues, type ProjectIssue } from "@/lib/project-health";
import { diasEntre } from "@/lib/recommend";

export type ProjectOverview = {
  project: typeof schema.projects.$inferSelect;
  openCount: number;
  doneCount: number;
  totalCount: number;
  blockedCount: number;
  waitingCount: number;
  /** La siguiente acción como tarea real (si está vinculada y existe). */
  nextActionCard: { id: string; title: string; completedAt: string | null } | null;
  /** Texto heredado, solo cuando no hay tarjeta vinculada. */
  nextActionText: string;
  hasNextAction: boolean;
  nextActionCompleted: boolean;
  /** Fecha relevante más próxima: la fecha límite abierta más cercana, o la meta. */
  nextDate: string | null;
  /** Última actividad significativa (tarjetas, decisiones, cambios del proyecto). */
  lastActivity: string;
  issues: ProjectIssue[];
};

/** Resumen por proyecto para /proyectos, «Necesitan atención», Retomar y Hoy. */
export async function getProjectsOverview(): Promise<ProjectOverview[]> {
  const d = today();
  const projects = await db.select().from(schema.projects).orderBy(asc(schema.projects.title));
  const cards = await db
    .select({
      id: schema.cards.id,
      projectId: schema.cards.projectId,
      title: schema.cards.title,
      dueDate: schema.cards.dueDate,
      blockedReason: schema.cards.blockedReason,
      waitingFor: schema.cards.waitingFor,
      columnKind: schema.columns.kind,
      updatedAt: schema.cards.updatedAt,
      completedAt: schema.cards.completedAt,
      archived: schema.cards.archived,
    })
    .from(schema.cards)
    .leftJoin(schema.columns, eq(schema.cards.columnId, schema.columns.id));
  const decisions = await db
    .select({ projectId: schema.decisions.projectId, createdAt: schema.decisions.createdAt })
    .from(schema.decisions);

  const byProject = new Map<string, typeof cards>();
  for (const c of cards) {
    if (!c.projectId || c.archived) continue;
    byProject.set(c.projectId, [...(byProject.get(c.projectId) ?? []), c]);
  }
  const cardById = new Map(cards.map((c) => [c.id, c]));
  const lastDecision = new Map<string, string>();
  for (const dec of decisions) {
    if (!dec.projectId) continue;
    const prev = lastDecision.get(dec.projectId);
    if (!prev || dec.createdAt > prev) lastDecision.set(dec.projectId, dec.createdAt);
  }

  return projects.map((p) => {
    const mine = byProject.get(p.id) ?? [];
    const open = mine.filter((c) => !c.completedAt);
    const done = mine.filter((c) => c.completedAt);
    const blocked = open.filter((c) => c.blockedReason || c.columnKind === "bloqueado");
    const waiting = open.filter((c) => c.waitingFor || c.columnKind === "esperando");
    const overdue = open.filter((c) => c.dueDate && c.dueDate < d);

    // Siguiente acción: la tarjeta vinculada manda; el texto heredado es respaldo.
    const linkedRaw = p.nextActionCardId ? cardById.get(p.nextActionCardId) : undefined;
    const linked = linkedRaw && !linkedRaw.archived ? linkedRaw : undefined;
    const nextActionCard = linked
      ? { id: linked.id, title: linked.title, completedAt: linked.completedAt }
      : null;
    const nextActionCompleted = Boolean(linked?.completedAt);
    const nextActionText = nextActionCard ? "" : (p.nextAction ?? "").trim();
    const hasNextAction = (Boolean(nextActionCard) && !nextActionCompleted) || nextActionText !== "";

    const dueDates = open.map((c) => c.dueDate).filter((x): x is string => Boolean(x)).sort();
    const nextDate = dueDates[0] ?? p.targetDate ?? null;

    let lastActivity = p.updatedAt;
    for (const c of mine) if (c.updatedAt > lastActivity) lastActivity = c.updatedAt;
    const dec = lastDecision.get(p.id);
    if (dec && dec > lastActivity) lastActivity = dec;

    const oldestWaiting = waiting.map((c) => c.updatedAt).sort()[0] ?? null;

    const issues =
      p.archived || p.status === "terminado"
        ? []
        : p.status !== "activo"
          ? [] // pausados/esperando: sin alertas salvo problema explícito (salud marcada se muestra aparte)
          : projectIssues({
              hasNextAction,
              nextActionCompleted,
              overdue: overdue.length,
              blocked: blocked.length,
              oldestWaitingDays: oldestWaiting ? diasEntre(oldestWaiting, d) : null,
              inactiveDays: diasEntre(lastActivity, d),
            });

    return {
      project: p,
      openCount: open.length,
      doneCount: done.length,
      totalCount: mine.length,
      blockedCount: blocked.length,
      waitingCount: waiting.length,
      nextActionCard,
      nextActionText,
      hasNextAction,
      nextActionCompleted,
      nextDate,
      lastActivity,
      issues,
    };
  });
}
