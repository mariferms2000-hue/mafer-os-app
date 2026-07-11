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

export async function deleteInboxItem(id: string) {
  await requireAuth();
  await db.delete(schema.inboxItems).where(eq(schema.inboxItems.id, id));
  revalidatePath("/inbox");
}

/** Convierte un elemento del Inbox en otra entidad sin volver a escribirlo. */
export async function convertInboxItem(formData: FormData) {
  await requireAuth();
  const id = String(formData.get("id"));
  const target = String(formData.get("target")); // tarea|proyecto|idea|aprendizaje|journal|decision|recurso
  const item = await db.select().from(schema.inboxItems).where(eq(schema.inboxItems.id, id)).get();
  if (!item) return;

  let convertedTo = "";
  const t = now();

  if (target === "tarea") {
    const projectId = (formData.get("projectId") as string) || null;
    const cardId = await createCardInColumnKind({
      title: item.content,
      description: item.note ?? "",
      projectId,
      columnKind: "proximo",
      dueDate: item.date,
    });
    convertedTo = `tarea:${cardId}`;
  } else if (target === "proyecto") {
    const pid = uid();
    await db.insert(schema.projects).values({
      id: pid,
      title: item.content,
      description: item.note ?? "",
      createdAt: t,
      updatedAt: t,
    });
    await createDefaultBoard(pid);
    convertedTo = `proyecto:${pid}`;
  } else if (target === "idea") {
    const iid = uid();
    await db.insert(schema.ideas).values({
      id: iid,
      title: item.content,
      description: item.note ?? "",
      createdAt: t,
      updatedAt: t,
    });
    convertedTo = `idea:${iid}`;
  } else if (target === "aprendizaje") {
    const lid = uid();
    await db.insert(schema.learningTopics).values({
      id: lid,
      title: item.content,
      motivation: item.note ?? "",
      createdAt: t,
      updatedAt: t,
    });
    convertedTo = `aprendizaje:${lid}`;
  } else if (target === "journal") {
    const jid = uid();
    await db.insert(schema.journalEntries).values({
      id: jid,
      title: item.content,
      body: item.note ?? "",
      date: item.date ?? today(),
      createdAt: t,
      updatedAt: t,
    });
    convertedTo = `journal:${jid}`;
  } else if (target === "decision") {
    const did = uid();
    await db.insert(schema.decisions).values({
      id: did,
      title: item.content,
      context: item.note ?? "",
      date: item.date ?? today(),
      projectId: item.projectId,
      createdAt: t,
    });
    convertedTo = `decision:${did}`;
  } else if (target === "recurso") {
    const rid = uid();
    await db.insert(schema.resources).values({
      id: rid,
      title: item.content,
      notes: item.note ?? "",
      url: /^https?:\/\//.test(item.note ?? "") ? item.note! : "",
      projectId: item.projectId,
      createdAt: t,
    });
    convertedTo = `recurso:${rid}`;
  } else {
    return;
  }

  await db
    .update(schema.inboxItems)
    .set({ processed: true, convertedTo })
    .where(eq(schema.inboxItems.id, id));

  revalidatePath("/inbox");
  revalidatePath("/");
  revalidatePath("/proyectos");
  revalidatePath("/explorar");
}

