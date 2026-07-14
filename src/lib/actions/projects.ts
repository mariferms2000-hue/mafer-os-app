"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, now, uid, schema } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { createDefaultBoard, createCardInColumnKind } from "@/lib/db/helpers";

function revalidateProject(id: string) {
  revalidatePath("/proyectos");
  revalidatePath(`/proyectos/${id}`);
  revalidatePath("/");
  revalidatePath("/tareas");
}

export async function createProjectAction(formData: FormData) {
  await requireAuth();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const t = now();
  const id = uid();
  await db.insert(schema.projects).values({
    id,
    title,
    description: String(formData.get("description") ?? ""),
    objective: String(formData.get("objective") ?? ""),
    area: String(formData.get("area") ?? "personal"),
    status: String(formData.get("status") ?? "activo") || "activo",
    priority: String(formData.get("priority") ?? "media"),
    icon: String(formData.get("icon") ?? "folder"),
    color: String(formData.get("color") ?? "sage"),
    targetDate: (formData.get("targetDate") as string) || null,
    resumeNote: String(formData.get("resumeNote") ?? ""),
    createdAt: t,
    updatedAt: t,
  });
  await createDefaultBoard(id);
  // Siguiente acción opcional al crear: nace como TAREA REAL vinculada.
  const nextTitle = String(formData.get("nextActionTitle") ?? "").trim();
  if (nextTitle) {
    const cardId = await createCardInColumnKind({ title: nextTitle, projectId: id, columnKind: "proximo" });
    await db.update(schema.projects).set({ nextActionCardId: cardId }).where(eq(schema.projects.id, id));
  }
  revalidatePath("/proyectos");
  redirect(`/proyectos/${id}`);
}

/* ── Siguiente acción como tarea real ─────────────────────────────── */

/** Vincula (o desvincula con null) una tarea existente como siguiente acción.
 *  Nunca se elige una automáticamente: siempre llega de una elección de Mafer. */
export async function setProjectNextActionAction(projectId: string, cardId: string | null) {
  await requireAuth();
  const p = await db.select().from(schema.projects).where(eq(schema.projects.id, projectId)).get();
  if (!p) return;
  if (cardId) {
    const card = await db.select().from(schema.cards).where(eq(schema.cards.id, cardId)).get();
    if (!card || card.projectId !== projectId) return; // solo tareas del propio proyecto
  }
  await db
    .update(schema.projects)
    .set({ nextActionCardId: cardId, nextAction: "", updatedAt: now() })
    .where(eq(schema.projects.id, projectId));
  revalidateProject(projectId);
}

/** Crea una tarea nueva (en Próximo) y la vincula como siguiente acción. */
export async function createNextActionTaskAction(
  projectId: string,
  title: string
): Promise<{ cardId: string } | undefined> {
  await requireAuth();
  const clean = title.trim();
  if (!clean) return undefined;
  const p = await db.select().from(schema.projects).where(eq(schema.projects.id, projectId)).get();
  if (!p) return undefined;
  const cardId = await createCardInColumnKind({ title: clean, projectId, columnKind: "proximo" });
  await db
    .update(schema.projects)
    .set({ nextActionCardId: cardId, nextAction: "", updatedAt: now() })
    .where(eq(schema.projects.id, projectId));
  revalidateProject(projectId);
  return { cardId };
}

/** Guarda la nota manual «Contexto para retomar» (cuenta como actividad). */
export async function saveResumeNoteAction(projectId: string, note: string) {
  await requireAuth();
  await db
    .update(schema.projects)
    .set({ resumeNote: note.trim(), updatedAt: now() })
    .where(eq(schema.projects.id, projectId));
  revalidateProject(projectId);
}

export async function updateProjectAction(formData: FormData) {
  await requireAuth();
  const id = String(formData.get("id"));
  const p = await db.select().from(schema.projects).where(eq(schema.projects.id, id)).get();
  if (!p) return;
  const str = (k: string) => (formData.has(k) ? String(formData.get(k) ?? "") : undefined);
  await db
    .update(schema.projects)
    .set({
      title: str("title")?.trim() || p.title,
      description: str("description"),
      objective: str("objective"),
      area: str("area"),
      status: str("status"),
      priority: str("priority"),
      health: str("health"),
      nextAction: str("nextAction"),
      resumeNote: str("resumeNote"),
      startDate: formData.has("startDate") ? (str("startDate") || null) : undefined,
      targetDate: formData.has("targetDate") ? (str("targetDate") || null) : undefined,
      icon: str("icon"),
      color: str("color"),
      notes: str("notes"),
      updatedAt: now(),
    })
    .where(eq(schema.projects.id, id));
  revalidatePath("/proyectos");
  revalidatePath(`/proyectos/${id}`);
  revalidatePath("/");
}

export async function archiveProjectAction(id: string, archived: boolean) {
  await requireAuth();
  await db
    .update(schema.projects)
    .set({ archived, status: archived ? "archivado" : "activo", updatedAt: now() })
    .where(eq(schema.projects.id, id));
  revalidatePath("/proyectos");
  revalidatePath(`/proyectos/${id}`);
}

export async function deleteProjectAction(id: string) {
  await requireAuth();
  await db.delete(schema.projects).where(eq(schema.projects.id, id));
  revalidatePath("/proyectos");
  redirect("/proyectos");
}

export async function renameColumnAction(columnId: string, title: string) {
  await requireAuth();
  if (!title.trim()) return;
  await db.update(schema.columns).set({ title: title.trim() }).where(eq(schema.columns.id, columnId));
  revalidatePath("/proyectos");
}

export async function reorderColumnsAction(boardId: string, orderedIds: string[]) {
  await requireAuth();
  const cols = await db.select().from(schema.columns).where(eq(schema.columns.boardId, boardId)).orderBy(asc(schema.columns.position));
  const valid = new Set(cols.map((c) => c.id));
  let i = 0;
  for (const id of orderedIds) {
    if (!valid.has(id)) continue;
    await db.update(schema.columns).set({ position: i++ }).where(eq(schema.columns.id, id));
  }
  revalidatePath("/proyectos");
}
