"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { featurePlant, fertilizePlant, undoFertilize, undoWater, waterPlant, type FertilizeResult, type WaterResult } from "@/lib/garden/care";

/* Acciones del cuidado del Jardín (F4): regar, fertilizar, elegir la planta
   especial y sus Deshacer. Nunca tocan minutos, etapas ni el Pomodoro. */

function revalidateGarden() {
  revalidatePath("/biblioteca/jardin");
  revalidatePath("/");
}

const asId = (v: unknown) => (typeof v === "string" && v.length > 0 && v.length <= 80 ? v : null);
const asIso = (v: unknown) => (typeof v === "string" && v.length <= 40 && Number.isFinite(Date.parse(v)) ? v : null);

export async function waterPlantAction(plantId: string): Promise<WaterResult> {
  await requireAuth();
  const id = asId(plantId);
  if (!id) return { ok: false, reason: "sin-sed" };
  const res = await waterPlant(id);
  if (res.ok) revalidateGarden();
  return res;
}

export async function undoWaterAction(plantId: string, rewardId: string, prevThirsty: string, prevWatered: string | null): Promise<boolean> {
  await requireAuth();
  const id = asId(plantId);
  const rid = asId(rewardId);
  const since = asIso(prevThirsty);
  if (!id || !rid || !since) return false;
  const ok = await undoWater(id, rid, since, prevWatered === null ? null : asIso(prevWatered));
  if (ok) revalidateGarden();
  return ok;
}

export async function fertilizePlantAction(plantId: string): Promise<FertilizeResult> {
  await requireAuth();
  const id = asId(plantId);
  if (!id) return { ok: false, reason: "no-completada" };
  const res = await fertilizePlant(id);
  if (res.ok) revalidateGarden();
  return res;
}

export async function undoFertilizeAction(plantId: string, rewardId: string, prevSpecial: string | null, prevThirsty: string | null): Promise<boolean> {
  await requireAuth();
  const id = asId(plantId);
  const rid = asId(rewardId);
  if (!id || !rid) return false;
  const ok = await undoFertilize(id, rid, prevSpecial === null ? null : asId(prevSpecial), prevThirsty === null ? null : asIso(prevThirsty));
  if (ok) revalidateGarden();
  return ok;
}

/** Lucir como especial una planta ya fertilizada (o ninguna, con null). Gratis. */
export async function featurePlantAction(plantId: string | null): Promise<{ ok: boolean; prevSpecial: string | null }> {
  await requireAuth();
  const id = plantId === null ? null : asId(plantId);
  if (plantId !== null && !id) return { ok: false, prevSpecial: null };
  const res = await featurePlant(id);
  if (res.ok) revalidateGarden();
  return res;
}
