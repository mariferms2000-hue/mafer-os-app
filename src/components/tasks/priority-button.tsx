"use client";

import { useState, useTransition } from "react";
import { Star, X } from "lucide-react";
import { addTodayPriority, removeTodayPriority, replaceTodayPriority } from "@/lib/actions/cards";
import { useToast } from "@/components/ui/toast";

type Current = { cardId: string; title: string; position: number }[];

/** «Marcar como prioridad de hoy» con feedback SIEMPRE:
 *  - espacio libre → se añade al primero disponible + toast con Deshacer;
 *  - ya es prioridad → «Ya está en tus prioridades»;
 *  - tres ocupados → selector para elegir cuál reemplazar (nunca en silencio). */
export function MarkPriorityButton({ cardId, className }: { cardId: string; className?: string }) {
  const [full, setFull] = useState<Current | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();

  function mark() {
    start(async () => {
      try {
        const res = await addTodayPriority(cardId);
        if (res.status === "added") {
          toast.show({
            message: "Añadida a tus prioridades de hoy ✓",
            action: { label: "Deshacer", onClick: () => removeTodayPriority(cardId) },
          });
        } else if (res.status === "duplicate") {
          toast.show({ tone: "info", message: "Ya está en tus prioridades de hoy." });
        } else {
          setFull(res.current); // elegir cuál reemplazar
        }
      } catch {
        toast.show({ tone: "error", message: "No se pudo marcar como prioridad. Inténtalo de nuevo." });
      }
    });
  }

  function replace(old: { cardId: string; title: string }) {
    start(async () => {
      try {
        await replaceTodayPriority(old.cardId, cardId);
        toast.show({
          message: `Prioridad reemplazada («${old.title}» salió) ✓`,
          action: { label: "Deshacer", onClick: () => replaceTodayPriority(cardId, old.cardId) },
          duration: 8000,
        });
      } catch {
        toast.show({ tone: "error", message: "No se pudo reemplazar la prioridad." });
      }
      setFull(null);
    });
  }

  return (
    <>
      <button
        type="button"
        className={className ?? "btn btn-secondary !py-1.5 !px-3 text-xs"}
        disabled={pending}
        onClick={mark}
        data-testid="mark-priority"
        title="Marcar como prioridad de hoy"
      >
        <Star size={14} aria-hidden /> Prioridad de hoy
      </button>

      {full && (
        <div
          className="fixed inset-0 z-[60] bg-charcoal/40 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={(e) => e.target === e.currentTarget && setFull(null)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Reemplazar una prioridad"
            className="card w-full max-w-sm p-5"
            data-testid="priority-replace-dialog"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base text-forest-deep font-medium">Tus 3 prioridades están llenas</h3>
              <button type="button" onClick={() => setFull(null)} aria-label="Cerrar" className="btn btn-ghost !p-1.5">
                <X size={16} aria-hidden />
              </button>
            </div>
            <p className="text-sm text-stone mb-3">Elige cuál reemplazar (la que salga no se pierde: sigue en Tareas).</p>
            <ul className="flex flex-col gap-1.5">
              {full.map((p) => (
                <li key={p.cardId}>
                  <button
                    type="button"
                    className="w-full text-left text-sm rounded-xl border border-sand px-3 py-2 hover:bg-sage-soft transition-colors"
                    disabled={pending}
                    onClick={() => replace(p)}
                    data-testid={`replace-priority-${p.position}`}
                  >
                    <span className="chip chip-sage mr-2">#{p.position + 1}</span>
                    {p.title}
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="btn btn-ghost text-xs mt-3" onClick={() => setFull(null)}>
              Mejor no — conservar las tres
            </button>
          </div>
        </div>
      )}
    </>
  );
}
