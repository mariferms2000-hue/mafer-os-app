"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, PencilLine, Shuffle, Target, Sprout } from "lucide-react";
import { completeCardAction } from "@/lib/actions/cards";
import { openTaskUrl } from "@/components/tasks/task-detail";
import { openFocusUrl } from "@/components/focus/focus-overlay";
import { MarkPriorityButton } from "@/components/tasks/priority-button";
import { durationLabel, energyLabel } from "@/lib/estimates";
import { useToast } from "@/components/ui/toast";
import type { CardRow } from "@/lib/queries/today";

/** «Haz esto ahora»: UNA sola recomendación clara y explicada, para saber qué
 *  hacer en menos de diez segundos. «Otra sugerencia» rota entre las 3 mejores
 *  candidatas sin recargar. */
export function DoNow({ items, focusActive = false }: { items: { card: CardRow; reasons: string[] }[]; focusActive?: boolean }) {
  const [index, setIndex] = useState(0);
  const [pending, start] = useTransition();
  const toast = useToast();

  if (items.length === 0) {
    return (
      <section aria-labelledby="haz-ahora" className="card card-raised glow-focus p-6 text-center" data-testid="do-now">
        <h2 id="haz-ahora" className="section-eyebrow !text-sage-deep flex items-center justify-center gap-1.5 mb-2">
          <Target size={13} aria-hidden /> Haz esto ahora
        </h2>
        <p className="text-sm text-stone">
          No hay nada urgente pendiente. Elige una prioridad de hoy, procesa el Inbox o descansa sin culpa. 🌿
        </p>
      </section>
    );
  }

  const { card, reasons } = items[index % items.length];

  function complete() {
    start(async () => {
      let freedAt: number | null = null;
      try {
        const res = await completeCardAction(card.id, true);
        freedAt = res.freedPriorityAt;
      } catch {
        toast.show({ tone: "error", message: "No se pudo completar. Inténtalo de nuevo." });
        return;
      }
      toast.show({
        message: "Tarea completada ✓",
        action: {
          label: "Deshacer",
          onClick: async () => {
            try {
              await completeCardAction(card.id, false, freedAt);
            } catch {
              toast.show({ tone: "error", message: "No se pudo deshacer. Puedes reabrirla desde Terminadas." });
            }
          },
        },
        link: { label: "Ver en terminadas", href: "/tareas?v=terminadas" },
        duration: 8000,
      });
      setIndex(0); // el servidor recalcula; volvemos a la mejor candidata
    });
  }

  return (
    <section aria-labelledby="haz-ahora" className="card card-raised glow-focus p-6 md:p-7 text-center" data-testid="do-now">
      <div className="relative flex flex-col sm:flex-row items-center justify-center gap-1 mb-3">
        <h2 id="haz-ahora" className="section-eyebrow !text-sage-deep flex items-center gap-1.5">
          <Target size={13} aria-hidden /> Haz esto ahora
        </h2>
        {items.length > 1 && (
          <button
            type="button"
            className="btn btn-ghost !py-1 !px-2 text-xs sm:absolute sm:right-0 sm:top-1/2 sm:-translate-y-1/2"
            onClick={() => setIndex((i) => i + 1)}
            data-testid="do-now-other"
          >
            <Shuffle size={13} aria-hidden /> Otra sugerencia
          </button>
        )}
      </div>

      <button
        type="button"
        className="w-full group"
        onClick={() => openTaskUrl(card.id)}
        data-testid="do-now-title"
        aria-label={`Abrir «${card.title}»`}
      >
        <p className="font-display text-2xl md:text-[30px] font-medium leading-snug text-charcoal group-hover:text-forest transition-colors text-balance">
          {card.title}
        </p>
      </button>

      {/* separador editorial fino, como respiración */}
      <div className="flex items-center justify-center gap-3 my-3.5" aria-hidden>
        <span className="h-px w-16 md:w-24 bg-sand" />
        <span className="h-1.5 w-1.5 rotate-45 bg-sage-deep/60" />
        <span className="h-px w-16 md:w-24 bg-sand" />
      </div>

      <div className="flex flex-wrap justify-center gap-1.5">
        {card.projectTitle && <span className="chip">{card.projectTitle}</span>}
        {durationLabel(card.duration) && <span className="chip">{durationLabel(card.duration)}</span>}
        {energyLabel(card.energy) && <span className="chip">Energía {energyLabel(card.energy)?.toLowerCase()}</span>}
        {card.dueDate && <span className="chip">📅 {card.dueDate}</span>}
      </div>

      <p className="text-sm text-stone mt-2.5" data-testid="do-now-reasons">
        <span className="font-medium text-ink-green">Porque</span> {reasons.join(" · ")}.
      </p>

      <div className="flex flex-wrap justify-center gap-2 mt-4">
        <button
          type="button"
          className="btn btn-primary !py-2 !px-5"
          disabled={pending}
          onClick={complete}
          data-testid="do-now-complete"
        >
          <CheckCircle2 size={15} aria-hidden /> {pending ? "Guardando…" : "La terminé"}
        </button>
        <button
          type="button"
          className="btn btn-secondary !py-2"
          onClick={() => (focusActive ? openFocusUrl() : openFocusUrl(card.id))}
          data-testid="do-now-focus"
        >
          <Sprout size={15} aria-hidden /> {focusActive ? "Volver al enfoque" : "Enfocarme"}
        </button>
        <button
          type="button"
          className="btn btn-ghost !py-2"
          onClick={() => openTaskUrl(card.id)}
          data-testid="do-now-open"
        >
          <PencilLine size={15} aria-hidden /> Abrir tarea
        </button>
        <MarkPriorityButton cardId={card.id} className="btn btn-ghost !py-2 text-sm" />
      </div>
    </section>
  );
}
