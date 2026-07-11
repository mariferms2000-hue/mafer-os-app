"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { requireAuth, setSetting, getSetting, verifyPassword } from "@/lib/auth";

export async function updateNameAction(formData: FormData) {
  await requireAuth();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await setSetting("user_name", name);
  revalidatePath("/");
  revalidatePath("/ajustes");
}

export type PwdState = { error?: string; ok?: boolean };

export async function changePasswordAction(_prev: PwdState, formData: FormData): Promise<PwdState> {
  await requireAuth();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (!(await verifyPassword(current))) return { error: "La contraseña actual no es correcta." };
  if (next.length < 8) return { error: "La nueva contraseña debe tener al menos 8 caracteres." };
  if (next !== confirm) return { error: "Las contraseñas nuevas no coinciden." };
  await setSetting("password_hash", await bcrypt.hash(next, 12));
  return { ok: true };
}

export async function getUserNameSetting() {
  return (await getSetting("user_name")) ?? "Mafer";
}
