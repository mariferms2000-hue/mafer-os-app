"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, now, today, uid, schema } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { createDefaultBoard } from "@/lib/db/helpers";

/* ── Incubadora ─────────────────────────────────────── */

export async function createIdeaAction(formData: FormData) {
  await requireAuth();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const t = now();
  await db.insert(schema.ideas).values({
    id: uid(),
    title,
    description: String(formData.get("description") ?? ""),
    category: String(formData.get("category") ?? "general"),
    createdAt: t,
    updatedAt: t,
  });
  revalidatePath("/explorar");
}

export async function updateIdeaStatusAction(id: string, status: string) {
  await requireAuth();
  await db.update(schema.ideas).set({ status, updatedAt: now() }).where(eq(schema.ideas.id, id));
  revalidatePath("/explorar");
}

/** Gradúa una idea a proyecto activo o a tema Learn Fast. */
export async function graduateIdeaAction(id: string, target: "proyecto" | "learnfast") {
  await requireAuth();
  const idea = await db.select().from(schema.ideas).where(eq(schema.ideas.id, id)).get();
  if (!idea) return;
  const t = now();
  let graduatedTo = "";
  let dest = "";
  if (target === "proyecto") {
    const pid = uid();
    await db.insert(schema.projects).values({
      id: pid,
      title: idea.title,
      description: idea.description ?? "",
      createdAt: t,
      updatedAt: t,
    });
    await createDefaultBoard(pid);
    graduatedTo = `proyecto:${pid}`;
    dest = `/proyectos/${pid}`;
  } else {
    const lid = uid();
    await db.insert(schema.learningTopics).values({
      id: lid,
      title: idea.title,
      motivation: idea.description ?? "",
      status: "activo",
      createdAt: t,
      updatedAt: t,
    });
    graduatedTo = `aprendizaje:${lid}`;
    dest = `/explorar/learn-fast/${lid}`;
  }
  await db
    .update(schema.ideas)
    .set({ status: "graduada", graduatedTo, updatedAt: t })
    .where(eq(schema.ideas.id, id));
  revalidatePath("/explorar");
  redirect(dest);
}

/** «Mantener incubando»: marca la idea como revisada hoy (bump de updatedAt). */
export async function touchIdeaAction(id: string) {
  await requireAuth();
  await db.update(schema.ideas).set({ updatedAt: now() }).where(eq(schema.ideas.id, id));
  revalidatePath("/explorar");
  revalidatePath("/revisiones/semanal");
}

/** Cambio rápido de estado de un tema Learn Fast (revisión semanal). */
export async function setLearningStatusAction(id: string, status: string) {
  await requireAuth();
  await db.update(schema.learningTopics).set({ status, updatedAt: now() }).where(eq(schema.learningTopics.id, id));
  revalidatePath("/explorar/learn-fast");
  revalidatePath("/revisiones/semanal");
}

export async function deleteIdeaAction(id: string) {
  await requireAuth();
  await db.delete(schema.ideas).where(eq(schema.ideas.id, id));
  revalidatePath("/explorar");
}

/* ── Learn Fast ─────────────────────────────────────── */

export async function createLearningAction(formData: FormData) {
  await requireAuth();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const t = now();
  const id = uid();
  await db.insert(schema.learningTopics).values({
    id,
    title,
    motivation: String(formData.get("motivation") ?? ""),
    outcome: String(formData.get("outcome") ?? ""),
    depth: String(formData.get("depth") ?? "exploracion"),
    status: String(formData.get("status") ?? "idea"),
    evidenceClass: String(formData.get("evidenceClass") ?? "sin-clasificar"),
    createdAt: t,
    updatedAt: t,
  });
  revalidatePath("/explorar/learn-fast");
  redirect(`/explorar/learn-fast/${id}`);
}

