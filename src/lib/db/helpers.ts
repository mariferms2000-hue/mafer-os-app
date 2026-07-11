import "server-only";
import { and, eq, max } from "drizzle-orm";
import { db, now, uid, schema } from "./index";

export const DEFAULT_COLUMNS: { title: string; kind: string }[] = [
  { title: "Backlog", kind: "backlog" },
  { title: "Próximo", kind: "proximo" },
  { title: "En proceso", kind: "proceso" },
  { title: "Esperando", kind: "esperando" },
  { title: "Bloqueado", kind: "bloqueado" },
  { title: "Después", kind: "despues" },
  { title: "Terminado", kind: "terminado" },
];

/** Crea el tablero por defecto con las 7 listas estándar. */
export async function createDefaultBoard(projectId: string): Promise<string> {
  const boardId = uid();
  await db.insert(schema.boards).values({ id: boardId, projectId, title: "Tablero" });
  await db.insert(schema.columns).values(
    DEFAULT_COLUMNS.map((c, i) => ({
      id: uid(),
      boardId,
      title: c.title,
      kind: c.kind,
      position: i,
    }))
  );
  return boardId;
}

export async function getOrCreateBoard(projectId: string): Promise<string> {
  const board = await db
    .select()
    .from(schema.boards)
    .where(eq(schema.boards.projectId, projectId))
    .get();
  return board?.id ?? createDefaultBoard(projectId);
}

/** Crea una tarjeta en la lista de un proyecto identificada por `kind`.
 *  Si no hay proyecto, la tarjeta queda suelta (aparece en "Todas mis tareas"). */
export async function createCardInColumnKind(input: {
  title: string;
  description?: string;
  projectId?: string | null;
  columnKind?: string;
  dueDate?: string | null;
  type?: string;
  duration?: string | null;
  energy?: string | null;
  priority?: string;
}): Promise<string> {
  const t = now();
  const cardId = uid();
  let boardId: string | null = null;
  let columnId: string | null = null;
  let position = 0;

  if (input.projectId) {
    boardId = await getOrCreateBoard(input.projectId);
    const col = await db
      .select()
      .from(schema.columns)
      .where(
        and(
          eq(schema.columns.boardId, boardId),
          eq(schema.columns.kind, input.columnKind ?? "proximo")
        )
      )
      .get();
    columnId = col?.id ?? null;
    if (columnId) {
      const m = await db
        .select({ m: max(schema.cards.position) })
        .from(schema.cards)
        .where(eq(schema.cards.columnId, columnId))
        .get();
      position = (m?.m ?? -1) + 1;
    }
  }

  await db.insert(schema.cards).values({
    id: cardId,
    title: input.title,
    description: input.description ?? "",
    projectId: input.projectId ?? null,
    boardId,
    columnId,
    position,
    type: input.type ?? "tarea",
    priority: input.priority ?? "media",
    duration: input.duration ?? null,
    energy: input.energy ?? null,
    dueDate: input.dueDate ?? null,
    createdAt: t,
    updatedAt: t,
  });
  return cardId;
}

/** Registra una vista reciente (para "Retomar"). */
export async function touchRecent(entityType: string, entityId: string, title: string, href: string) {
  const id = `${entityType}:${entityId}`;
  await db
    .insert(schema.recentViews)
    .values({ id, entityType, entityId, title, href, viewedAt: now() })
    .onConflictDoUpdate({
      target: schema.recentViews.id,
      set: { title, viewedAt: now() },
    });
}
