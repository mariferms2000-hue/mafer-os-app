/* Lógica pura de Focus Garden — Fase 7B. Sin dependencias de base de datos
   ni de React: todas las funciones reciben `nowIso` para ser deterministas
   y probables. La fuente de verdad del tiempo son los timestamps persistidos;
   un contador en pantalla solo PINTA lo que estas funciones calculan.

   Principios encarnados aquí (aprobados en 7A):
   - el crecimiento es acumulativo por planta, nunca diario ni por rachas;
   - nada se pierde: terminar antes conserva los minutos reales;
   - la recuperación tras cerrar el navegador es honesta (nunca acredita
     más tiempo del planeado);
   - los cambios de reloj del sistema no corrompen nada (deltas acotados). */

// ── Presets ──────────────────────────────────────────────────────

export type PresetKey = "arranque" | "ligero" | "pomodoro" | "profundo" | "personalizado";

export const PRESETS: Record<Exclude<PresetKey, "personalizado">, { focusMin: number; breakMin: number; label: string }> = {
  arranque: { focusMin: 5, breakMin: 0, label: "Arranque" },
  ligero: { focusMin: 15, breakMin: 5, label: "Ligero" },
  pomodoro: { focusMin: 25, breakMin: 5, label: "Pomodoro" },
  profundo: { focusMin: 45, breakMin: 10, label: "Profundo" },
};

/** Personalizado v1: un solo campo de minutos de enfoque, descanso opcional fijo. */
export const CUSTOM_FOCUS_MIN = 5;
export const CUSTOM_FOCUS_MAX = 90;
export const CUSTOM_BREAK_MIN = 5;

/** Normaliza los minutos del preset personalizado al rango permitido. */
export function clampCustomFocus(min: number): number {
  if (!Number.isFinite(min)) return CUSTOM_FOCUS_MIN;
  return Math.max(CUSTOM_FOCUS_MIN, Math.min(CUSTOM_FOCUS_MAX, Math.round(min)));
}

// ── Etapas de la planta ──────────────────────────────────────────

export type StageKey = "semilla" | "brote" | "hojas" | "planta-joven" | "planta-completa";

/** Umbrales aprobados: 0 · 25 · 75 · 150 · 300 minutos de enfoque real. */
export const STAGES: { key: StageKey; minMinutes: number; label: string }[] = [
  { key: "semilla", minMinutes: 0, label: "Semilla" },
  { key: "brote", minMinutes: 25, label: "Brote" },
  { key: "hojas", minMinutes: 75, label: "Hojas" },
  { key: "planta-joven", minMinutes: 150, label: "Planta joven" },
  { key: "planta-completa", minMinutes: 300, label: "Planta completa" },
];

export const PLANT_COMPLETE_MINUTES = 300;

export function plantStage(accumulatedMinutes: number): StageKey {
  const m = Math.max(0, accumulatedMinutes);
  let stage: StageKey = "semilla";
  for (const s of STAGES) if (m >= s.minMinutes) stage = s.key;
  return stage;
}

/** Siguiente etapa y minutos que faltan — para explicar el progreso con
 *  transparencia («Le faltan 40 min para hojas»). null si ya está completa. */
export function nextStageInfo(accumulatedMinutes: number): { key: StageKey; missingMinutes: number } | null {
  const m = Math.max(0, accumulatedMinutes);
  for (const s of STAGES) {
    if (m < s.minMinutes) return { key: s.key, missingMinutes: s.minMinutes - m };
  }
  return null;
}

/** Abona minutos a la planta actual. Si cruza el umbral, la planta se completa
 *  (se guarda con exactamente 300) y el excedente pasa a la semilla nueva:
 *  ningún minuto se pierde jamás. */
export function applyMinutesToPlant(
  accumulatedMinutes: number,
  addMinutes: number
): { accumulated: number; completed: boolean; overflow: number } {
  const add = Math.max(0, Math.floor(addMinutes));
  const total = Math.max(0, accumulatedMinutes) + add;
  if (total >= PLANT_COMPLETE_MINUTES) {
    return { accumulated: PLANT_COMPLETE_MINUTES, completed: true, overflow: total - PLANT_COMPLETE_MINUTES };
  }
  return { accumulated: total, completed: false, overflow: 0 };
}

