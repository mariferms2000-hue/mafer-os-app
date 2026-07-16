"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq } from "drizzle-orm";
import { db, now, today, uid, schema } from "@/lib/db";
import { requireAuth, setSetting } from "@/lib/auth";
import { createCardInColumnKind, getOrCreateBoard } from "@/lib/db/helpers";
import { normalizeDuration, normalizeEnergy } from "@/lib/estimates";
import { syncCardToGoogle } from "@/lib/google/calendar";

function revalidateCardViews(projectId?: string | null) {
  revalidatePath("/");
  revalidatePath("/tareas");
  revalidatePath("/calendario");
  if (projectId) revalidatePath(`/proyectos/${projectId}`);
}

export async function createCardAction(formData: FormData): Promise<{ id: string } | undefined> {
  await requireAuth();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return undefined;
  const projectId = (formData.get("projectId") as string) || null;
  const cardId = await createCardInColumnKind({
    title,
    description: String(formData.get("description") ?? ""),
    projectId,
    columnKind: (formData.get("columnKind") as string) || "proximo",
    dueDate: (formData.get("dueDate") as string) || null,
    type: (formData.get("type") as string) || "tarea",
    duration: normalizeDuration(formData.get("duration") as string),
    energy: normalizeEnergy(formData.get("energy") as string),
    priority: (formData.get("priority") as string) || "media",
  });
  // Campos avanzados opcionales del formulario «Nueva tarea».
  const extras: Record<string, unknown> = {};
  const blockedReason = String(formData.get("blockedReason") ?? "").trim();
  const waitingFor = String(formData.get("waitingFor") ?? "").trim();
  const startTime = String(formData.get("startTime") ?? "").trim();
  const reminder = String(formData.get("reminder") ?? "").trim();
  const tags = String(formData.get("tags") ?? "").split(",").map((t) => t.trim()).filter(Boolean);
  if (blockedReason) extras.blockedReason = blockedReason;
  if (waitingFor) extras.waitingFor = waitingFor;
  if (startTime) extras.startTime = startTime;
  if (reminder) extras.reminder = reminder;
  if (tags.length) extras.tags = tags;
  if (Object.keys(extras).length) {
    await db.update(schema.cards).set(extras).where(eq(schema.cards.id, cardId));
  }
  revalidateCardViews(projectId);
  return { id: cardId };
}

/** Guarda duración estimada y energía requerida (paso de clasificación).
 *  Solo se llama cuando Mafer confirma o cambia — las sugerencias nunca se
 *  guardan solas. null = «sin estimar». */
export async function setTaskEstimatesAction(id: string, duration: string | null, energy: string | null) {
  await requireAuth();
  const card = await db.select().from(schema.cards).where(eq(schema.cards.id, id)).get();
  if (!card) return;
  await db
    .update(schema.cards)
    .set({ duration: normalizeDuration(duration), energy: normalizeEnergy(energy), updatedAt: now() })
    .where(eq(schema.cards.id, id));
  revalidateCardViews(card.projectId);
}

/* ── Detalle editable de tarea ───────────────────────── */

export type TaskDetailData = {
  card: typeof schema.cards.$inferSelect & { projectTitle: string | null; columnKind: string | null };
  projects: { id: string; title: string }[];
  columns: { id: string; title: string; kind: string }[];
};

/** Datos frescos para abrir el detalle: la tarjeta, los proyectos activos y
 *  las listas del tablero de su proyecto actual. */
