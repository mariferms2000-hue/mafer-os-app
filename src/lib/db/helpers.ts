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
  const [board] = await db
    .select()
    .from(schema.boards)
    .where(eq(schema.boards.projectId, projectId))
    .limit(1);
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
    const [col] = await db
      .select()
      .from(schema.columns)
      .where(
        and(
          eq(schema.columns.boardId, boardId),
          eq(schema.columns.kind, input.columnKind ?? "proximo")
        )
      )
      .limit(1);
    columnId = col?.id ?? null;
    if (columnId) {
      const [m] = await db
        .select({ m: max(schema.cards.position) })
        .from(schema.cards)
        .where(eq(schema.cards.columnId, columnId))
        .limit(1);
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

/** Crea un elemento de Inbox. Compartido por la captura «+» y los atajos de Siri. */
export async function insertInboxItem(input: {
  content: string;
  note?: string;
  typeHint?: string | null;
  projectId?: string | null;
  date?: string | null;
}): Promise<string> {
  const id = uid();
  await db.insert(schema.inboxItems).values({
    id,
    content: input.content,
    note: input.note ?? "",
    typeHint: input.typeHint ?? null,
    projectId: input.projectId ?? null,
    date: input.date ?? null,
    createdAt: now(),
  });
  return id;
}

/** Crea un evento de calendario. Compartido por el formulario y los atajos de
 *  Siri; quien lo llama decide si sincroniza con Google. */
export async function insertEvent(input: {
  title: string;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  type?: string;
  projectId?: string | null;
  notes?: string;
}): Promise<string> {
  const id = uid();
  await db.insert(schema.events).values({
    id,
    title: input.title,
    date: input.date,
    startTime: input.startTime ?? null,
    endTime: input.endTime ?? null,
    type: input.type ?? "evento",
    projectId: input.projectId ?? null,
    notes: input.notes ?? "",
    createdAt: now(),
  });
  return id;
}
