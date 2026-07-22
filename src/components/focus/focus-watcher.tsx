"use client";

import { useEffect } from "react";
import { getFocusOverviewAction } from "@/lib/actions/focus";
import { focusRemainingSeconds, breakRemainingSeconds, type FocusState } from "@/lib/focus-logic";
import { notifyFocusDue } from "@/lib/focus-notify";

// Cuenta regresiva en curso: vigilar de cerca para avisar casi al segundo.
const ACTIVE_MS = 5000;
// Sin sesión, en pausa, o ya avisada y esperando a que Mafer vuelva: no hay
// nada que cambie de un momento a otro, así que aflojamos el ritmo.
const IDLE_MS = 30000;

function toFocusState(s: {
  phase: string;
  phaseStartedAt: string;
  elapsedFocusSeconds: number;
  elapsedBreakSeconds: number;
  plannedFocusMin: number;
  plannedBreakMin: number;
}): FocusState {
  return {
    phase: s.phase as FocusState["phase"],
    phaseStartedAt: s.phaseStartedAt,
    elapsedFocusSeconds: s.elapsedFocusSeconds,
    elapsedBreakSeconds: s.elapsedBreakSeconds,
    plannedFocusMin: s.plannedFocusMin,
    plannedBreakMin: s.plannedBreakMin,
  };
}

/** Vigía silenciosa del Pomodoro: montada siempre en el layout (no solo
 *  cuando el Jardín de enfoque está abierto), avisa cuando termina una fase
 *  aunque Mafer esté en Tareas, Calendario, o cualquier otra vista — sin
 *  depender de que el overlay de Enfoque siga montado. No transiciona la
 *  sesión (eso lo sigue haciendo el overlay/`recoverFocusAction` al
 *  reabrirse): solo avisa, con `notifyFocusDue` evitando avisos duplicados
 *  si el overlay también está abierto y detecta lo mismo. */
export function FocusWatcher() {
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;

    async function tick() {
      let nextDelay = IDLE_MS;
      try {
        const overview = await getFocusOverviewAction();
        const s = overview.openSession;
        if (s && (s.phase === "enfoque" || s.phase === "descanso")) {
          const state = toFocusState(s);
          const nowIso = new Date().toISOString();
          const due =
            s.phase === "enfoque" ? focusRemainingSeconds(state, nowIso) <= 0 : breakRemainingSeconds(state, nowIso) <= 0;
          if (due) {
            notifyFocusDue(s.id, s.phase, s.phaseStartedAt, s.cardTitle ?? "");
          } else {
            nextDelay = ACTIVE_MS;
          }
        }
      } catch {
        // sin conexión momentánea u otra falla — se reintenta en el próximo tick
      } finally {
        if (alive) timer = setTimeout(tick, nextDelay);
      }
    }

    tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  return null;
}
