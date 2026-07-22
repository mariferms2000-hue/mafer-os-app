"use client";

import { useState, useTransition } from "react";
import { Circle, CheckCircle2, Clock, Zap, CalendarClock, Ban, Hourglass, MoreHorizontal, PencilLine, Trash2 } from "lucide-react";
import Link from "next/link";
import { completeCardAction, deleteCardAction } from "@/lib/actions/cards";
import { openTaskUrl } from "@/components/tasks/task-detail";
import { durationLabel, energyLabel } from "@/lib/estimates";
import { useToast } from "@/components/ui/toast";
import type { CardRow } from "@/lib/queries/today";

/** Línea de tarea reutilizable: check + título + chips de contexto.
 *  El cuerpo abre el detalle editable (reflejado en la URL con ?abrir=<id>);
 *  el círculo solo completa/reabre. Completar nunca borra: mueve a Terminado,
 *  guarda la fecha y ofrece deshacer. */
export function TaskLine({ card, showProject = true }: { card: CardRow; showProject?: boolean }) {
  const [pending, start] = useTransition();
  const [menu, setMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const toast = useToast();
  const done = Boolean(card.completedAt);

  function toggleMenu() {
    setMenu((m) => !m);
    setConfirmDelete(false);
  }

  function toggle() {
    start(async () => {
      let freedAt: number | null = null;
      try {
        const res = await completeCardAction(card.id, !done);
        freedAt = res.freedPriorityAt;
      } catch {
        toast.show({ tone: "error", message: "No se pudo guardar el cambio. La tarea quedó como estaba." });
        return;
      }
      if (!done) {
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
      } else {
        toast.show({ tone: "info", message: "Tarea reabierta — volvió a Próximo." });
      }
    });
  }

  return (
    <div className="flex items-start gap-2.5 py-2 group">
      <button
        type="button"
        aria-label={done ? `Reabrir «${card.title}»` : `Completar «${card.title}»`}
        disabled={pending}
        onClick={toggle}
        className="mt-0.5 text-sage-deep hover:text-forest transition-colors shrink-0"
      >
        {done ? <CheckCircle2 size={19} aria-hidden /> : <Circle size={19} aria-hidden />}
      </button>
      <div
        className="min-w-0 flex-1 cursor-pointer"
        role="button"
        tabIndex={0}
        aria-label={`Abrir detalle de «${card.title}»`}
        data-testid="task-open"
        onClick={(e) => {
          // los enlaces y botones internos (proyecto, etc.) conservan su función
          if ((e.target as HTMLElement).closest("a, button, input")) return;
          openTaskUrl(card.id);
        }}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
            e.preventDefault();
            openTaskUrl(card.id);
          }
        }}
      >
        <p className={`text-sm leading-snug ${done ? "line-through text-stone-soft" : "text-charcoal"}`}>
          {card.title}
        </p>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {showProject && card.projectTitle && card.projectId && (
            <Link href={`/proyectos/${card.projectId}`} className="chip hover:bg-sand">
              {card.projectTitle}
            </Link>
          )}
          {durationLabel(card.duration) && (
            <span className="chip">
              <Clock size={11} aria-hidden /> {durationLabel(card.duration)}
            </span>
          )}
          {energyLabel(card.energy) && (
            <span className="chip">
              <Zap size={11} aria-hidden /> Energía {energyLabel(card.energy)?.toLowerCase()}
            </span>
          )}
          {card.dueDate && (
            <span className="chip">
              <CalendarClock size={11} aria-hidden /> {card.dueDate}
            </span>
          )}
          {card.blockedReason && (
            <span className="chip chip-blocked">
              <Ban size={11} aria-hidden /> {card.blockedReason}
            </span>
          )}
          {card.waitingFor && (
            <span className="chip chip-waiting">
              <Hourglass size={11} aria-hidden /> Espera: {card.waitingFor}
            </span>
          )}
          {done && card.completedAt && (
            <span className="chip chip-done">✓ {card.completedAt.slice(0, 10)}</span>
          )}
        </div>
      </div>
      {/* Menú de respaldo: siempre hay un camino explícito para abrir la tarea */}
      <div className="relative shrink-0">
        <button
          type="button"
          aria-label={`Menú de «${card.title}»`}
          className="btn btn-ghost !p-1.5 opacity-60 group-hover:opacity-100"
          onClick={toggleMenu}
          data-testid="task-menu"
        >
          <MoreHorizontal size={15} aria-hidden />
        </button>
        {menu && (
          <div className="absolute right-0 z-20 mt-1 card p-1.5 flex flex-col min-w-40 text-sm">
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-beige"
              data-testid="task-menu-open"
              onClick={() => {
                setMenu(false);
                openTaskUrl(card.id);
              }}
            >
              <PencilLine size={14} aria-hidden /> Abrir tarea
            </button>
            {confirmDelete ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5">
                <span className="text-xs text-stone">¿Eliminar?</span>
                <button
                  type="button"
                  disabled={pending}
                  className="btn btn-danger !py-1 !px-2 text-xs"
                  data-testid="task-menu-delete-confirm"
                  onClick={() =>
                    start(async () => {
                      await deleteCardAction(card.id);
                      setMenu(false);
                      toast.show({ tone: "info", message: "Tarea eliminada." });
                    })
                  }
                >
                  Sí, eliminar
                </button>
                <button
                  type="button"
                  className="btn btn-ghost !py-1 !px-2 text-xs"
                  onClick={() => setConfirmDelete(false)}
                >
                  No
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={pending}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-blocked hover:bg-blocked-soft"
                data-testid="task-menu-delete"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 size={14} aria-hidden /> Eliminar tarea
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
