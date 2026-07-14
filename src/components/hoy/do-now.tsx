"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, PencilLine, Shuffle, Target } from "lucide-react";
import { completeCardAction } from "@/lib/actions/cards";
import { openTaskUrl } from "@/components/tasks/task-detail";
import { durationLabel, energyLabel } from "@/lib/estimates";
import { useToast } from "@/components/ui/toast";
import type { CardRow } from "@/lib/queries/today";

/** «Haz esto ahora»: UNA sola recomendación clara y explicada, para saber qué
 *  hacer en menos de diez segundos. «Otra sugerencia» rota entre las 3 mejores
 *  candidatas sin recargar. */
export function DoNow({ items }: { items: { card: CardRow; reasons: string[] }[] }) {
  const [index, setIndex] = useState(0);
  const [pending, start] = useTransition();
  const toast = useToast();

  if (items.length === 0) {
    return (
      <section aria-labelledby="haz-ahora" className="card p-5 !border-sage-deep border-2" data-testid="do-now">
        <h2 id="haz-ahora" className="text-lg text-forest-deep flex items-center gap-2 mb-1">
          <Target size={18} className="text-olive" aria-hidden /> Haz esto ahora
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
      try {
        await completeCardAction(card.id, true);
      } catch {
        toast.show({ tone: "warn", message: "No se pudo completar. Inténtalo de nuevo." });
        return;
      }
      toast.show({
        message: "Tarea completada ✓",
        action: {
          label: "Deshacer",
          onClick: async () => {
            try {
              await completeCardAction(card.id, false);
            } catch {
              toast.show({ tone: "warn", message: "No se pudo deshacer. Puedes reabrirla desde Terminadas." });
            }
          },
        },
        link: { label: "Ver en terminadas", href: "/tareas?f=terminadas" },
        duration: 8000,
      });
      setIndex(0); // el servidor recalcula; volvemos a la mejor candidata
    });
  }

  return (
    <section aria-labelledby="haz-ahora" className="card p-5 !border-sage-deep border-2" data-testid="do-now">
      <div className="flex items-center justify-between mb-2">
        <h2 id="haz-ahora" className="text-lg text-forest-deep flex items-center gap-2">
          <Target size={18} className="text-olive" aria-hidden /> Haz esto ahora
        </h2>
        {items.length > 1 && (
          <button
            type="button"
            className="btn btn-ghost !py-1 !px-2 text-xs"
            onClick={() => setIndex((i) => i + 1)}
            data-testid="do-now-other"
          >
            <Shuffle size={13} aria-hidden /> Otra sugerencia
          </button>
        )}
      </div>

      <button
        type="button"
        className="text-left w-full group"
        onClick={() => openTaskUrl(card.id)}
        data-testid="do-now-title"
        aria-label={`Abrir «${card.title}»`}
      >
        <p className="text-xl md:text-2xl font-medium leading-snug text-charcoal group-hover:text-forest transition-colors">
          {card.title}
        </p>
      </button>

      <div className="flex flex-wrap gap-1.5 mt-2">
        {card.projectTitle && <span className="chip">{card.projectTitle}</span>}
        {durationLabel(card.duration) && <span className="chip">{durationLabel(card.duration)}</span>}
        {energyLabel(card.energy) && <span className="chip">Energía {energyLabel(card.energy)?.toLowerCase()}</span>}
        {card.dueDate && <span className="chip">📅 {card.dueDate}</span>}
      </div>

      <p className="text-sm text-stone mt-2" data-testid="do-now-reasons">
        <span className="font-medium text-ink-green">Porque</span> {reasons.join(" · ")}.
      </p>

      <div className="flex flex-wrap gap-2 mt-3">
        <button
          type="button"
          className="btn btn-primary !py-2"
          disabled={pending}
          onClick={complete}
          data-testid="do-now-complete"
        >
          <CheckCircle2 size={15} aria-hidden /> {pending ? "Guardando…" : "La terminé"}
        </button>
        <button
          type="button"
          className="btn btn-secondary !py-2"
          onClick={() => openTaskUrl(card.id)}
          data-testid="do-now-open"
        >
          <PencilLine size={15} aria-hidden /> Abrir tarea
        </button>
      </div>
    </section>
  );
}
