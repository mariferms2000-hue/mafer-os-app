import "server-only";
import { and, asc, eq, isNull, ne } from "drizzle-orm";
import { db, today, schema } from "@/lib/db";
import { getSetting } from "@/lib/auth";

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

  const quick = open.filter(
    (c) => ["5m", "15m", "30m"].includes(c.duration ?? "") && c.columnKind !== "despues"
  );
  const blocked = open.filter((c) => c.columnKind === "bloqueado" || c.blockedReason);
  const waiting = open.filter(
    (c) => (c.columnKind === "esperando" || c.waitingFor) && !blocked.includes(c)
  );
  const deferred = open.filter((c) => c.columnKind === "despues" || c.priority === "baja");

  const activeProjects = await db
    .select()
    .from(schema.projects)
    .where(
      and(
        eq(schema.projects.archived, false),
        eq(schema.projects.status, "activo"),
        ne(schema.projects.nextAction, "")
      )
    );

  const energy = (await getSetting(`energy:${d}`)) ?? "";
  const userName = (await getSetting("user_name")) ?? "Mafer";
  const inboxCount = (
    await db.select().from(schema.inboxItems).where(eq(schema.inboxItems.processed, false))
  ).length;

  return {
    date: d,
    userName,
    energy,
    priorities,
    priorityIds: priorityRows.map((p) => p.cardId),
    eventsToday,
    dueToday,
    overdue,
    approaching,
    quick,
    blocked,
    waiting,
    deferred,
    nextSteps: activeProjects.map((p) => ({
      projectId: p.id,
      projectTitle: p.title,
      icon: p.icon,
      nextAction: p.nextAction ?? "",
    })),
    candidates: open.filter((c) => c.columnKind !== "despues").slice(0, 60),
    inboxCount,
  };
}
