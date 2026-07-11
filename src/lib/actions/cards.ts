"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, now, today, uid, schema } from "@/lib/db";
import { requireAuth, setSetting } from "@/lib/auth";
import { createCardInColumnKind } from "@/lib/db/helpers";

function revalidateCardViews(projectId?: string | null) {
  revalidatePath("/");
  revalidatePath("/tareas");
  revalidatePath("/calendario");
  if (projectId) revalidatePath(`/proyectos/${projectId}`);
}

export async function createCardAction(formData: FormData) {
  await requireAuth();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const projectId = (formData.get("projectId") as string) || null;
  await createCardInColumnKind({
    title,
    description: String(formData.get("description") ?? ""),
    projectId,
    columnKind: (formData.get("columnKind") as string) || "proximo",
    dueDate: (formData.get("dueDate") as string) || null,
    type: (formData.get("type") as string) || "tarea",
    duration: (formData.get("duration") as string) || null,
    energy: (formData.get("energy") as string) || null,
    priority: (formData.get("priority") as string) || "media",
  });
  revalidateCardViews(projectId);
}

export async function updateCardAction(formData: FormData) {
  await requireAuth();
  const id = String(formData.get("id"));
  const card = await db.select().from(schema.cards).where(eq(schema.cards.id, id)).get();
  if (!card) return;

  const str = (k: string) => (formData.has(k) ? String(formData.get(k) ?? "") : undefined);
  const nul = (k: string) => (formData.has(k) ? String(formData.get(k) ?? "") || null : undefined);

  await db
    .update(schema.cards)
    .set({
      title: str("title")?.trim() || card.title,
      description: str("description"),
      type: str("type"),
      priority: str("priority"),
      duration: nul("duration"),
      energy: nul("energy"),
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
      updatedAt: now(),
    })
    .where(eq(schema.cards.id, id));
  revalidateCardViews(card.projectId);
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
  revalidateCardViews(card.projectId);
}

export async function completeCardAction(id: string, complete: boolean) {
  await requireAuth();
  const card = await db.select().from(schema.cards).where(eq(schema.cards.id, id)).get();
  if (!card) return;

  let columnId = card.columnId;
  if (card.boardId) {
    const targetKind = complete ? "terminado" : "proximo";
    const col = await db
      .select()
      .from(schema.columns)
      .where(and(eq(schema.columns.boardId, card.boardId), eq(schema.columns.kind, targetKind)))
      .get();
    if (col) columnId = col.id;
  }
  await db
    .update(schema.cards)
    .set({ completedAt: complete ? now() : null, columnId, updatedAt: now() })
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

export async function addTodayPriority(cardId: string) {
  await requireAuth();
  const d = today();
  const existing = await db
    .select()
    .from(schema.todayPriorities)
    .where(eq(schema.todayPriorities.date, d));
  if (existing.some((p) => p.cardId === cardId)) return;
  if (existing.length >= 3) return; // máximo tres
  await db.insert(schema.todayPriorities).values({
    id: uid(),
    date: d,
    cardId,
    position: existing.length,
  });
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
