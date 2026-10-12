"use client";

import { useTransition } from "react";
import { Star, X } from "lucide-react";
import { removeTodayPriority, addTodayPriority } from "@/lib/actions/cards";
import { TaskLine } from "@/components/hoy/task-line";
import { useToast } from "@/components/ui/toast";
import type { CardRow } from "@/lib/queries/today";

/** Tareas destacadas hoy (antes «Tus 3 prioridades»). Ya no hay espacios vacíos
 *  que llenar cada mañana: el bloque solo aparece si destacaste algo con ☆
 *  desde «Haz esto ahora», el detalle de una tarea o un proyecto. Se conserva el
 *  máximo de tres para que destacar siga significando algo. */
export function Highlights({ cards }: { cards: CardRow[] }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  if (cards.length === 0) return null;

  return (
    <section aria-labelledby="destacadas" className="card p-5" data-testid="highlights">
      <h2 id="destacadas" className="section-eyebrow flex items-center gap-1.5 mb-1">
        <Star size={13} className="text-sage-deep" aria-hidden /> Destacadas hoy
      </h2>
      <ul className="divide-y divide-beige">
        {cards.map((c) => (
          <li key={c.id} className="flex items-start gap-1">
            <div className="min-w-0 flex-1">
              <TaskLine card={c} />
            </div>
            <button
              type="button"
              className="btn btn-ghost !p-1.5 mt-1.5 shrink-0 text-stone-soft hover:text-charcoal"
              aria-label={`Quitar «${c.title}» de destacadas`}
              title="Quitar de destacadas"
              disabled={pending}
              data-testid="highlight-remove"
              onClick={() =>
                start(async () => {
                  await removeTodayPriority(c.id);
                  toast.show({
                    tone: "info",
                    message: "Ya no está destacada (la tarea sigue en Tareas).",
                    action: { label: "Deshacer", onClick: async () => { await addTodayPriority(c.id); } },
                  });
                })
              }
            >
              <X size={14} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
