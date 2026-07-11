"use client";

import { useRef, useState, useTransition } from "react";
import { Plus, X, Check } from "lucide-react";
import { captureAction } from "@/lib/actions/inbox";

const TYPES = [
  { value: "", label: "Sin clasificar" },
  { value: "tarea", label: "Tarea" },
  { value: "idea", label: "Idea" },
  { value: "proyecto", label: "Proyecto" },
  { value: "aprendizaje", label: "Aprendizaje" },
  { value: "journal", label: "Journal" },
  { value: "decision", label: "Decisión" },
  { value: "recurso", label: "Recurso" },
];

export function CaptureFab({ projects }: { projects: { id: string; title: string }[] }) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [more, setMore] = useState(false);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function submit(formData: FormData) {
    startTransition(async () => {
      await captureAction(formData);
      formRef.current?.reset();
      setMore(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Capturar algo"
        className="fixed z-50 bottom-20 right-4 md:bottom-8 md:right-8 h-14 w-14 rounded-full bg-forest text-cream shadow-lift flex items-center justify-center hover:bg-forest-deep transition-colors"
        data-testid="capture-fab"
      >
        <Plus size={26} aria-hidden />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-charcoal/30 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Capturar en el Inbox"
            className="card w-full md:max-w-lg rounded-b-none md:rounded-b-[18px] p-5 pb-safe"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg text-forest-deep">Capturar</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="btn btn-ghost !p-2"
              >
                <X size={18} aria-hidden />
              </button>
            </div>
            <form ref={formRef} action={submit} className="flex flex-col gap-3">
              <textarea
                name="content"
                className="textarea"
                placeholder="Escribe lo que tengas en mente… se guarda en tu Inbox."
                required
                autoFocus
                rows={3}
                data-testid="capture-input"
              />
              {more && (
                <>
                  <textarea name="note" className="textarea" rows={2} placeholder="Nota adicional (opcional)" />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label" htmlFor="cap-type">Tipo</label>
                      <select id="cap-type" name="typeHint" className="select">
                        {TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label" htmlFor="cap-date">Fecha</label>
                      <input id="cap-date" name="date" type="date" className="input" />
                    </div>
                  </div>
                  <div>
                    <label className="label" htmlFor="cap-project">Proyecto</label>
                    <select id="cap-project" name="projectId" className="select">
                      <option value="">Sin proyecto</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              <div className="flex items-center gap-2">
                <button type="submit" className="btn btn-primary flex-1" disabled={pending} data-testid="capture-save">
                  {pending ? "Guardando…" : saved ? "Guardado ✓" : "Guardar en Inbox"}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setMore((m) => !m)}>
                  {more ? "Menos" : "Detalles"}
                </button>
              </div>
              {saved && (
                <p className="text-sm text-done flex items-center gap-1.5" role="status">
                  <Check size={15} aria-hidden /> Capturado. Puedes seguir escribiendo o cerrar.
                </p>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  );
}