export async function getTaskDetailAction(cardId: string): Promise<TaskDetailData | null> {
  await requireAuth();
  const row = await db
    .select({ card: schema.cards, projectTitle: schema.projects.title, columnKind: schema.columns.kind })
    .from(schema.cards)
    .leftJoin(schema.projects, eq(schema.cards.projectId, schema.projects.id))
    .leftJoin(schema.columns, eq(schema.cards.columnId, schema.columns.id))
    .where(eq(schema.cards.id, cardId))
    .get();
  if (!row) return null;
  const projects = await db
    .select({ id: schema.projects.id, title: schema.projects.title })
    .from(schema.projects)
    .where(eq(schema.projects.archived, false))
    .orderBy(asc(schema.projects.title));
  const columns = row.card.projectId ? await getProjectColumnsAction(row.card.projectId) : [];
  return {
    card: { ...row.card, projectTitle: row.projectTitle, columnKind: row.columnKind },
    projects,
    columns,
  };
}

/** Listas del tablero de un proyecto (lo crea si el proyecto aún no tiene). */
export async function getProjectColumnsAction(projectId: string) {
  await requireAuth();
  if (!projectId) return [];
  const boardId = await getOrCreateBoard(projectId);
  return db
    .select({ id: schema.columns.id, title: schema.columns.title, kind: schema.columns.kind })
    .from(schema.columns)
    .where(eq(schema.columns.boardId, boardId))
    .orderBy(asc(schema.columns.position));
}

/** Guardado completo del detalle: campos + proyecto + lista, en una sola operación.
 *  Reglas de reasignación:
 *  - a otro proyecto → tablero del nuevo proyecto, lista elegida o Backlog, al final;
 *  - a «Sin proyecto» → se limpian tablero y lista, el resto de datos se conserva;
 *  - cambio de lista dentro del mismo proyecto → al final de la lista destino;
 *  - solo se toca completedAt si la tarjeta cambió a/desde una lista Terminado. */
export async function saveTaskAction(formData: FormData) {
  await requireAuth();
  const id = String(formData.get("id"));
  const card = await db.select().from(schema.cards).where(eq(schema.cards.id, id)).get();
  if (!card) return;

  const str = (k: string) => (formData.has(k) ? String(formData.get(k) ?? "") : undefined);
  const nul = (k: string) => (formData.has(k) ? String(formData.get(k) ?? "") || null : undefined);

  // Enlaces (JSON serializado por el formulario)
  let links: { label: string; url: string }[] | undefined;
  if (formData.has("links")) {
    try {
      const parsed: unknown = JSON.parse(String(formData.get("links")));
      if (Array.isArray(parsed)) {
        links = parsed
          .filter((l): l is { label?: unknown; url?: unknown } => Boolean(l) && typeof l === "object")
          .map((l) => ({ label: String(l.label ?? "").trim(), url: String(l.url ?? "").trim() }))
          .filter((l) => l.url)
          .map((l) => ({ label: l.label || l.url, url: l.url }));
      }
    } catch {
      links = undefined; // enlaces malformados: no tocar los existentes
    }
  }

  // Proyecto y lista
  const requestedProject = formData.has("projectId") ? String(formData.get("projectId")) || null : undefined;
  const requestedColumn = formData.has("columnId") ? String(formData.get("columnId")) || null : undefined;

  let projectId = card.projectId;
  let boardId = card.boardId;
  let columnId = card.columnId;
  let position = card.position;

  const endOf = async (colId: string) => {
    const siblings = await db.select().from(schema.cards).where(eq(schema.cards.columnId, colId));
    return siblings.filter((c) => c.id !== card.id).length;
  };

  if (requestedProject !== undefined && requestedProject !== card.projectId) {
    if (!requestedProject) {
      // Sin proyecto: fuera del tablero, se conserva todo lo demás.
      projectId = null;
      boardId = null;
      columnId = null;
      position = 0;
    } else {
      projectId = requestedProject;
      boardId = await getOrCreateBoard(requestedProject);
      const cols = await db
        .select()
        .from(schema.columns)
        .where(eq(schema.columns.boardId, boardId))
        .orderBy(asc(schema.columns.position));
      const target =
        cols.find((c) => c.id === requestedColumn) ?? cols.find((c) => c.kind === "backlog") ?? cols[0] ?? null;
      columnId = target?.id ?? null;
      position = columnId ? await endOf(columnId) : 0;
    }
  } else if (requestedColumn !== undefined && requestedColumn !== card.columnId && card.boardId) {
    const col = requestedColumn
      ? await db
          .select()
          .from(schema.columns)
          .where(and(eq(schema.columns.id, requestedColumn), eq(schema.columns.boardId, card.boardId)))
          .get()
      : null;
    if (col) {
      columnId = col.id;
      position = await endOf(col.id);
    }
  }

  // completedAt solo cambia si la tarjeta se movió de lista (a Terminado o fuera de él).
  let completedAt = card.completedAt;
  if (columnId && columnId !== card.columnId) {
    const newCol = await db.select().from(schema.columns).where(eq(schema.columns.id, columnId)).get();
    completedAt = newCol?.kind === "terminado" ? (card.completedAt ?? now()) : null;
  }

  await db
    .update(schema.cards)
    .set({
      title: str("title")?.trim() || card.title,
      description: str("description"),
      type: str("type"),
      priority: str("priority"),
      duration: formData.has("duration") ? normalizeDuration(String(formData.get("duration"))) : undefined,
      energy: formData.has("energy") ? normalizeEnergy(String(formData.get("energy"))) : undefined,
      dueDate: nul("dueDate"),
      startTime: nul("startTime"),
      reminder: nul("reminder"),
      nextAction: str("nextAction"),
      blockedReason: str("blockedReason"),
      waitingFor: str("waitingFor"),
      tags: formData.has("tags")
        ? String(formData.get("tags"))
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : undefined,
      links,
      projectId,
      boardId,
      columnId,
      position,
      completedAt,
      updatedAt: now(),
    })
    .where(eq(schema.cards.id, id));

  await syncCardToGoogle(id).catch(() => {});
  revalidateCardViews(card.projectId);
  if (projectId !== card.projectId) {
    if (projectId) revalidatePath(`/proyectos/${projectId}`);
    revalidatePath("/proyectos");
  }
}

