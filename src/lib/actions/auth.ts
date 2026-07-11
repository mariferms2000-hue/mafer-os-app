"use server";

import { redirect } from "next/navigation";
import {
  createPassword,
  createSession,
  destroySession,
  hasPassword,
  verifyPassword,
} from "@/lib/auth";

export type AuthState = { error?: string };

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const firstTime = !(await hasPassword());

  if (firstTime) {
    const confirm = String(formData.get("confirm") ?? "");
    const name = String(formData.get("name") ?? "Mafer").trim();
    if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };
    if (password !== confirm) return { error: "Las contraseñas no coinciden." };
    await createPassword(password, name);
    await createSession();
  } else {
    const ok = await verifyPassword(password);
    if (!ok) return { error: "Contraseña incorrecta. Intenta de nuevo." };
    await createSession();
  }
  redirect("/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
