"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, now, uid, schema } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

/* ── Recursos ───────────────────────────────────────── */

export async function createResourceAction(formData: FormData) {
  await requireAuth();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  await db.insert(schema.resources).values({
    id: uid(),
    title,
    type: String(formData.get("type") ?? "articulo"),
    url: String(formData.get("url") ?? "").trim(),
    topic: String(formData.get("topic") ?? ""),
    projectId: (formData.get("projectId") as string) || null,
    learningId: (formData.get("learningId") as string) || null,
    notes: String(formData.get("notes") ?? ""),
    createdAt: now(),
  });
  revalidatePath("/biblioteca/recursos");
  revalidatePath("/explorar/learn-fast");
}

export async function updateResourceStatusAction(id: string, status: string) {
  await requireAuth();
  await db.update(schema.resources).set({ status }).where(eq(schema.resources.id, id));
  revalidatePath("/biblioteca/recursos");
}

export async function toggleResourceFavoriteAction(id: string) {
  await requireAuth();
  const [r] = await db.select().from(schema.resources).where(eq(schema.resources.id, id)).limit(1);
  if (!r) return;
  await db.update(schema.resources).set({ favorite: !r.favorite }).where(eq(schema.resources.id, id));
  revalidatePath("/biblioteca/recursos");
}

export async function deleteResourceAction(id: string) {
  await requireAuth();
  await db.delete(schema.resources).where(eq(schema.resources.id, id));
  revalidatePath("/biblioteca/recursos");
}

/* ── Prompts ────────────────────────────────────────── */

export async function createPromptAction(formData: FormData) {
  await requireAuth();
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!title || !body) return;
  const t = now();
  await db.insert(schema.prompts).values({
    id: uid(),
    title,
    body,
    tool: String(formData.get("tool") ?? "claude-code"),
    category: String(formData.get("category") ?? "general"),
    purpose: String(formData.get("purpose") ?? ""),
    requiredFiles: String(formData.get("requiredFiles") ?? ""),
    expectedOutput: String(formData.get("expectedOutput") ?? ""),
    projectId: (formData.get("projectId") as string) || null,
    notes: String(formData.get("notes") ?? ""),
    version: String(formData.get("version") ?? "1.0"),
    createdAt: t,
    updatedAt: t,
  });
  revalidatePath("/biblioteca/prompts");
}

export async function updatePromptAction(formData: FormData) {
  await requireAuth();
  const id = String(formData.get("id"));
  const [p] = await db.select().from(schema.prompts).where(eq(schema.prompts.id, id)).limit(1);
  if (!p) return;
  const str = (k: string) => (formData.has(k) ? String(formData.get(k) ?? "") : undefined);
  await db
    .update(schema.prompts)
    .set({
      title: str("title")?.trim() || p.title,
      body: str("body") || p.body,
      tool: str("tool"),
      category: str("category"),
      purpose: str("purpose"),
      requiredFiles: str("requiredFiles"),
      expectedOutput: str("expectedOutput"),
      notes: str("notes"),
      version: str("version"),
      updatedAt: now(),
    })
    .where(eq(schema.prompts.id, id));
  revalidatePath("/biblioteca/prompts");
}

export async function duplicatePromptAction(id: string) {
  await requireAuth();
  const [p] = await db.select().from(schema.prompts).where(eq(schema.prompts.id, id)).limit(1);
  if (!p) return;
  const t = now();
  await db.insert(schema.prompts).values({
    ...p,
    id: uid(),
    title: `${p.title} (copia)`,
    isStarter: false,
    createdAt: t,
    updatedAt: t,
  });
  revalidatePath("/biblioteca/prompts");
}

export async function togglePromptFavoriteAction(id: string) {
  await requireAuth();
  const [p] = await db.select().from(schema.prompts).where(eq(schema.prompts.id, id)).limit(1);
  if (!p) return;
  await db.update(schema.prompts).set({ favorite: !p.favorite }).where(eq(schema.prompts.id, id));
  revalidatePath("/biblioteca/prompts");
}

export async function deletePromptAction(id: string) {
  await requireAuth();
  await db.delete(schema.prompts).where(eq(schema.prompts.id, id));
  revalidatePath("/biblioteca/prompts");
}
