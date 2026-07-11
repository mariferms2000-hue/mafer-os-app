"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { disconnectGoogle } from "@/lib/google/calendar";

export async function disconnectGoogleAction() {
  await requireAuth();
  await disconnectGoogle();
  revalidatePath("/calendario");
  revalidatePath("/ajustes");
}
