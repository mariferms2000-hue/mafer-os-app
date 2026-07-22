"use server";

import { revalidatePath } from "next/cache";
import { asc, eq } from "drizzle-orm";
import { db, now, uid, schema } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { syncEventToGoogle, deleteGoogleEvent } from "@/lib/google/calendar";

export type EventDetailData = {
  event: typeof schema.events.$inferSelect & { projectTitle: string | null };
  projects: { id: string; title: string }[];
};

/** Datos frescos para abrir el detalle de un evento del calendario. */
export async function getEventDetailAction(eventId: string): Promise<EventDetailData | null> {
  await requireAuth();
  const [row] = await db
    .select({ event: schema.events, projectTitle: schema.projects.title })
    .from(schema.events)
    .leftJoin(schema.projects, eq(schema.events.projectId, schema.projects.id))
    .where(eq(schema.events.id, eventId))
    .limit(1);
  if (!row) return null;
  const projects = await db
    .select({ id: schema.projects.id, title: schema.projects.title })
    .from(schema.projects)
    .where(eq(schema.projects.archived, false))
    .orderBy(asc(schema.projects.title));
  return { event: { ...row.event, projectTitle: row.projectTitle }, projects };
}

export async function createEventAction(formData: FormData) {
  await requireAuth();
  const title = String(formData.get("title") ?? "").trim();
  const date = String(formData.get("date") ?? "");
  if (!title || !date) return;
  const id = uid();
  await db.insert(schema.events).values({
    id,
    title,
    date,
    startTime: (formData.get("startTime") as string) || null,
    endTime: (formData.get("endTime") as string) || null,
    type: String(formData.get("type") ?? "evento"),
    projectId: (formData.get("projectId") as string) || null,
    notes: String(formData.get("notes") ?? ""),
    createdAt: now(),
  });
  // Si Google Calendar está conectado, sincroniza (no rompe nada si no lo está).
  await syncEventToGoogle(id).catch(() => {});
  revalidatePath("/calendario");
  revalidatePath("/");
}

export async function updateEventAction(formData: FormData) {
  await requireAuth();
  const id = String(formData.get("id"));
  const [e] = await db.select().from(schema.events).where(eq(schema.events.id, id)).limit(1);
  if (!e) return;
  await db
    .update(schema.events)
    .set({
      title: String(formData.get("title") ?? e.title),
      date: String(formData.get("date") ?? e.date),
      startTime: (formData.get("startTime") as string) || null,
      endTime: (formData.get("endTime") as string) || null,
      type: String(formData.get("type") ?? e.type),
      projectId: formData.has("projectId") ? (formData.get("projectId") as string) || null : e.projectId,
      notes: String(formData.get("notes") ?? e.notes),
    })
    .where(eq(schema.events.id, id));
  await syncEventToGoogle(id).catch(() => {});
  revalidatePath("/calendario");
  revalidatePath("/");
}

export async function deleteEventAction(id: string) {
  await requireAuth();
  const [e] = await db.select().from(schema.events).where(eq(schema.events.id, id)).limit(1);
  if (!e) return;
  if (e.gcalEventId) await deleteGoogleEvent(e.gcalEventId).catch(() => {});
  await db.delete(schema.events).where(eq(schema.events.id, id));
  revalidatePath("/calendario");
  revalidatePath("/");
}
