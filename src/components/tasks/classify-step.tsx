"use client";

import { useState, useTransition } from "react";
import { Sparkles, PencilLine } from "lucide-react";
import { setTaskEstimatesAction } from "@/lib/actions/cards";
import { suggestEstimates, DURATION_LABEL, ENERGY_LABEL } from "@/lib/estimates";
import { DurationChips, EnergyChips } from "./estimate-chips";
import { openTaskUrl } from "./task-detail";
import { useToast } from "@/components/ui/toast";

/** Clasificación breve y opcional después de crear o convertir una tarea.
 *  El sistema sugiere (reglas locales sobre el título), Mafer confirma, cambia
 *  u omite. Nada se guarda sin su confirmación. */
export function ClassifyStep({
  cardId,
  title,
  onDone,
  showOpenTask = false,
}: {
  cardId: string;
  title: string;
  onDone: () => void;
  showOpenTask?: boolean;
}) {
  const suggestion = suggestEstimates(title);
  const [duration, setDuration] = useState<string | null>(suggestion?.duration ?? null);
  const [energy, setEnergy] = useState<string | null>(suggestion?.energy ?? null);
  const [pending, start] = useTransition();
  const toast = useToast();

  function confirm() {
    start(async () => {
      try {
        await setTaskEstimatesAction(cardId, duration, energy);
        toast.show({ message: "Clasificación guardada ✓" });
      } catch {
        toast.show({ tone: "warn", message: "No se pudo guardar la clasificación. Puedes ponerla después desde la tarea." });
      }
      onDone();
    });
  }

  return (
    <div className="flex flex-col gap-4" data-testid="classify-step">
      <div>
        <p className="text-sm font-medium">Tarea guardada ✓</p>
        <p className="text-sm text-stone mt-0.5">¿La clasificamos? Es opcional — puedes hacerlo después.</p>
      </div>

      {suggestion && (
        <p className="text-sm rounded-xl bg-sage-soft/60 border border-sage-soft px-3 py-2" data-testid="classify-suggestion">
          <Sparkles size={13} className="inline mr-1 text-olive" aria-hidden />
          <span className="chip chip-sage !text-[11px] mr-1.5">Sugerido</span>
          Duración <strong>{DURATION_LABEL[suggestion.duration]}</strong> · energía{" "}
          <strong>{ENERGY_LABEL[suggestion.energy].toLowerCase()}</strong>
          <span className="text-stone"> — porque el título contiene «{suggestion.matched}».</span>
        </p>
      )}

      <div>
        <p className="label">Duración estimada {suggestion && duration === suggestion.duration ? "(sugerida)" : ""}</p>
        <DurationChips value={duration} onChange={setDuration} />
      </div>
      <div>
        <p className="label">Energía requerida {suggestion && energy === suggestion.energy ? "(sugerida)" : ""}</p>
        <EnergyChips value={energy} onChange={setEnergy} />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-beige pt-3">
        <button type="button" className="btn btn-primary flex-1" disabled={pending} onClick={confirm} data-testid="classify-confirm">
          {pending ? "Guardando…" : "Confirmar"}
        </button>
        <button type="button" className="btn btn-secondary" disabled={pending} onClick={onDone} data-testid="classify-skip">
          Ahora no
        </button>
        {showOpenTask && (
          <button
            type="button"
            className="btn btn-ghost text-xs w-full justify-center"
            onClick={() => {
              onDone();
              openTaskUrl(cardId);
            }}
            data-testid="classify-open-task"
          >
            <PencilLine size={13} aria-hidden /> Abrir la tarea completa
          </button>
        )}
      </div>
    </div>
  );
}
