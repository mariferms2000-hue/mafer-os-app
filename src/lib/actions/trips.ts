"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, now, uid, schema } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { isValidTripRange } from "@/lib/trip-logic";

export type Trip = typeof schema.trips.$inferSelect;

/** Datos frescos para abrir el detalle de un viaje. */
export async function getTripDetailAction(tripId: string): Promise<Trip | null> {
  await requireAuth();
  const [trip] = await db.select().from(schema.trips).where(eq(schema.trips.id, tripId)).limit(1);
  return trip ?? null;
}

export async function createTripAction(formData: FormData) {
  await requireAuth();
  const title = String(formData.get("title") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "");
  const endDate = String(formData.get("endDate") ?? "");
  if (!title || !isValidTripRange(startDate, endDate)) return;
  await db.insert(schema.trips).values({
    id: uid(),
    title,
    destination: (formData.get("destination") as string) || null,
    startDate,
    endDate,
    notes: String(formData.get("notes") ?? ""),
    createdAt: now(),
  });
  revalidatePath("/calendario");
  revalidatePath("/");
}

export async function updateTripAction(formData: FormData) {
  await requireAuth();
  const id = String(formData.get("id"));
  const [t] = await db.select().from(schema.trips).where(eq(schema.trips.id, id)).limit(1);
  if (!t) return;
  const startDate = String(formData.get("startDate") ?? t.startDate);
  const endDate = String(formData.get("endDate") ?? t.endDate);
  if (!isValidTripRange(startDate, endDate)) return;
  await db
    .update(schema.trips)
    .set({
      title: String(formData.get("title") ?? t.title) || t.title,
      destination: formData.has("destination") ? (formData.get("destination") as string) || null : t.destination,
      startDate,
      endDate,
      notes: String(formData.get("notes") ?? t.notes),
    })
    .where(eq(schema.trips.id, id));
  revalidatePath("/calendario");
  revalidatePath("/");
}

export async function deleteTripAction(id: string) {
  await requireAuth();
  await db.delete(schema.trips).where(eq(schema.trips.id, id));
  revalidatePath("/calendario");
  revalidatePath("/");
}