export async function updateLearningAction(formData: FormData) {
  await requireAuth();
  const id = String(formData.get("id"));
  const topic = await db.select().from(schema.learningTopics).where(eq(schema.learningTopics.id, id)).get();
  if (!topic) return;
  const str = (k: string) => (formData.has(k) ? String(formData.get(k) ?? "") : undefined);
  await db
    .update(schema.learningTopics)
    .set({
      title: str("title")?.trim() || topic.title,
      motivation: str("motivation"),
      outcome: str("outcome"),
      depth: str("depth"),
      status: str("status"),
      evidenceClass: str("evidenceClass"),
      notes: str("notes"),
      result: str("result"),
      reviewDate: formData.has("reviewDate") ? (str("reviewDate") || null) : undefined,
      progress: formData.has("progress") ? Number(formData.get("progress")) : undefined,
      keyQuestions: formData.has("keyQuestions")
        ? String(formData.get("keyQuestions")).split("\n").map((q) => q.trim()).filter(Boolean)
        : undefined,
      sprint: formData.has("sprintGoal")
        ? {
            ...topic.sprint,
            goal: String(formData.get("sprintGoal") ?? ""),
            start: String(formData.get("sprintStart") ?? "") || undefined,
            end: String(formData.get("sprintEnd") ?? "") || undefined,
          }
        : undefined,
      updatedAt: now(),
    })
    .where(eq(schema.learningTopics.id, id));
  revalidatePath("/explorar/learn-fast");
  revalidatePath(`/explorar/learn-fast/${id}`);
}

export async function setLearningExercisesAction(
  id: string,
  exercises: { id: string; text: string; done: boolean }[]
) {
  await requireAuth();
  await db
    .update(schema.learningTopics)
    .set({ exercises, updatedAt: now() })
    .where(eq(schema.learningTopics.id, id));
  revalidatePath(`/explorar/learn-fast/${id}`);
}

export async function deleteLearningAction(id: string) {
  await requireAuth();
  await db.delete(schema.learningTopics).where(eq(schema.learningTopics.id, id));
  revalidatePath("/explorar/learn-fast");
  redirect("/explorar/learn-fast");
}

/* ── Journal ────────────────────────────────────────── */

export async function createJournalAction(formData: FormData) {
  await requireAuth();
  const title = String(formData.get("title") ?? "").trim() || `Entrada del ${today()}`;
  const t = now();
  const id = uid();
  await db.insert(schema.journalEntries).values({
    id,
    title,
    body: String(formData.get("body") ?? ""),
    date: String(formData.get("date") ?? today()),
    mood: (formData.get("mood") as string) || null,
    templateType: String(formData.get("templateType") ?? "libre"),
    projectId: (formData.get("projectId") as string) || null,
    tags: String(formData.get("tags") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    createdAt: t,
    updatedAt: t,
  });
  revalidatePath("/explorar/journal");
  redirect(`/explorar/journal/${id}`);
}

export async function updateJournalAction(formData: FormData) {
  await requireAuth();
  const id = String(formData.get("id"));
  const e = await db.select().from(schema.journalEntries).where(eq(schema.journalEntries.id, id)).get();
  if (!e) return;
  await db
    .update(schema.journalEntries)
    .set({
      title: String(formData.get("title") ?? e.title).trim() || e.title,
      body: String(formData.get("body") ?? e.body),
      date: String(formData.get("date") ?? e.date),
      mood: (formData.get("mood") as string) || null,
      templateType: String(formData.get("templateType") ?? e.templateType),
      tags: String(formData.get("tags") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
      updatedAt: now(),
    })
    .where(eq(schema.journalEntries.id, id));
  revalidatePath("/explorar/journal");
  revalidatePath(`/explorar/journal/${id}`);
}

export async function toggleJournalFavoriteAction(id: string) {
  await requireAuth();
  const e = await db.select().from(schema.journalEntries).where(eq(schema.journalEntries.id, id)).get();
  if (!e) return;
  await db
    .update(schema.journalEntries)
    .set({ favorite: !e.favorite })
    .where(eq(schema.journalEntries.id, id));
  revalidatePath("/explorar/journal");
  revalidatePath(`/explorar/journal/${id}`);
}

export async function deleteJournalAction(id: string) {
  await requireAuth();
  await db.delete(schema.journalEntries).where(eq(schema.journalEntries.id, id));
  revalidatePath("/explorar/journal");
  redirect("/explorar/journal");
}

/* ── Decisiones ─────────────────────────────────────── */

export async function createDecisionAction(formData: FormData) {
  await requireAuth();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  await db.insert(schema.decisions).values({
    id: uid(),
    title,
    date: String(formData.get("date") ?? today()),
    projectId: (formData.get("projectId") as string) || null,
    context: String(formData.get("context") ?? ""),
    decision: String(formData.get("decision") ?? ""),
    reason: String(formData.get("reason") ?? ""),
    consequences: String(formData.get("consequences") ?? ""),
    createdAt: now(),
  });
  revalidatePath("/explorar/decisiones");
}
