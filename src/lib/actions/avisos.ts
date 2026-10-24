"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, setSetting } from "@/lib/auth";
import { isSimulatedGoogle, SIM_FAIL_KEY } from "@/lib/avisos/gcal";
import {
  ACTIVE_KEY,
  applyAvisosReview,
  avisosActive,
  avisosTableReady,
  createTestAviso,
  deactivateAvisos,
  deleteTestAviso,
  repairAvisos,
  reviewExistingAvisos,
  syncAviso,
  type ApplyOutcome,
  type ReviewResult,
  type SyncResult,
} from "@/lib/avisos/sync";

function refresh() {
  revalidatePath("/ajustes");
  revalidatePath("/");
  revalidatePath("/tareas");
}

/** ¿Se muestra «🔔 Avisarme» en los formularios? */
export async function avisosEnabledAction(): Promise<boolean> {
  await requireAuth();
  return avisosActive();
}

export async function createTestAvisoAction(): Promise<SyncResult & { at?: string }> {
  await requireAuth();
  const r = await createTestAviso(5);
  refresh();
  return r;
}

export async function deleteTestAvisoAction(): Promise<SyncResult> {
  await requireAuth();
  const r = await deleteTestAviso();
  refresh();
  return r;
}

/** Activar exige que Mafer confirme las dos comprobaciones reales. */
export async function activateAvisosAction(checks: { iphone: boolean; alexa: boolean }): Promise<SyncResult> {
  await requireAuth();
  if (!(await avisosTableReady())) return { ok: false, error: "La base aún no tiene la tabla de avisos." };
  if (!checks.iphone || !checks.alexa) {
    return { ok: false, error: "Antes de activar, confirma la notificación en el iPhone y que Alexa no lee los avisos." };
  }
  await setSetting(ACTIVE_KEY, "1");
  refresh();
  return { ok: true };
}

export async function deactivateAvisosAction(): Promise<SyncResult> {
  await requireAuth();
  const r = await deactivateAvisos();
  refresh();
  return r;
}

export async function repairAvisosAction() {
  await requireAuth();
  const r = await repairAvisos();
  refresh();
  return r;
}

export async function retryAvisoAction(cardId: string): Promise<SyncResult> {
  await requireAuth();
  const r = await syncAviso(cardId);
  refresh();
  return r;
}

/** Solo lectura: lo que se movería y los fantasmas que se podrían borrar. */
export async function reviewAvisosAction(): Promise<ReviewResult> {
  await requireAuth();
  return reviewExistingAvisos();
}

/** Aplica únicamente lo que Mafer seleccionó y confirmó. */
export async function applyAvisosReviewAction(input: { moveCardIds: string[]; ghostEventIds: string[] }): Promise<ApplyOutcome> {
  await requireAuth();
  const clean = (xs: unknown) => (Array.isArray(xs) ? xs.filter((x): x is string => typeof x === "string").slice(0, 500) : []);
  const r = await applyAvisosReview({ moveCardIds: clean(input.moveCardIds), ghostEventIds: clean(input.ghostEventIds) });
  refresh();
  return r;
}

/** Solo en modo simulado (previews y E2E): provoca fallos para probar la reparación. */
export async function setSimulatedFailureAction(on: boolean) {
  await requireAuth();
  if (!isSimulatedGoogle()) throw new Error("Solo existe en el modo simulado.");
  await setSetting(SIM_FAIL_KEY, on ? "1" : "0");
  refresh();
}
