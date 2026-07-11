"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, now, uid, schema } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { createDefaultBoard } from "@/lib/db/helpers";

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
    priority: String(formData.get("priority") ?? "media"),
    icon: String(formData.get("icon") ?? "folder"),
    color: String(formData.get("color") ?? "sage"),
    targetDate: (formData.get("targetDate") as string) || null,
    createdAt: t,
    updatedAt: t,
  });
  await createDefaultBoard(id);
  revalidatePath("/proyectos");
  redirect(`/proyectos/${id}`);
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