// ── Estados de sesión ────────────────────────────────────────────

export type FocusPhase = "enfoque" | "pausado" | "enfoque-listo" | "descanso" | "descanso-pausado";
export type FocusOutcome = "completa" | "terminada-antes" | "descartada";

export type FocusAction =
  | "pausar"
  | "reanudar"
  | "terminar-antes"
  | "completar-enfoque"
  | "empezar-descanso"
  | "saltar-descanso"
  | "terminar-descanso";

/** Estado persistible de una sesión (espejo de la fila de focus_sessions). */
export type FocusState = {
  phase: FocusPhase;
  phaseStartedAt: string; // ISO del inicio de la fase actual
  elapsedFocusSeconds: number; // consolidado en transiciones (no incluye la fase en curso)
  elapsedBreakSeconds: number;
  plannedFocusMin: number;
  plannedBreakMin: number;
};

export type TransitionResult = {
  state: FocusState;
  /** presente cuando la sesión terminó con esta transición */
  finished?: { outcome: FocusOutcome; creditedMinutes: number };
};

/** Delta de segundos entre dos ISO, acotado a [0, cap]. Un reloj que retrocede
 *  o un timestamp corrupto nunca produce tiempo negativo ni infinito. */
function boundedDelta(fromIso: string, toIso: string, capSeconds: number): number {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  const delta = Math.floor((to - from) / 1000);
  return Math.max(0, Math.min(delta, capSeconds));
}

/** Segundos de enfoque reales hasta `nowIso` (consolidado + fase en curso),
 *  acotados al tiempo planeado. */
export function focusElapsedSeconds(s: FocusState, nowIso: string): number {
  const cap = s.plannedFocusMin * 60;
  let elapsed = Math.max(0, Math.min(s.elapsedFocusSeconds, cap));
  if (s.phase === "enfoque") {
    elapsed = Math.min(cap, elapsed + boundedDelta(s.phaseStartedAt, nowIso, cap));
  }
  return elapsed;
}

export function focusRemainingSeconds(s: FocusState, nowIso: string): number {
  return s.plannedFocusMin * 60 - focusElapsedSeconds(s, nowIso);
}

export function breakElapsedSeconds(s: FocusState, nowIso: string): number {
  const cap = s.plannedBreakMin * 60;
  let elapsed = Math.max(0, Math.min(s.elapsedBreakSeconds, cap));
  if (s.phase === "descanso") {
    elapsed = Math.min(cap, elapsed + boundedDelta(s.phaseStartedAt, nowIso, cap));
  }
  return elapsed;
}

export function breakRemainingSeconds(s: FocusState, nowIso: string): number {
  return s.plannedBreakMin * 60 - breakElapsedSeconds(s, nowIso);
}

/** Minutos que se abonan a la planta: solo enfoque real, redondeado hacia abajo. */
export function creditedMinutes(s: FocusState, nowIso: string): number {
  return Math.floor(focusElapsedSeconds(s, nowIso) / 60);
}

/** Estado inicial de una sesión recién empezada. */
export function initialState(plannedFocusMin: number, plannedBreakMin: number, nowIso: string): FocusState {
  return {
    phase: "enfoque",
    phaseStartedAt: nowIso,
    elapsedFocusSeconds: 0,
    elapsedBreakSeconds: 0,
    plannedFocusMin,
    plannedBreakMin,
  };
}

/** Transición pura de la máquina de estados. Lanza Error ante una acción
 *  inválida para la fase actual (la UI nunca debería ofrecerla). */
