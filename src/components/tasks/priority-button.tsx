"use client";

import { useState, useTransition } from "react";
import { Star, X } from "lucide-react";
import { addTodayPriority, removeTodayPriority, replaceTodayPriority } from "@/lib/actions/cards";
import { useToast } from "@/components/ui/toast";

type Current = { cardId: string; title: string; position: number }[];

/** «Destacar hoy» (antes «Prioridad de hoy», Bloque 2) con feedback SIEMPRE:
 *  - hay lugar → se destaca + toast con Deshacer;
 *  - ya está destacada → se avisa;
 *  - ya hay tres → selector para elegir cuál sustituir (nunca en silencio).
 *  Por dentro sigue siendo today_priorities: solo cambió la presentación. */
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
            message: "Destacada para hoy ✓",
            action: { label: "Deshacer", onClick: () => removeTodayPriority(cardId) },
          });
        } else if (res.status === "duplicate") {
          toast.show({ tone: "info", message: "Ya está destacada hoy." });
        } else {
          setFull(res.current); // elegir cuál reemplazar
        }
      } catch {
        toast.show({ tone: "error", message: "No se pudo destacar. Inténtalo de nuevo." });
      }
    });
  }

  function replace(old: { cardId: string; title: string }) {
    start(async () => {
      try {
        await replaceTodayPriority(old.cardId, cardId);
        toast.show({
          message: `Destacada en lugar de «${old.title}» ✓`,
          action: { label: "Deshacer", onClick: () => replaceTodayPriority(cardId, old.cardId) },
          duration: 8000,
        });
      } catch {
        toast.show({ tone: "error", message: "No se pudo cambiar la destacada." });
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
        title="Destacar esta tarea hoy"
      >
        <Star size={14} aria-hidden /> Destacar hoy
      </button>

      {full && (
        <div
          className="fixed inset-0 z-[60] overlay-screen flex items-center justify-center p-6"
          onClick={(e) => e.target === e.currentTarget && setFull(null)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Sustituir una destacada"
            className="card card-raised w-full max-w-sm p-5"
            data-testid="priority-replace-dialog"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base text-forest-deep font-medium">Ya tienes 3 destacadas hoy</h3>
              <button type="button" onClick={() => setFull(null)} aria-label="Cerrar" className="btn btn-ghost !p-1.5">
                <X size={16} aria-hidden />
              </button>
            </div>
            <p className="text-sm text-stone mb-3">Elige cuál sustituir (la que salga no se pierde: sigue en Tareas).</p>
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
              Mejor no — dejar las tres
            </button>
          </div>
        </div>
      )}
    </>
  );
}
