"use server";

import { revalidatePath } from "next/cache";
import { eq, isNull } from "drizzle-orm";
import { db, now, today, uid, schema } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import {
  PRESETS,
  CUSTOM_BREAK_MIN,
  clampCustomFocus,
  initialState,
  transition,
  recover,
  applyMinutesToPlant,
  type FocusAction,
  type FocusState,
  type PresetKey,
} from "@/lib/focus-logic";

/* Server actions de Focus Garden — Fase 7B (motor sin interfaz).
   Regla de una sola sesión: si ya hay una abierta, empezar devuelve esa.
   La tarea vinculada es referencia blanda de solo lectura: aquí NUNCA se
   modifica una tarjeta (completarla usa completeCardAction desde la UI). */

function revalidateFocus() {
  revalidatePath("/");
}

type SessionRow = typeof schema.focusSessions.$inferSelect;

function toState(row: SessionRow): FocusState {
  return {
    phase: row.phase as FocusState["phase"],
    phaseStartedAt: row.phaseStartedAt,
    elapsedFocusSeconds: row.elapsedFocusSeconds,
    elapsedBreakSeconds: row.elapsedBreakSeconds,
    plannedFocusMin: row.plannedFocusMin,
    plannedBreakMin: row.plannedBreakMin,
  };
}

async function openSession(): Promise<SessionRow | null> {
  return (
    (await db.select().from(schema.focusSessions).where(isNull(schema.focusSessions.finishedAt)).get()) ?? null
  );
}

/** Planta actual; si no existe (primera vez), nace la primera semilla. */
async function activePlant() {
  const plant = await db.select().from(schema.focusPlants).where(isNull(schema.focusPlants.completedAt)).get();
  if (plant) return plant;
  const fresh = { id: uid(), species: "brote-comun", accumulatedMinutes: 0, startedAt: now(), completedAt: null };
  await db.insert(schema.focusPlants).values(fresh);
  return fresh;
}

/** Abona minutos de enfoque a la planta actual. Si se completa, pasa al jardín
 *  y nace una semilla nueva con el excedente (ningún minuto se pierde). */
async function creditPlant(minutes: number): Promise<{ plantCompleted: boolean }> {
  if (minutes <= 0) return { plantCompleted: false };
  const plant = await activePlant();
  const res = applyMinutesToPlant(plant.accumulatedMinutes, minutes);
  await db
    .update(schema.focusPlants)
    .set({ accumulatedMinutes: res.accumulated, completedAt: res.completed ? now() : null })
    .where(eq(schema.focusPlants.id, plant.id));
  if (res.completed) {
    await db.insert(schema.focusPlants).values({
      id: uid(),
      species: "brote-comun",
      accumulatedMinutes: res.overflow,
      startedAt: now(),
      completedAt: null,
    });
  }
  return { plantCompleted: res.completed };
}

/** Empieza una sesión (o retoma la abierta, si existe — nunca hay dos). */
export async function startFocusAction(input: {
  preset: PresetKey;
  cardId?: string | null;
  customFocusMin?: number;
  customWithBreak?: boolean;
}): Promise<{ id: string; resumed: boolean }> {
  await requireAuth();
  const open = await openSession();
  if (open) return { id: open.id, resumed: true };

  let focusMin: number;
  let breakMin: number;
  if (input.preset === "personalizado") {
    focusMin = clampCustomFocus(input.customFocusMin ?? 0);
    breakMin = input.customWithBreak ? CUSTOM_BREAK_MIN : 0;
  } else {
    const p = PRESETS[input.preset];
    if (!p) throw new Error(`Preset desconocido: ${input.preset}`);
    focusMin = p.focusMin;
    breakMin = p.breakMin;
  }

  const nowIso = now();
  const s = initialState(focusMin, breakMin, nowIso);
  const id = uid();
  await db.insert(schema.focusSessions).values({
    id,
    cardId: input.cardId ?? null,
    preset: input.preset,
    plannedFocusMin: focusMin,
    plannedBreakMin: breakMin,
    phase: s.phase,
    phaseStartedAt: s.phaseStartedAt,
    elapsedFocusSeconds: 0,
    elapsedBreakSeconds: 0,
    date: today(),
    startedAt: nowIso,
    createdAt: nowIso,
  });
  revalidateFocus();
  return { id, resumed: false };
}

/** Aplica una acción de la máquina de estados a la sesión abierta.
 *  Siempre recupera primero (por si el tiempo transcurrió con el navegador
 *  cerrado) y persiste el resultado. Al terminar, abona los minutos a la planta. */
export async function focusTransitionAction(
  id: string,
  action: FocusAction
): Promise<{ phase: string; finished: boolean; outcome?: string; creditedMinutes?: number; plantCompleted?: boolean }> {
  await requireAuth();
  const row = await db.select().from(schema.focusSessions).where(eq(schema.focusSessions.id, id)).get();
  if (!row) throw new Error("Sesión no encontrada.");
  if (row.finishedAt) return { phase: row.phase, finished: true, outcome: row.outcome ?? undefined };

  const nowIso = now();
  // 1) recuperación honesta; si la recuperación misma cierra la sesión, se persiste ese cierre
  const recovered = recover(toState(row), nowIso);
  let result = recovered;
  // 2) la acción pedida, sobre el estado recuperado (si la sesión sigue viva)
  if (!recovered.finished) {
    result = transition(recovered.state, action, nowIso);
  }

  const s = result.state;
  let plantCompleted = false;
  if (result.finished) {
    plantCompleted = (await creditPlant(result.finished.creditedMinutes)).plantCompleted;
  }
  await db
    .update(schema.focusSessions)
    .set({
      phase: s.phase,
      phaseStartedAt: s.phaseStartedAt,
      elapsedFocusSeconds: s.elapsedFocusSeconds,
      elapsedBreakSeconds: s.elapsedBreakSeconds,
      ...(result.finished
        ? { finishedAt: nowIso, outcome: result.finished.outcome, creditedMinutes: result.finished.creditedMinutes }
        : {}),
    })
    .where(eq(schema.focusSessions.id, id));
  revalidateFocus();
  return {
    phase: s.phase,
    finished: Boolean(result.finished),
    outcome: result.finished?.outcome,
    creditedMinutes: result.finished?.creditedMinutes,
    plantCompleted,
  };
}

/** Descarta la sesión abierta (recuperación tras un cierre raro). Queda
 *  registrada con outcome «descartada» y 0 minutos abonados — nada desaparece
 *  sin registro, pero el jardín solo crece con enfoque confirmado. */
export async function discardFocusAction(id: string): Promise<void> {
  await requireAuth();
  const row = await db.select().from(schema.focusSessions).where(eq(schema.focusSessions.id, id)).get();
  if (!row || row.finishedAt) return;
  await db
    .update(schema.focusSessions)
    .set({ finishedAt: now(), outcome: "descartada", creditedMinutes: 0 })
    .where(eq(schema.focusSessions.id, id));
  revalidateFocus();
}
