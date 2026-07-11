"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, now, today, uid, schema } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { createCardInColumnKind, createDefaultBoard } from "@/lib/db/helpers";

export async function captureAction(formData: FormData) {
  await requireAuth();
  const content = String(formData.get("content") ?? "").trim();
  if (!content) return;
  await db.insert(schema.inboxItems).values({
    id: uid(),
    content,
    note: String(formData.get("note") ?? "").trim(),
    typeHint: (formData.get("typeHint") as string) || null,
    projectId: (formData.get("projectId") as string) || null,
    date: (formData.get("date") as string) || null,
    createdAt: now(),
  });
  revalidatePath("/inbox");
  revalidatePath("/");
}

export async function updateInboxItem(formData: FormData) {
  await requireAuth();
  const id = String(formData.get("id"));
  const item = await db.select().from(schema.inboxItems).where(eq(schema.inboxItems.id, id)).get();
  if (!item) return;
  await db
    .update(schema.inboxItems)
    .set({
      content: String(formData.get("content") ?? item.content).trim() || item.content,
      note: String(formData.get("note") ?? item.note ?? ""),
      typeHint: (formData.get("typeHint") as string) || item.typeHint,
    })
    .where(eq(schema.inboxItems.id, id));
  revalidatePath("/inbox");
}

export async function archiveInboxItem(id: string) {
  await requireAuth();
  await db
    .update(schema.inboxItems)
    .set({ processed: true, convertedTo: "archivado" })
    .where(eq(schema.inboxItems.id, id));
  revalidatePath("/inbox");
  revalidatePath("/");
}

export async function deleteInboxItem(id: string) {
  await requireAuth();
  await db.delete(schema.inboxItems).where(eq(schema.inboxItems.id, id));
  revalidatePath("/inbox");
  revalidatePath("/");
}

/** Convierte una captura en otra entidad sin re-escribirla.
 *  Los campos específicos por tipo llegan en el mismo formulario (progressive disclosure). */
export async function convertInboxItem(formData: FormData) {
  await requireAuth();
  const id = String(formData.get("id"));
  const target = String(formData.get("target"));
  const item = await db.select().from(schema.inboxItems).where(eq(schema.inboxItems.id, id)).get();
  if (!item) return;

  const title = String(formData.get("content") ?? item.content).trim() || item.content;
  const note = String(formData.get("note") ?? item.note ?? "");
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const t = now();
  let convertedTo = "";

  if (target === "tarea") {
    const cardId = await createCardInColumnKind({
      title,
      description: note,
      projectId: str("projectId") || null,
      columnKind: "proximo",
      dueDate: str("date") || item.date,
      duration: str("duration") || null,
    });
    if (str("nextAction")) {
      await db.update(schema.cards).set({ nextAction: str("nextAction") }).where(eq(schema.cards.id, cardId));
    }
    convertedTo = `tarea:${cardId}`;
  } else if (target === "proyecto") {
    const pid = uid();
    await db.insert(schema.projects).values({
      id: pid,
      title,
      description: note,
      objective: str("objective"),
      createdAt: t,
      updatedAt: t,
    });
    await createDefaultBoard(pid);
    convertedTo = `proyecto:${pid}`;
  } else if (target === "idea") {
    const iid = uid();
    await db.insert(schema.ideas).values({
      id: iid,
      title,
      description: note,
      category: str("category") || "general",
      createdAt: t,
      updatedAt: t,
    });
    convertedTo = `idea:${iid}`;
  } else if (target === "aprendizaje") {
    const lid = uid();
    await db.insert(schema.learningTopics).values({
      id: lid,
      title,
      motivation: str("motivation") || note,
      depth: str("depth") || "exploracion",
      keyQuestions: str("keyQuestions") ? str("keyQuestions").split("\n").map((q) => q.trim()).filter(Boolean) : [],
      createdAt: t,
      updatedAt: t,
    });
    convertedTo = `aprendizaje:${lid}`;
  } else if (target === "journal") {
    const jid = uid();
    await db.insert(schema.journalEntries).values({
      id: jid,
      title,
      body: note,
      date: str("date") || item.date || today(),
      templateType: str("templateType") || "libre",
      createdAt: t,
      updatedAt: t,
    });
    convertedTo = `journal:${jid}`;
  } else if (target === "decision") {
    const did = uid();
    await db.insert(schema.decisions).values({
      id: did,
      title,
      context: note,
      reason: str("reason"),
      date: str("date") || item.date || today(),
      projectId: str("projectId") || item.projectId,
      createdAt: t,
    });
    convertedTo = `decision:${did}`;
  } else if (target === "recurso") {
    const rid = uid();
    await db.insert(schema.resources).values({
      id: rid,
      title,
      notes: note,
      url: str("url") || (/^https?:\/\//.test(note) ? note : ""),
      type: str("resourceType") || "articulo",
      topic: str("topic"),
      projectId: str("projectId") || item.projectId,
      learningId: str("learningId") || null,
      createdAt: t,
    });
    convertedTo = `recurso:${rid}`;
  } else {
    return;
  }

  await db
    .update(schema.inboxItems)
    .set({ processed: true, convertedTo, content: title, note })
    .where(eq(schema.inboxItems.id, id));

  revalidatePath("/inbox");
  revalidatePath("/");
  revalidatePath("/tareas");
  revalidatePath("/proyectos");
  revalidatePath("/explorar");
  revalidatePath("/biblioteca/recursos");
}
