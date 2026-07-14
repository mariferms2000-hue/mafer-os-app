"use client";

import { useState, useTransition } from "react";
import { ArrowRight, X, Plus, PencilLine, Unlink, RefreshCcw } from "lucide-react";
import { setProjectNextActionAction, createNextActionTaskAction } from "@/lib/actions/projects";
import { openTaskUrl } from "@/components/tasks/task-detail";
import { MarkPriorityButton } from "@/components/tasks/priority-button";
import { useToast } from "@/components/ui/toast";

export type NextActionInfo = {
  card: { id: string; title: string; completedAt: string | null } | null;
  legacyText: string; // texto heredado (solo si no hay tarjeta)
};

type OpenTask = { id: string; title: string };

/** Bloque «Siguiente acción» del proyecto: SIEMPRE una tarea real cuando sea
 *  posible. Elegir una existente, crear una nueva, cambiarla, quitarla,
 *  abrirla o marcarla como prioridad. Nada se elige automáticamente. */
export function NextActionBlock({
  projectId,
  info,
  openTasks,
}: {
  projectId: string;
  info: NextActionInfo;
  openTasks: OpenTask[];
}) {
  const [picker, setPicker] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();

  const card = info.card;
  const done = Boolean(card?.completedAt);

  function unlink() {
    start(async () => {
      await setProjectNextActionAction(projectId, null);
      toast.show({ tone: "info", message: "Siguiente acción quitada. El proyecto quedó sin siguiente paso." });
    });
  }

  return (
    <section className="card p-4 mb-4 !border-sage-deep" aria-label="Siguiente acción" data-testid="next-action-block">
      <div className="flex flex-wrap items-center gap-2">
        <p className="label !mb-0 flex items-center gap-1.5">
          <ArrowRight size={14} className="text-olive" aria-hidden /> Siguiente acción
        </p>

        {card && !done ? (
          <>
            <button
              type="button"
              className="text-sm font-medium text-ink-green hover:text-forest text-left underline-offset-4 hover:underline"
              onClick={() => openTaskUrl(card.id)}
              data-testid="next-action-title"
            >
              {card.title}
            </button>
            <span className="flex flex-wrap gap-1.5 ml-auto">
              <button type="button" className="btn btn-ghost !py-1 !px-2 text-xs" onClick={() => openTaskUrl(card.id)} data-testid="next-action-open">
                <PencilLine size={13} aria-hidden /> Abrir
              </button>
              <MarkPriorityButton cardId={card.id} className="btn btn-ghost !py-1 !px-2 text-xs" />
              <button type="button" className="btn btn-ghost !py-1 !px-2 text-xs" onClick={() => setPicker(true)} data-testid="next-action-change">
                <RefreshCcw size={13} aria-hidden /> Cambiar
              </button>
              <button type="button" className="btn btn-ghost !py-1 !px-2 text-xs" disabled={pending} onClick={unlink} data-testid="next-action-remove">
                <Unlink size={13} aria-hidden /> Quitar
              </button>
            </span>
          </>
        ) : done ? (
          <>
            <p className="text-sm text-stone" data-testid="next-action-completed">
              «{card!.title}» se completó ✓ — este proyecto necesita nueva siguiente acción.
            </p>
            <button type="button" className="btn btn-primary !py-1.5 !px-3 text-xs ml-auto" onClick={() => setPicker(true)} data-testid="define-next-action">
              Elegir siguiente acción
            </button>
          </>
        ) : info.legacyText ? (
          <>
            <p className="text-sm text-ink-green font-medium">{info.legacyText}</p>
            <span className="text-xs text-stone-soft">(texto suelto)</span>
            <button type="button" className="btn btn-secondary !py-1.5 !px-3 text-xs ml-auto" onClick={() => setPicker(true)} data-testid="define-next-action">
              Vincular a una tarea real
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-stone" data-testid="next-action-missing">Falta definir la siguiente acción.</p>
            <button type="button" className="btn btn-primary !py-1.5 !px-3 text-xs ml-auto" onClick={() => setPicker(true)} data-testid="define-next-action">
              Definir siguiente acción
            </button>
          </>
        )}
      </div>

      {picker && (
        <NextActionPicker
          projectId={projectId}
          openTasks={openTasks.filter((t) => t.id !== card?.id)}
          onClose={() => setPicker(false)}
        />
      )}
    </section>
  );
}

/** Selector: una tarea abierta existente, o crear una nueva y vincularla. */
export function NextActionPicker({
  projectId,
  openTasks,
  onClose,
}: {
  projectId: string;
  openTasks: OpenTask[];
  onClose: () => void;
}) {
  const [nueva, setNueva] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();

  function elegir(t: OpenTask) {
    start(async () => {
      try {
        await setProjectNextActionAction(projectId, t.id);
        toast.show({ message: `Siguiente acción: «${t.title}» ✓` });
      } catch {
        toast.show({ tone: "error", message: "No se pudo guardar la siguiente acción." });
      }
      onClose();
    });
  }

  function crear() {
    const title = nueva.trim();
    if (!title) return;
    start(async () => {
      try {
        const res = await createNextActionTaskAction(projectId, title);
        if (res) toast.show({ message: `Siguiente acción creada: «${title}» ✓` });
      } catch {
        toast.show({ tone: "error", message: "No se pudo crear la tarea." });
      }
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-[60] bg-charcoal/40 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Elegir siguiente acción"
        className="card w-full md:max-w-md max-h-[92dvh] overflow-y-auto rounded-b-none md:rounded-b-[18px] p-5 pb-safe"
        data-testid="next-action-picker"
      >
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base text-forest-deep font-medium">Elegir siguiente acción</h3>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="btn btn-ghost !p-1.5">
            <X size={16} aria-hidden />
          </button>
        </div>
        <p className="text-sm text-stone mb-3">El primer paso físico y visible para avanzar este proyecto.</p>

        {openTasks.length > 0 && (
          <>
            <p className="label">Elegir una tarea existente</p>
            <ul className="flex flex-col gap-1.5 mb-4 max-h-56 overflow-y-auto">
              {openTasks.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className="w-full text-left text-sm rounded-xl border border-sand px-3 py-2 hover:bg-sage-soft transition-colors"
                    disabled={pending}
                    onClick={() => elegir(t)}
                    data-testid={`pick-next-${t.id}`}
                  >
                    {t.title}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <p className="label">{openTasks.length ? "O crear una nueva" : "Crear la tarea"}</p>
        <div className="flex gap-2">
          <input
            className="input !min-h-9 text-sm flex-1"
            placeholder="¿Cuál es el siguiente paso?"
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                crear();
              }
            }}
            data-testid="next-action-new-input"
          />
          <button type="button" className="btn btn-primary !min-h-9 text-sm" disabled={pending || !nueva.trim()} onClick={crear} data-testid="next-action-create">
            <Plus size={14} aria-hidden /> Crear
          </button>
        </div>
      </div>
    </div>
  );
}
