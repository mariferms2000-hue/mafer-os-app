"use client";

import { useState, useTransition } from "react";
import { Star, X, Plus, CheckCircle2, Circle } from "lucide-react";
import {
  addTodayPriority,
  removeTodayPriority,
  completeCardAction,
  setEnergyTodayAction,
} from "@/lib/actions/cards";
import { openTaskUrl } from "@/components/tasks/task-detail";
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
      const res = await completeCardAction(card.id, !done);
      if (!done) {
        // el espacio queda libre; nunca se elige otra automáticamente
        toast.show({
          message: "Prioridad completada ✓ — su espacio quedó libre",
          action: {
            label: "Deshacer",
            onClick: async () => {
              await completeCardAction(card.id, false, res.freedPriorityAt);
            },
          },
          secondAction: { label: "Elegir reemplazo", onClick: () => setPicking(true) },
          duration: 8000,
        });
      }
    });
  }

  return (
    <section aria-labelledby="prioridades">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 id="prioridades" className="text-lg text-forest-deep flex items-center gap-2">
            <Star size={17} className="text-olive" aria-hidden /> Tus 3 prioridades
          </h2>
          <p className="intro-italic text-[13px] mt-0.5">Tu foco de hoy — máximo tres, a propósito.</p>
        </div>
        {priorities.length < 3 && (
          <button type="button" className="btn btn-secondary !py-1.5 !px-3 text-xs" onClick={() => setPicking(!picking)} data-testid="pick-priority">
            <Plus size={14} aria-hidden /> Elegir
          </button>
        )}
      </div>

      <ol className="grid gap-3 md:grid-cols-3">
        {priorities.map((card, i) => {
          const done = Boolean(card.completedAt);
          return (
            <li key={card.id} className="card p-4 flex flex-col gap-2 min-h-[104px]">
              <div className="flex items-start justify-between gap-2">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-base ${
                    done ? "bg-done-soft text-done" : "bg-sage-soft text-forest"
                  }`}
                  aria-hidden
                >
                  {i + 1}
                </span>
                <button
                  type="button"
                  aria-label={`Quitar «${card.title}» de prioridades`}
                  onClick={() => start(() => removeTodayPriority(card.id))}
                  disabled={pending}
                  className="text-stone-soft hover:text-blocked shrink-0 -mr-1 -mt-1 p-1"
                >
                  <X size={15} aria-hidden />
                </button>
              </div>
              <button
                type="button"
                onClick={() => openTaskUrl(card.id)}
                data-testid="priority-open"
                className={`text-sm font-medium leading-snug flex-1 text-left ${done ? "line-through text-stone-soft" : ""}`}
                aria-label={`Abrir detalle de «${card.title}»`}
              >
                {card.title}
              </button>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-stone truncate">{card.projectTitle ?? ""}</span>
                <button
                  type="button"
                  aria-label={done ? `Reabrir «${card.title}»` : `Completar «${card.title}»`}
                  onClick={() => toggleComplete(card, done)}
                  disabled={pending}
                  className="text-sage-deep hover:text-forest shrink-0"
                >
                  {done ? <CheckCircle2 size={22} aria-hidden /> : <Circle size={22} aria-hidden />}
                </button>
              </div>
            </li>
          );
        })}
        {Array.from({ length: Math.max(0, 3 - priorities.length) }, (_, i) => (
          <li key={`slot-${i}`}>
            <button
              type="button"
              onClick={() => setPicking(true)}
              className="w-full h-full min-h-[104px] rounded-[20px] border border-dashed border-sand-deep/60 text-stone-soft hover:text-forest hover:border-sage-deep hover:bg-sage-soft/30 transition-colors flex flex-col items-center justify-center gap-1.5 text-sm"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-sand-deep/60 font-display">
                {priorities.length + i + 1}
              </span>
              Elegir prioridad
            </button>
          </li>
        ))}
      </ol>

      {picking && (
        <div className="card mt-3 p-3">
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
                        const res = await addTodayPriority(c.id);
                        setPicking(false);
                        if (res.status === "added") {
                          toast.show({
                            message: "Añadida a tus prioridades de hoy ✓",
                            action: { label: "Deshacer", onClick: () => removeTodayPriority(c.id) },
                          });
                        } else if (res.status === "duplicate") {
                          toast.show({ tone: "info", message: "Ya está en tus prioridades de hoy." });
                        } else {
                          toast.show({ tone: "warn", message: "Tus 3 prioridades ya están llenas. Quita una primero." });
                        }
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
