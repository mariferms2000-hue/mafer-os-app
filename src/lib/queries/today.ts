import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db, today, schema } from "@/lib/db";
import { getSetting } from "@/lib/auth";
import { QUICK_DURATIONS } from "@/lib/estimates";
import { recommendNow, buildForgetAlerts, type ForgetAlert } from "@/lib/recommend";

export type CardRow = typeof schema.cards.$inferSelect & {
  projectTitle?: string | null;
  columnKind?: string | null;
};

async function openCards(): Promise<CardRow[]> {
  const rows = await db
    .select({
      card: schema.cards,
      projectTitle: schema.projects.title,
      columnKind: schema.columns.kind,
    })
    .from(schema.cards)
    .leftJoin(schema.projects, eq(schema.cards.projectId, schema.projects.id))
    .leftJoin(schema.columns, eq(schema.cards.columnId, schema.columns.id))
    .where(and(eq(schema.cards.archived, false), isNull(schema.cards.completedAt)))
    .orderBy(asc(schema.cards.position));
  return rows.map((r) => ({ ...r.card, projectTitle: r.projectTitle, columnKind: r.columnKind }));
}

export async function getTodayData() {
  const d = today();
  const open = await openCards();

  const priorityRows = await db
    .select()
    .from(schema.todayPriorities)
    .where(eq(schema.todayPriorities.date, d))
    .orderBy(asc(schema.todayPriorities.position));

  const allCardsById = new Map<string, CardRow>();
  // Para prioridades incluimos también las completadas hoy (para poder palomearlas).
  const withDone = await db
    .select({ card: schema.cards, projectTitle: schema.projects.title })
    .from(schema.cards)
    .leftJoin(schema.projects, eq(schema.cards.projectId, schema.projects.id));
  for (const r of withDone) allCardsById.set(r.card.id, { ...r.card, projectTitle: r.projectTitle });

  const priorities = priorityRows
    .map((p) => allCardsById.get(p.cardId))
    .filter((c): c is CardRow => Boolean(c));

  const eventsToday = await db
    .select()
    .from(schema.events)
    .where(eq(schema.events.date, d))
    .orderBy(asc(schema.events.startTime));

  const dueToday = open.filter((c) => c.dueDate === d);
  const overdue = open.filter((c) => c.dueDate && c.dueDate < d);
  const in7 = new Date();
  in7.setDate(in7.getDate() + 7);
  const d7 = in7.toISOString().slice(0, 10);
  const approaching = open.filter((c) => c.dueDate && c.dueDate > d && c.dueDate <= d7);

  // «Menos de 30 minutos»: exclusivamente under_10 y ten_to_30
  const quick = open.filter(
    (c) => QUICK_DURATIONS.includes(c.duration ?? "") && c.columnKind !== "despues"
  );
  const deepWork = open.filter(
    (c) =>
      (c.duration === "over_60" || c.energy === "high" || c.priority === "alta") &&
      c.columnKind !== "despues" &&
      c.columnKind !== "bloqueado" &&
      !c.waitingFor
  );
  const blocked = open.filter((c) => c.columnKind === "bloqueado" || c.blockedReason);
  const waiting = open.filter(
    (c) => (c.columnKind === "esperando" || c.waitingFor) && !blocked.includes(c)
  );
  const deferred = open.filter((c) => c.columnKind === "despues" || c.priority === "baja");

  const activeProjects = await db
    .select()
    .from(schema.projects)
    .where(and(eq(schema.projects.archived, false), eq(schema.projects.status, "activo")));
  const projectsWithNext = activeProjects.filter((p) => (p.nextAction ?? "").trim() !== "");

  const energy = (await getSetting(`energy:${d}`)) ?? "";
  const userName = (await getSetting("user_name")) ?? "Mafer";
  const inboxPending = await db
    .select({ id: schema.inboxItems.id, createdAt: schema.inboxItems.createdAt })
    .from(schema.inboxItems)
    .where(eq(schema.inboxItems.processed, false));
  const inboxCount = inboxPending.length;

  // «Haz esto ahora»: hasta 3 candidatas explicadas (la primera es LA recomendación)
  const priorityIds = priorityRows.map((p) => p.cardId);
  const recommendations = recommendNow({
    tasks: open,
    dayEnergy: energy,
    priorityIds,
    today: d,
    limit: 3,
  });
  const openById = new Map(open.map((c) => [c.id, c]));
  const doNow = recommendations
    .map((r) => ({ card: openById.get(r.id), reasons: r.reasons }))
    .filter((r): r is { card: CardRow; reasons: string[] } => Boolean(r.card));

  // Alertas antiolvido: última actividad de cada proyecto = su updatedAt o el de su tarjeta más reciente
  const allCards = await db
    .select({ projectId: schema.cards.projectId, updatedAt: schema.cards.updatedAt })
    .from(schema.cards);
  const lastCardActivity = new Map<string, string>();
  for (const c of allCards) {
    if (!c.projectId) continue;
    const prev = lastCardActivity.get(c.projectId);
    if (!prev || c.updatedAt > prev) lastCardActivity.set(c.projectId, c.updatedAt);
  }
  const alerts: ForgetAlert[] = buildForgetAlerts({
    today: d,
    tasks: open.map((c) => ({ ...c, updatedAt: c.updatedAt })),
    projects: activeProjects.map((p) => ({
      id: p.id,
      title: p.title,
      nextAction: p.nextAction,
      lastActivity:
        (lastCardActivity.get(p.id) ?? "") > p.updatedAt ? lastCardActivity.get(p.id)! : p.updatedAt,
    })),
    inbox: inboxPending,
    priorityIds,
  });

  return {
    date: d,
    userName,
    energy,
    doNow,
    alerts,
    priorities,
    priorityIds,
    eventsToday,
    dueToday,
    overdue,
    approaching,
    quick,
    deepWork,
    blocked,
    waiting,
    deferred,
    nextSteps: projectsWithNext.map((p) => ({
      projectId: p.id,
      projectTitle: p.title,
      icon: p.icon,
      nextAction: p.nextAction ?? "",
    })),
    candidates: open.filter((c) => c.columnKind !== "despues").slice(0, 60),
    inboxCount,
  };
}