export async function setChecklistAction(id: string, checklist: { id: string; text: string; done: boolean }[]) {
  await requireAuth();
  const card = await db.select().from(schema.cards).where(eq(schema.cards.id, id)).get();
  if (!card) return;
  await db.update(schema.cards).set({ checklist, updatedAt: now() }).where(eq(schema.cards.id, id));
  revalidateCardViews(card.projectId);
}

/** Mueve una tarjeta a otra lista/posición y persiste el orden de la lista destino y origen. */
export async function moveCardAction(input: {
  cardId: string;
  toColumnId: string;
  orderedIds: string[]; // ids en la columna destino, en orden final
  fromOrderedIds?: string[]; // ids restantes en la columna origen (si cambió de columna)
}) {
  await requireAuth();
  const card = await db.select().from(schema.cards).where(eq(schema.cards.id, input.cardId)).get();
  if (!card) return;

  const col = await db.select().from(schema.columns).where(eq(schema.columns.id, input.toColumnId)).get();
  if (!col) return;

  const done = col.kind === "terminado";
  await db
    .update(schema.cards)
    .set({
      columnId: input.toColumnId,
      completedAt: done ? (card.completedAt ?? now()) : null,
      updatedAt: now(),
    })
    .where(eq(schema.cards.id, input.cardId));

  for (let i = 0; i < input.orderedIds.length; i++) {
    await db.update(schema.cards).set({ position: i }).where(eq(schema.cards.id, input.orderedIds[i]));
  }
  if (input.fromOrderedIds) {
    for (let i = 0; i < input.fromOrderedIds.length; i++) {
      await db.update(schema.cards).set({ position: i }).where(eq(schema.cards.id, input.fromOrderedIds[i]));
    }
  }
  revalidateCardViews(card.projectId);
}

