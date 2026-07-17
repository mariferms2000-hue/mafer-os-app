"use server";

import { revalidatePath } from "next/cache";
import { and, eq, gte, isNull } from "drizzle-orm";
import { db, now, today, uid, schema } from "@/lib/db";
import { requireAuth, setSetting } from "@/lib/auth";
import { DAILY_STEPS, WEEKLY_STEPS } from "@/lib/review-logic";

function revalidateReviews() {
  revalidatePath("/");
  revalidatePath("/revisiones");
  revalidatePath("/revisiones/diaria");
  revalidatePath("/revisiones/semanal");
  revalidatePath("/ajustes");
}

/** Retoma la sesión sin terminar del tipo, o crea una nueva. */
export async function startReviewAction(type: "diaria" | "semanal"): Promise<{ id: string; step: number }> {
  await requireAuth();
  const [open] = await db
    .select()
    .from(schema.reviews)
    .where(and(eq(schema.reviews.type, type), isNull(schema.reviews.finishedAt)))
    .limit(1);
  if (open) return { id: open.id, step: open.step };

  const inboxStart = (
    await db.select({ id: schema.inboxItems.id }).from(schema.inboxItems).where(eq(schema.inboxItems.processed, false))
  ).length;
  const id = uid();
  await db.insert(schema.reviews).values({
    id,
    type,
    date: today(),
    startedAt: now(),
    step: 1,
    meta: { inboxStart },
  });
  revalidateReviews();
  return { id, step: 1 };
}

/** Guarda el paso actual (el progreso persiste solo). */
export async function goToReviewStepAction(id: string, step: number) {
  await requireAuth();
  const [r] = await db.select().from(schema.reviews).where(eq(schema.reviews.id, id)).limit(1);
  if (!r || r.finishedAt) return;
  const max = r.type === "diaria" ? DAILY_STEPS : WEEKLY_STEPS;
  const clamped = Math.min(Math.max(1, step), max);
  await db.update(schema.reviews).set({ step: clamped }).where(eq(schema.reviews.id, id));
  revalidateReviews();
}

/** Cuenta un elemento atendido durante la revisión. */
export async function bumpReviewProcessedAction(id: string, n = 1) {
  await requireAuth();
  const [r] = await db.select().from(schema.reviews).where(eq(schema.reviews.id, id)).limit(1);
  if (!r || r.finishedAt) return;
  await db.update(schema.reviews).set({ processed: r.processed + n }).where(eq(schema.reviews.id, id));
}

/** Cierra la revisión (completa o dada por terminada a la mitad) y guarda el
 *  resumen honesto: qué se completó y qué quedó, calculado desde el inicio. */
export async function finishReviewAction(id: string, completed: boolean) {
  await requireAuth();
  const [r] = await db.select().from(schema.reviews).where(eq(schema.reviews.id, id)).limit(1);
  if (!r || r.finishedAt) return;

  const doneSince = (
    await db
      .select({ id: schema.cards.id })
      .from(schema.cards)
      .where(gte(schema.cards.completedAt, r.startedAt))
  ).length;
  const inboxNow = (
    await db.select({ id: schema.inboxItems.id }).from(schema.inboxItems).where(eq(schema.inboxItems.processed, false))
  ).length;
  const inboxStart = r.meta?.inboxStart ?? inboxNow;
  const inboxAtendidas = Math.max(0, inboxStart - inboxNow);

  const partes: string[] = [];
  if (doneSince) partes.push(`${doneSince} tarea${doneSince !== 1 ? "s" : ""} completada${doneSince !== 1 ? "s" : ""}`);
  if (inboxAtendidas) partes.push(`${inboxAtendidas} captura${inboxAtendidas !== 1 ? "s" : ""} del Inbox`);
  if (inboxNow) partes.push(`${inboxNow} en el Inbox para después`);
  const summary = partes.length ? partes.join(" · ") : "revisión de mantenimiento, sin cambios";

  await db
    .update(schema.reviews)
    .set({
      finishedAt: now(),
      completed,
      summary,
      processed: Math.max(r.processed, doneSince + inboxAtendidas),
    })
    .where(eq(schema.reviews.id, id));
  revalidateReviews();
}

/** Reiniciar: pide confirmación en la interfaz; NO revierte acciones ya
 *  aplicadas — solo archiva la sesión como incompleta y abre una nueva. */
export async function resetReviewAction(id: string): Promise<{ id: string } | undefined> {
  await requireAuth();
  const [r] = await db.select().from(schema.reviews).where(eq(schema.reviews.id, id)).limit(1);
  if (!r || r.finishedAt) return undefined;
  await db
    .update(schema.reviews)
    .set({ finishedAt: now(), completed: false, summary: "reiniciada — lo hecho no se revirtió" })
    .where(eq(schema.reviews.id, id));
  const nuevo = await startReviewAction(r.type as "diaria" | "semanal");
  return { id: nuevo.id };
}

/** Día preferido para la revisión semanal (Ajustes). "" = cualquier día. */
export async function setWeeklyReviewDayAction(day: string) {
  await requireAuth();
  await setSetting("review:weekly-day", day);
  revalidateReviews();
}
