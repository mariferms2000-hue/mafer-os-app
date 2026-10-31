"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, now, today, uid, schema } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { createCardInColumnKind, createDefaultBoard, insertInboxItem } from "@/lib/db/helpers";
import { normalizeDuration } from "@/lib/estimates";
import { syncEventToGoogle } from "@/lib/google/calendar";
import { progressAfterChange, revokeCompletion, type ProgressFeedback } from "@/lib/progress/credit";

export async function captureAction(formData: FormData): Promise<{ id: string } | undefined> {
  await requireAuth();
  const content = String(formData.get("content") ?? "").trim();
  if (!content) return undefined;
  const id = await insertInboxItem({
    content,
    note: String(formData.get("note") ?? "").trim(),
    typeHint: (formData.get("typeHint") as string) || null,
    projectId: (formData.get("projectId") as string) || null,
    date: (formData.get("date") as string) || null,
  });
  revalidatePath("/inbox");
  revalidatePath("/");
  return { id };
}

export async function updateInboxItem(formData: FormData) {
  await requireAuth();
  const id = String(formData.get("id"));
  const [item] = await db.select().from(schema.inboxItems).where(eq(schema.inboxItems.id, id)).limit(1);
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

/** La captura y la tarea a la que apunta («tarea:<id>»), si la tiene. */
async function captureWithCard(itemId: string) {
  const [item] = await db.select().from(schema.inboxItems).where(eq(schema.inboxItems.id, itemId)).limit(1);
  const [tipo, cardId] = (item?.convertedTo ?? "").split(":");
  if (!item || tipo !== "tarea" || !cardId) return null;
  const [card] = await db.select().from(schema.cards).where(eq(schema.cards.id, cardId)).limit(1);
  return { item, cardId, card: card ?? null };
}

/** Borra la tarea creada desde la captura y devuelve la captura al Inbox tal
 *  como estaba. Común a los dos Deshacer («Tarea» y «✓ Hecho»). */
async function restoreCapture(itemId: string, cardId: string, projectId: string | null | undefined) {
  await db.delete(schema.cards).where(eq(schema.cards.id, cardId));
  await db.update(schema.inboxItems).set({ processed: false, convertedTo: null }).where(eq(schema.inboxItems.id, itemId));
  revalidatePath("/inbox");
  revalidatePath("/");
  revalidatePath("/tareas");
  revalidatePath("/biblioteca/jardin");
  if (projectId) revalidatePath(`/proyectos/${projectId}`);
}

/** Deshace «captura → tarea» desde el toast: borra la tarea recién creada y la
 *  captura vuelve al Inbox tal como estaba. Solo actúa si la captura sigue
 *  apuntando a esa tarea y la tarea no se ha completado ni archivado, para no
 *  borrar trabajo hecho después. */
export async function undoInboxToTaskAction(itemId: string): Promise<boolean> {
  await requireAuth();
  const found = await captureWithCard(itemId);
  if (!found) return false;
  const { cardId, card } = found;
  if (card && (card.completedAt || card.archived)) return false;
  if (card) {
    await restoreCapture(itemId, cardId, card.projectId);
  } else {
    await db.update(schema.inboxItems).set({ processed: false, convertedTo: null }).where(eq(schema.inboxItems.id, itemId));
    revalidatePath("/inbox");
    revalidatePath("/");
  }
  return true;
}

/** «✓ Hecho»: sí lo hice. Crea la tarea YA completada (sin fecha; si la captura
 *  tenía proyecto, en su lista Terminado), marca la captura como procesada con
 *  el mismo «tarea:<id>» de siempre — Inbox no tiene un estado de completado
 *  propio — y acredita el punto con la infraestructura de progreso.
 *  Si el progreso falla, la tarea queda completada igual y vuelve
 *  `progressFailed` para que la interfaz lo diga. Una captura de ejemplo crea
 *  una tarea de ejemplo, que no cuenta. undefined = la captura ya no estaba
 *  pendiente (doble toque): no se crea nada. */
export async function completeInboxItemAction(
  itemId: string
): Promise<({ cardId: string } & ProgressFeedback) | undefined> {
  await requireAuth();
  const [item] = await db.select().from(schema.inboxItems).where(eq(schema.inboxItems.id, itemId)).limit(1);
  if (!item || item.processed) return undefined;

  const cardId = await createCardInColumnKind({
    title: item.content,
    description: item.note ?? "",
    projectId: item.projectId,
    columnKind: "terminado",
  });
  // updatedAt se deja igual a createdAt a propósito: así Deshacer sabe si la
  // tarea se tocó después (cualquier edición, reapertura o aviso lo cambia).
  await db
    .update(schema.cards)
    .set({ completedAt: now(), isStarter: item.isStarter ?? false })
    .where(eq(schema.cards.id, cardId));
  await db
    .update(schema.inboxItems)
    .set({ processed: true, convertedTo: `tarea:${cardId}` })
    .where(eq(schema.inboxItems.id, itemId));

  const progress = await progressAfterChange(cardId, false, true);
  revalidatePath("/inbox");
  revalidatePath("/");
  revalidatePath("/tareas");
  revalidatePath("/biblioteca/jardin");
  if (item.projectId) revalidatePath(`/proyectos/${item.projectId}`);
  return { cardId, ...progress };
}

export type UndoDoneResult =
  | ({ status: "ok" } & ProgressFeedback)
  | { status: "changed" } // la tarea se tocó después: no se revierte nada
  | { status: "failed" }; // el progreso no pudo revocarse: no se borró nada

/** Deshace «✓ Hecho» desde el toast. Solo si la captura sigue apuntando a esa
 *  tarea y la tarea sigue completada, sin archivar y sin tocar desde que se
 *  creó; si no, no se revierte nada (`changed`). Tampoco si su punto ya lo
 *  consumió otra recompensa que se conserva: la captura no puede dar dos.
 *  Primero se revoca el punto — con `rewardId`, exactamente la lógica de F1:
 *  si ese completado ganó la recompensa y sigue siendo la más reciente sin
 *  usar, se revoca y la ficha vuelve al frente de la bolsa. Si revocar falla,
 *  no se borra la tarea (`failed`): quedaría un punto de una tarea que ya no
 *  existe sin forma de quitarlo. */
export async function undoInboxDoneAction(itemId: string, rewardId?: string | null): Promise<UndoDoneResult> {
  await requireAuth();
  const found = await captureWithCard(itemId);
  if (!found?.card) return { status: "changed" };
  const { cardId, card } = found;
  if (!card.completedAt || card.archived || card.updatedAt !== card.createdAt) return { status: "changed" };

  let feedback: ProgressFeedback = {};
  try {
    const res = await revokeCompletion(cardId, rewardId);
    // el punto ya lo consumió otra recompensa y se conserva: borrar la tarea y
    // devolver la captura permitiría ganarlo otra vez con un nuevo «✓ Hecho»
    if (res && res.delta === 0) return { status: "changed" };
    if (res) feedback = { progress: res };
  } catch (err) {
    console.error("[progreso] no se pudo revocar el punto de «✓ Hecho»:", err);
    return { status: "failed" };
  }
  await restoreCapture(itemId, cardId, card.projectId);
  return { status: "ok", ...feedback };
}

/** Convierte una captura en otra entidad sin re-escribirla.
 *  Los campos específicos por tipo llegan en el mismo formulario (progressive disclosure).
 *  Devuelve el destino ("tipo:id") para poder abrirlo justo después. */
export async function convertInboxItem(formData: FormData): Promise<{ convertedTo: string } | undefined> {
  await requireAuth();
  const id = String(formData.get("id"));
  const target = String(formData.get("target"));
  const [item] = await db.select().from(schema.inboxItems).where(eq(schema.inboxItems.id, id)).limit(1);
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
      duration: normalizeDuration(str("duration")),
    });
    // Deliberadamente NO se escribe `nextAction`: la «siguiente acción» pertenece
    // al proyecto, no a la tarjeta. El detalle de una tarea nunca la muestra ni la
    // edita, así que persistirla aquí dejaba un dato huérfano en cards.next_action.
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
  } else if (target === "evento") {
    const evid = uid();
    await db.insert(schema.events).values({
      id: evid,
      title,
      date: str("date") || item.date || today(),
      startTime: str("startTime") || null,
      endTime: str("endTime") || null,
      type: str("eventType") || "evento",
      projectId: str("projectId") || item.projectId,
      notes: note,
      createdAt: t,
    });
    // Mismo trato que createEventAction: si Google Calendar está conectado se
    // sincroniza, y si no lo está la conversión sigue funcionando igual.
    await syncEventToGoogle(evid).catch(() => {});
    convertedTo = `evento:${evid}`;
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
  revalidatePath("/biblioteca/ideas");
  revalidatePath("/biblioteca/recursos");
  revalidatePath("/calendario");
  return { convertedTo };
}
