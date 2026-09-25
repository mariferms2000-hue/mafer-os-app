"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { disconnectGoogle, resyncGoogle } from "@/lib/google/calendar";

export async function disconnectGoogleAction() {
  await requireAuth();
  await disconnectGoogle();
  revalidatePath("/calendario");
  revalidatePath("/ajustes");
}

export async function resyncGoogleAction() {
  await requireAuth();
  await resyncGoogle();
  revalidatePath("/calendario");
}