/** Completa o reabre una tarea.
 *  Al completar, si era prioridad de HOY libera su espacio (nunca se elige otra
 *  automáticamente) y devuelve la posición liberada para poder deshacer.
 *  Al reabrir, `restorePriorityAt` re-coloca la prioridad en ese espacio. */
export async function completeCardAction(
  id: string,
  complete: boolean,
  restorePriorityAt?: number | null
): Promise<{ freedPriorityAt: number | null }> {
  await requireAuth();
  const card = await db.select().from(schema.cards).where(eq(schema.cards.id, id)).get();
  if (!card) return { freedPriorityAt: null };

  let freedPriorityAt: number | null = null;
  const d = today();
  if (complete) {
    const row = await db
      .select()
      .from(schema.todayPriorities)
      .where(and(eq(schema.todayPriorities.date, d), eq(schema.todayPriorities.cardId, id)))
      .get();
    if (row) {
      freedPriorityAt = row.position;
      await db.delete(schema.todayPriorities).where(eq(schema.todayPriorities.id, row.id));
    }
  } else if (restorePriorityAt !== undefined && restorePriorityAt !== null) {
    const existing = await db
      .select()
      .from(schema.todayPriorities)
      .where(eq(schema.todayPriorities.date, d));
    if (existing.length < 3 && !existing.some((p) => p.cardId === id)) {
      await db.insert(schema.todayPriorities).values({ id: uid(), date: d, cardId: id, position: restorePriorityAt });
    }
  }

  let columnId = card.columnId;
  let position = card.position;
  if (card.boardId) {
    const targetKind = complete ? "terminado" : "proximo";
    const col = await db
      .select()
      .from(schema.columns)
      .where(and(eq(schema.columns.boardId, card.boardId), eq(schema.columns.kind, targetKind)))
      .get();
    if (col && col.id !== card.columnId) {
      columnId = col.id;
      // al final de la lista destino, sin chocar con posiciones existentes
      const siblings = await db.select().from(schema.cards).where(eq(schema.cards.columnId, col.id));
      position = siblings.length;
    }
  }
  await db
    .update(schema.cards)
    .set({ completedAt: complete ? now() : null, columnId, position, updatedAt: now() })
    .where(eq(schema.cards.id, id));
  revalidateCardViews(card.projectId);
  return { freedPriorityAt };
}

/** Reprograma la fecha límite (o la quita con null). */
export async function rescheduleCardAction(id: string, dueDate: string | null) {
  await requireAuth();
  const card = await db.select().from(schema.cards).where(eq(schema.cards.id, id)).get();
  if (!card) return;
  await db.update(schema.cards).set({ dueDate, updatedAt: now() }).where(eq(schema.cards.id, id));
  revalidateCardViews(card.projectId);
}

/** Mueve la tarjeta a la lista de su tablero con ese kind (p. ej. «despues»). */
export async function moveCardToKindAction(id: string, kind: string) {
  await requireAuth();
  const card = await db.select().from(schema.cards).where(eq(schema.cards.id, id)).get();
  if (!card?.boardId) return;
  const col = await db
    .select()
    .from(schema.columns)
    .where(and(eq(schema.columns.boardId, card.boardId), eq(schema.columns.kind, kind)))
    .get();
  if (!col || col.id === card.columnId) return;
  const siblings = await db.select({ id: schema.cards.id }).from(schema.cards).where(eq(schema.cards.columnId, col.id));
  await db
    .update(schema.cards)
    .set({ columnId: col.id, position: siblings.length, updatedAt: now() })
    .where(eq(schema.cards.id, id));
  revalidateCardViews(card.projectId);
}

export async function archiveCardAction(id: string, archived: boolean) {
  await requireAuth();
  const card = await db.select().from(schema.cards).where(eq(schema.cards.id, id)).get();
  if (!card) return;
  await db.update(schema.cards).set({ archived, updatedAt: now() }).where(eq(schema.cards.id, id));
  revalidateCardViews(card.projectId);
}

