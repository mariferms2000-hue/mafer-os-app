"use client";

import { useRef, useState, useTransition } from "react";
import { Plus, X, ChevronDown, ChevronUp, Inbox } from "lucide-react";
import { captureAction, deleteInboxItem } from "@/lib/actions/inbox";
import { useToast } from "@/components/ui/toast";

/** Barra de captura rápida: escribe → Enter (o botón) → guardado. Sin decidir nada más. */
export function QuickCaptureBar() {
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = useRef(false); // evita duplicados por doble Enter mientras guarda
  const toast = useToast();

  function submit(fd: FormData) {
    const content = String(fd.get("content") ?? "").trim();
    if (!content) return; // nunca guardar capturas vacías
    if (busy.current) return;
    busy.current = true;
    start(async () => {
      try {
        const result = await captureAction(fd);
        if (inputRef.current) {
          inputRef.current.value = "";
          inputRef.current.focus();
        }
        toast.show({
          message: "Guardado en Inbox",
          action: result ? { label: "Deshacer", onClick: () => undoCapture(result.id) } : undefined,
          duration: 6000,
        });
      } catch {
        // el texto sigue en el campo: nada se pierde
        toast.show({ tone: "warn", message: "No se pudo guardar la captura. Inténtalo de nuevo." });
      } finally {
        busy.current = false;
      }
    });
  }

  async function undoCapture(id: string) {
    try {
      await deleteInboxItem(id);
    } catch {
      toast.show({ tone: "warn", message: "No se pudo deshacer. La captura sigue en el Inbox." });
    }
  }

  return (
    <form action={submit} className="card p-2 mb-5 flex items-center gap-2" data-testid="quick-capture-bar">
      <span className="text-sage-deep pl-2 shrink-0" aria-hidden>
        <Inbox size={17} />
      </span>
      <label className="sr-only" htmlFor="quickbar-input">Captura rápida</label>
      <input
        id="quickbar-input"
        ref={inputRef}
        name="content"
        className="input !border-0 !bg-transparent !min-h-10 flex-1 !px-1 focus:!outline-none"
        placeholder="Escribe una tarea, idea, pendiente o cualquier cosa…"
        autoComplete="off"
        required
        data-testid="quickbar-input"
      />
      <button type="submit" className="btn btn-primary !py-2 !px-4 text-sm shrink-0" disabled={pending} data-testid="quickbar-save">
        {pending ? "Guardando…" : "Capturar"}
      </button>
    </form>
  );
}

/** Botón «+ Nueva captura» del encabezado → panel lateral (desktop) / bottom sheet (móvil). */
export function NewCaptureButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)} data-testid="new-capture">
        <Plus size={16} aria-hidden /> Nueva captura
      </button>
      {open && <NewCapturePanel onClose={() => setOpen(false)} />}
    </>
  );
}

export function NewCapturePanel({ onClose }: { onClose: () => void }) {
  const [more, setMore] = useState(false);
  const [pending, start] = useTransition();
  const busy = useRef(false);
  const toast = useToast();

  return (
    <div
      className="fixed inset-0 z-50 bg-charcoal/30 backdrop-blur-sm flex items-end md:items-stretch md:justify-end"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Nueva captura"
        className="card w-full md:w-[420px] md:h-full max-h-[92dvh] md:max-h-none overflow-y-auto rounded-b-none md:rounded-none md:rounded-l-[20px] p-5 pb-safe"
        data-testid="new-capture-panel"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg text-forest-deep">Nueva captura</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="btn btn-ghost !p-2">
            <X size={18} aria-hidden />
          </button>
        </div>
        <form
          action={(fd) => {
            const content = String(fd.get("content") ?? "").trim();
            if (!content) return;
            if (busy.current) return;
            busy.current = true;
            start(async () => {
              try {
                const result = await captureAction(fd);
                toast.show({
                  message: "Guardado en Inbox",
                  action: result
                    ? {
                        label: "Deshacer",
                        onClick: async () => {
                          try {
                            await deleteInboxItem(result.id);
                          } catch {
                            toast.show({ tone: "warn", message: "No se pudo deshacer. La captura sigue en el Inbox." });
                          }
                        },
                      }
                    : undefined,
                  duration: 6000,
                });
                onClose();
              } catch {
                // el panel queda abierto con el texto intacto
                toast.show({ tone: "warn", message: "No se pudo guardar la captura. Inténtalo de nuevo." });
              } finally {
                busy.current = false;
              }
            });
          }}
          className="flex flex-col gap-4"
        >
          <div>
            <label className="label" htmlFor="nc-content">¿Qué tienes en mente?</label>
            <textarea
              id="nc-content"
              name="content"
              className="textarea"
              rows={3}
              required
              autoFocus
              placeholder="Escribe una tarea, idea, pendiente o cualquier cosa…"
              data-testid="new-capture-content"
            />
          </div>
          <div>
            <label className="label" htmlFor="nc-note">Nota (opcional)</label>
            <textarea id="nc-note" name="note" className="textarea" rows={2} placeholder="Contexto extra, un enlace, un detalle…" />
          </div>

          <button
            type="button"
            className="text-sm text-forest flex items-center gap-1 self-start hover:underline underline-offset-4"
            onClick={() => setMore((m) => !m)}
            aria-expanded={more}
          >
            {more ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
            {more ? "Menos opciones" : "Más opciones"}
          </button>
          {more && (
            <div className="border-t border-beige pt-3">
              <label className="label" htmlFor="nc-date">Fecha (opcional)</label>
              <input id="nc-date" name="date" type="date" className="input" />
            </div>
          )}

          <p className="text-xs text-stone-soft">
            Sin clasificar está perfecto: el tipo, proyecto y demás se deciden después con «Procesar».
          </p>

          <div className="flex gap-2 border-t border-beige pt-4">
            <button type="submit" className="btn btn-primary flex-1" disabled={pending} data-testid="new-capture-save">
              {pending ? "Guardando…" : "Guardar en Inbox"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
