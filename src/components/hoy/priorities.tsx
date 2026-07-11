"use client";

import { useState, useTransition } from "react";
import { Star, X, Plus, CheckCircle2, Circle } from "lucide-react";
import {
  addTodayPriority,
  removeTodayPriority,
  completeCardAction,
  setEnergyTodayAction,
} from "@/lib/actions/cards";
import { useToast } from "@/components/ui/toast";
import type { CardRow } from "@/lib/queries/today";

export function Priorities({
  priorities,
  candidates,
}: {
  priorities: CardRow[];
  candidates: CardRow[];
}) {
  const [picking, setPicking] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const chosenIds = new Set(priorities.map((p) => p.id));

  function toggleComplete(card: CardRow, done: boolean) {
    start(async () => {
      await completeCardAction(card.id, !done);
      if (!done) {
        toast.show({
          message: "Prioridad completada ✓",
          action: { label: "Deshacer", onClick: () => completeCardAction(card.id, false) },
          link: { label: "Ver en terminadas", href: "/tareas?f=terminadas" },
          duration: 8000,
        });
      }
    });
  }

  return (
    <section aria-labelledby="prioridades" className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 id="prioridades" className="text-lg text-forest-deep flex items-center gap-2">
          <Star size={18} className="text-olive" aria-hidden /> Tus 3 prioridades
        </h2>
        {priorities.length < 3 && (
          <button type="button" className="btn btn-secondary !py-1.5 !px-3 text-xs" onClick={() => setPicking(!picking)} data-testid="pick-priority">
            <Plus size={14} aria-hidden /> Elegir
          </button>
        )}
      </div>

      {priorities.length === 0 && !picking && (
        <p className="text-sm text-stone">
          Todavía no eliges prioridades. Escoge un máximo de tres cosas que harían que hoy valga la pena.
        </p>
      )}

      <ol className="flex flex-col divide-y divide-beige">
        {priorities.map((card, i) => {
          const done = Boolean(card.completedAt);
          return (
            <li key={card.id} className="flex items-center gap-3 py-2.5">
              <span className="font-display text-xl text-sage-deep w-5 text-center shrink-0">{i + 1}</span>
              <button
                type="button"
                aria-label={done ? `Reabrir «${card.title}»` : `Completar «${card.title}»`}
                onClick={() => toggleComplete(card, done)}
                disabled={pending}
                className="text-sage-deep hover:text-forest shrink-0"
              >
                {done ? <CheckCircle2 size={20} aria-hidden /> : <Circle size={20} aria-hidden />}
              </button>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${done ? "line-through text-stone-soft" : ""}`}>{card.title}</p>
                {card.projectTitle && <p className="text-xs text-stone">{card.projectTitle}</p>}
              </div>
              <button
                type="button"
                aria-label={`Quitar «${card.title}» de prioridades`}
                onClick={() => start(() => removeTodayPriority(card.id))}
                disabled={pending}
                className="text-stone-soft hover:text-blocked shrink-0"
              >
                <X size={16} aria-hidden />
              </button>
            </li>
          );
        })}
      </ol>

      {picking && (
        <div className="mt-3 border-t border-beige pt-3">
          <p className="text-xs text-stone mb-2">Elige de tus tareas abiertas:</p>
          <ul className="max-h-56 overflow-y-auto flex flex-col gap-1" data-testid="priority-candidates">
            {candidates
              .filter((c) => !chosenIds.has(c.id))
              .map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="w-full text-left text-sm rounded-lg px-3 py-2 hover:bg-sage-soft flex items-center justify-between gap-2"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        await addTodayPriority(c.id);
                        setPicking(false);
                      })
                    }
                  >
                    <span className="truncate">{c.title}</span>
                    {c.projectTitle && <span className="chip shrink-0">{c.projectTitle}</span>}
                  </button>
                </li>
              ))}
            {candidates.filter((c) => !chosenIds.has(c.id)).length === 0 && (
              <li className="text-sm text-stone px-3 py-2">
                No hay tareas abiertas. Crea una desde un proyecto o el Inbox.
              </li>
            )}
          </ul>
        </div>
      )}
    </section>
  );
}

const ENERGY_EXPLANATION: Record<string, string> = {
  baja: "He ajustado tus sugerencias para energía baja: tareas cortas y ligeras primero.",
  media: "He ajustado tus sugerencias para energía media: balance entre corto y normal.",
  alta: "He ajustado tus sugerencias para energía alta: trabajo profundo primero.",
};

export function EnergySelector({ current }: { current: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const options = [
    { v: "baja", label: "Baja" },
    { v: "media", label: "Media" },
    { v: "alta", label: "Alta" },
  ];
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label="¿Cómo está tu energía hoy?">
      <span className="text-xs text-stone mr-1">¿Tu energía hoy?</span>
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          disabled={pending}
          data-testid={`energy-${o.v}`}
          aria-pressed={current === o.v}
          onClick={() =>
            start(async () => {
              await setEnergyTodayAction(o.v);
              toast.show({ tone: "info", message: ENERGY_EXPLANATION[o.v] });
            })
          }
          className={`chip transition-colors ${
            current === o.v ? "!bg-forest !text-cream !border-forest" : "hover:bg-sand"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