export async function deleteCardAction(id: string) {
  await requireAuth();
  const card = await db.select().from(schema.cards).where(eq(schema.cards.id, id)).get();
  if (!card) return;
  await db.delete(schema.cards).where(eq(schema.cards.id, id));
  revalidateCardViews(card.projectId);
}

/* ── Prioridades del día ─────────────────────────────── */

export type PriorityAddResult =
  | { status: "added" }
  | { status: "duplicate" }
  | { status: "full"; current: { cardId: string; title: string; position: number }[] };

/** Marca una tarea como prioridad de HOY. Nunca reemplaza en silencio:
 *  si ya lo es responde «duplicate»; si los 3 espacios están llenos responde
 *  «full» con las prioridades actuales para que Mafer elija cuál reemplazar. */
export async function addTodayPriority(cardId: string): Promise<PriorityAddResult> {
  await requireAuth();
  const d = today();
  const existing = await db
    .select()
    .from(schema.todayPriorities)
    .where(eq(schema.todayPriorities.date, d))
    .orderBy(asc(schema.todayPriorities.position));
  if (existing.some((p) => p.cardId === cardId)) return { status: "duplicate" };
  if (existing.length >= 3) {
    const cards = await db.select({ id: schema.cards.id, title: schema.cards.title }).from(schema.cards);
    const titleOf = new Map(cards.map((c) => [c.id, c.title]));
    return {
      status: "full",
      current: existing.map((p) => ({ cardId: p.cardId, title: titleOf.get(p.cardId) ?? "(tarea)", position: p.position })),
    };
  }
  await db.insert(schema.todayPriorities).values({
    id: uid(),
    date: d,
    cardId,
    position: existing.length,
  });
  revalidatePath("/");
  return { status: "added" };
}

/** Reemplaza una prioridad de hoy por otra tarea, conservando su posición.
 *  Solo se llama después de que Mafer eligió explícitamente cuál sustituir. */
export async function replaceTodayPriority(oldCardId: string, newCardId: string) {
  await requireAuth();
  const d = today();
  const existing = await db
    .select()
    .from(schema.todayPriorities)
    .where(eq(schema.todayPriorities.date, d));
  if (existing.some((p) => p.cardId === newCardId)) return; // ya es prioridad: nada que hacer
  const old = existing.find((p) => p.cardId === oldCardId);
  if (!old) return;
  await db
    .update(schema.todayPriorities)
    .set({ cardId: newCardId })
    .where(eq(schema.todayPriorities.id, old.id));
  revalidatePath("/");
}

export async function removeTodayPriority(cardId: string) {
  await requireAuth();
  const d = today();
  await db
    .delete(schema.todayPriorities)
    .where(and(eq(schema.todayPriorities.date, d), eq(schema.todayPriorities.cardId, cardId)));
  revalidatePath("/");
}

export async function setEnergyTodayAction(energy: string) {
  await requireAuth();
  await setSetting(`energy:${today()}`, energy);
  revalidatePath("/");
}

/** Alta rápida directamente en una lista concreta del tablero. */
export async function createCardInColumnAction(formData: FormData) {
  await requireAuth();
  const title = String(formData.get("title") ?? "").trim();
  const columnId = String(formData.get("columnId") ?? "");
  if (!title || !columnId) return;
  const col = await db.select().from(schema.columns).where(eq(schema.columns.id, columnId)).get();
  if (!col) return;
  const board = await db.select().from(schema.boards).where(eq(schema.boards.id, col.boardId)).get();
  if (!board) return;
  const siblings = await db.select().from(schema.cards).where(eq(schema.cards.columnId, columnId));
  const t = now();
  await db.insert(schema.cards).values({
    id: uid(),
    title,
    projectId: board.projectId,
    boardId: board.id,
    columnId,
    position: siblings.length,
    createdAt: t,
    updatedAt: t,
  });
  revalidateCardViews(board.projectId);
}