export function transition(s: FocusState, action: FocusAction, nowIso: string): TransitionResult {
  switch (action) {
    case "pausar": {
      if (s.phase === "enfoque") {
        return {
          state: { ...s, phase: "pausado", elapsedFocusSeconds: focusElapsedSeconds(s, nowIso), phaseStartedAt: nowIso },
        };
      }
      if (s.phase === "descanso") {
        return {
          state: { ...s, phase: "descanso-pausado", elapsedBreakSeconds: breakElapsedSeconds(s, nowIso), phaseStartedAt: nowIso },
        };
      }
      break;
    }
    case "reanudar": {
      if (s.phase === "pausado") return { state: { ...s, phase: "enfoque", phaseStartedAt: nowIso } };
      if (s.phase === "descanso-pausado") return { state: { ...s, phase: "descanso", phaseStartedAt: nowIso } };
      break;
    }
    case "terminar-antes": {
      // Válido durante el enfoque (o su pausa): conserva los minutos reales.
      if (s.phase === "enfoque" || s.phase === "pausado") {
        const consolidated = { ...s, elapsedFocusSeconds: focusElapsedSeconds(s, nowIso), phaseStartedAt: nowIso };
        return {
          state: consolidated,
          finished: { outcome: "terminada-antes", creditedMinutes: creditedMinutes(consolidated, nowIso) },
        };
      }
      break;
    }
    case "completar-enfoque": {
      // El bloque llegó a su fin (contador en cero o recuperación tras cierre).
      if (s.phase === "enfoque" || s.phase === "pausado") {
        const done = { ...s, phase: "enfoque-listo" as FocusPhase, elapsedFocusSeconds: focusElapsedSeconds(s, nowIso), phaseStartedAt: nowIso };
        // Sin descanso planeado (Arranque) no hay fase de descanso que ofrecer:
        // el ciclo se cierra completo aquí mismo.
        if (s.plannedBreakMin <= 0) {
          return { state: done, finished: { outcome: "completa", creditedMinutes: creditedMinutes(done, nowIso) } };
        }
        return { state: done };
      }
      break;
    }
    case "empezar-descanso": {
      if (s.phase === "enfoque-listo" && s.plannedBreakMin > 0) {
        return { state: { ...s, phase: "descanso", phaseStartedAt: nowIso } };
      }
      break;
    }
    case "saltar-descanso": {
      // Saltar el descanso es siempre válido y cierra el ciclo completo.
      if (s.phase === "enfoque-listo" || s.phase === "descanso" || s.phase === "descanso-pausado") {
        const consolidated = s.phase === "descanso" ? { ...s, elapsedBreakSeconds: breakElapsedSeconds(s, nowIso) } : s;
        return {
          state: { ...consolidated, phaseStartedAt: nowIso },
          finished: { outcome: "completa", creditedMinutes: creditedMinutes(consolidated, nowIso) },
        };
      }
      break;
    }
    case "terminar-descanso": {
      if (s.phase === "descanso" || s.phase === "descanso-pausado") {
        const consolidated = s.phase === "descanso" ? { ...s, elapsedBreakSeconds: breakElapsedSeconds(s, nowIso) } : s;
        return {
          state: { ...consolidated, phaseStartedAt: nowIso },
          finished: { outcome: "completa", creditedMinutes: creditedMinutes(consolidated, nowIso) },
        };
      }
      break;
    }
  }
  throw new Error(`Acción «${action}» inválida en fase «${s.phase}»`);
}

/** Recuperación al reabrir (refresh, Safari cerrado, pestaña congelada):
 *  reconstruye el estado honesto desde los timestamps. Nunca acredita más
 *  tiempo del planeado. Las fases pausadas se conservan tal cual — pausar
 *  es válido y no caduca. Devuelve también si la sesión debió cerrarse
 *  (descanso que terminó solo mientras el navegador estaba cerrado). */
export function recover(s: FocusState, nowIso: string): TransitionResult {
  if (s.phase === "enfoque" && focusRemainingSeconds(s, nowIso) <= 0) {
    // El bloque terminó mientras no mirábamos: pasa a «enfoque-listo»
    // (o cierra completo si no hay descanso), acreditando solo lo planeado.
    return transition(s, "completar-enfoque", nowIso);
  }
  if (s.phase === "descanso" && breakRemainingSeconds(s, nowIso) <= 0) {
    return transition(s, "terminar-descanso", nowIso);
  }
  return { state: s };
}
