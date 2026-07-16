"use client";

import { useEffect, useState } from "react";
import { Sprout, Play, Leaf } from "lucide-react";
import { openFocusUrl } from "@/components/focus/focus-overlay";
import {
  focusRemainingSeconds,
  breakRemainingSeconds,
  formatClock,
  STAGES,
  nextStageInfo,
  type FocusState,
  type StageKey,
} from "@/lib/focus-logic";
import { FocusPlant } from "@/components/focus/plant";
import type { FocusOverview } from "@/lib/queries/focus";

/* Módulo compacto del Jardín de enfoque en Hoy — Fase 7D.
   Sin sesión: planta pequeña + progreso transparente + «Enfocarme».
   Con sesión: «En foco» + tiempo restante vivo + «Volver».
   Sin presets (viven en el overlay) y sin Marco vivo: en sesión activa
   lleva solo un tratamiento de estado discreto que no compite con el hero. */

const STAGE_LABEL: Record<StageKey, string> = Object.fromEntries(STAGES.map((s) => [s.key, s.label])) as Record<
  StageKey,
  string
>;

export function FocusModule({ overview }: { overview: FocusOverview }) {
  const s = overview.openSession;
  const [, tick] = useState(0);

  // Solo pinta: recalcula el restante desde los timestamps persistidos.
  useEffect(() => {
    if (!s || (s.phase !== "enfoque" && s.phase !== "descanso")) return;
    const id = setInterval(() => tick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [s, s?.phase]);

  if (s) {
    const state: FocusState = {
      phase: s.phase as FocusState["phase"],
      phaseStartedAt: s.phaseStartedAt,
      elapsedFocusSeconds: s.elapsedFocusSeconds,
      elapsedBreakSeconds: s.elapsedBreakSeconds,
      plannedFocusMin: s.plannedFocusMin,
      plannedBreakMin: s.plannedBreakMin,
    };
    const nowIso = new Date().toISOString();
    const isBreak = s.phase === "descanso" || s.phase === "descanso-pausado";
    const paused = s.phase === "pausado" || s.phase === "descanso-pausado";
    const clock =
      s.phase === "enfoque-listo"
        ? "0:00"
        : formatClock(isBreak ? breakRemainingSeconds(state, nowIso) : focusRemainingSeconds(state, nowIso));

    return (
      <section
        aria-labelledby="foco-hoy"
        className="card p-4 !border-border-focus/60"
        data-testid="focus-module"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 id="foco-hoy" className="section-eyebrow !text-sage-deep flex items-center gap-1.5">
              <Sprout size={13} aria-hidden /> En foco
              {paused ? " · en pausa" : isBreak ? " · descanso" : ""}
            </h2>
            <p className="text-2xl font-semibold tabular-nums leading-tight mt-1" data-testid="focus-module-clock">
              {s.phase === "enfoque-listo" ? "Bloque completo" : clock}
            </p>
            <p className="text-xs text-stone truncate mt-0.5">{s.cardTitle ?? "Enfoque libre"}</p>
          </div>
          <button
            type="button"
            className="btn btn-primary !py-1.5 !px-4 text-sm shrink-0"
            onClick={() => openFocusUrl()}
            data-testid="focus-module-open"
          >
            Volver
          </button>
        </div>
      </section>
    );
  }

  const plant = overview.plant;
  const stage = plant ? plant.stage : "semilla";
  const acc = plant ? plant.accumulatedMinutes : 0;
  const next = plant ? plant.next : nextStageInfo(0);

  return (
    <section aria-labelledby="foco-hoy" className="card p-4" data-testid="focus-module">
      <h2 id="foco-hoy" className="section-eyebrow flex items-center gap-1.5 mb-2">
        <Sprout size={13} className="text-sage-deep" aria-hidden /> Jardín de enfoque
      </h2>
      <div className="flex items-center gap-3">
        <FocusPlant stage={stage} className="h-14 w-14 shrink-0 text-sage-deep" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-charcoal">{STAGE_LABEL[stage]}</p>
          <p className="text-xs text-stone" data-testid="focus-module-progress">
            {next
              ? `${acc} de ${acc + next.missingMinutes} min para ${STAGE_LABEL[next.key].toLowerCase()}`
              : "Tu planta está completa"}
          </p>
          {overview.todayMinutes > 0 && <p className="text-xs text-stone-soft">Hoy: {overview.todayMinutes} min</p>}
        </div>
        <button
          type="button"
          className="btn btn-primary !py-1.5 !px-3.5 text-sm shrink-0"
          onClick={() => openFocusUrl()}
          data-testid="focus-module-open"
        >
          <Play size={14} aria-hidden /> Enfocarme
        </button>
      </div>
      {overview.garden.length > 0 && (
        <p className="text-[11px] text-stone-soft mt-2 flex items-center gap-1">
          <Leaf size={10} aria-hidden /> {overview.garden.length} planta{overview.garden.length > 1 ? "s" : ""} en tu
          jardín
        </p>
      )}
    </section>
  );
}
