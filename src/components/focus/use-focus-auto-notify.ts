"use client";

import { useEffect, useRef } from "react";
import { focusRemainingSeconds, breakRemainingSeconds, creditedMinutes, type FocusState } from "@/lib/focus-logic";
import { intentForAutomaticAction } from "@/lib/focus-notifications";
import { fireFocusNotification } from "@/lib/notification-bridge";

type SessionLike = {
  id: string;
  phase: string;
  phaseStartedAt: string;
  elapsedFocusSeconds: number;
  elapsedBreakSeconds: number;
  plannedFocusMin: number;
  plannedBreakMin: number;
  cardTitle: string | null;
};

/** Fase N1 — dispara el aviso local en cuanto el bloque o el descanso llegan
 *  a cero en tiempo real, mientras esta vista está montada (overlay o el
 *  módulo compacto de Hoy). Es un efecto DE SOLO LECTURA: nunca llama a una
 *  server action ni cambia una fila — el cierre real de la fase lo sigue
 *  haciendo, exactamente igual que antes, el intervalo propio de cada
 *  componente. Montar este hook en dos sitios a la vez es seguro: el dedupe
 *  de notification-bridge (por sesión + fase) evita el aviso doble, y
 *  JavaScript es de un solo hilo — dos intervalos nunca ejecutan su callback
 *  al mismo tiempo, así que el primero en revisar «¿ya avisé?» gana. */
export function useFocusAutoNotify(session: SessionLike | null) {
  const notifiedRef = useRef(false);

  useEffect(() => {
    if (!session || (session.phase !== "enfoque" && session.phase !== "descanso")) return;
    notifiedRef.current = false;

    const id = setInterval(() => {
      if (notifiedRef.current) return;
      const s: FocusState = {
        phase: session.phase as FocusState["phase"],
        phaseStartedAt: session.phaseStartedAt,
        elapsedFocusSeconds: session.elapsedFocusSeconds,
        elapsedBreakSeconds: session.elapsedBreakSeconds,
        plannedFocusMin: session.plannedFocusMin,
        plannedBreakMin: session.plannedBreakMin,
      };
      const nowIso = new Date().toISOString();
      const due =
        session.phase === "enfoque" ? focusRemainingSeconds(s, nowIso) <= 0 : breakRemainingSeconds(s, nowIso) <= 0;
      if (!due) return;

      notifiedRef.current = true;
      const action = session.phase === "enfoque" ? "completar-enfoque" : "terminar-descanso";
      const intent = intentForAutomaticAction(action, {
        minutes: creditedMinutes(s, nowIso),
        taskTitle: session.cardTitle,
      });
      fireFocusNotification(intent, { sessionId: session.id, phaseStartedAt: session.phaseStartedAt });
    }, 1000);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, session?.phase, session?.phaseStartedAt]);
}
