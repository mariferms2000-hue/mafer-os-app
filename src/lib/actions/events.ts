"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, now, uid, schema } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { syncEventToGoogle, deleteGoogleEvent } from "@/lib/google/calendar";

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
  const e = await db.select().from(schema.events).where(eq(schema.events.id, id)).get();
  if (!e) return;
  await db
    .update(schema.events)
    .set({
      title: String(formData.get("title") ?? e.title),
      date: String(formData.get("date") ?? e.date),
      startTime: (formData.get("startTime") as string) || null,
      endTime: (formData.get("endTime") as string) || null,
      type: String(formData.get("type") ?? e.type),
      notes: String(formData.get("notes") ?? e.notes),
    })
    .where(eq(schema.events.id, id));
  await syncEventToGoogle(id).catch(() => {});
  revalidatePath("/calendario");
  revalidatePath("/");
}

export async function deleteEventAction(id: string) {
  await requireAuth();
  const e = await db.select().from(schema.events).where(eq(schema.events.id, id)).get();
  if (!e) return;
  if (e.gcalEventId) await deleteGoogleEvent(e.gcalEventId).catch(() => {});
  await db.delete(schema.events).where(eq(schema.events.id, id));
  revalidatePath("/calendario");
  revalidatePath("/");
}
