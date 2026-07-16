"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { createEventAction } from "@/lib/actions/events";

export function NewEventButton({
  projects,
  autoOpen = false,
}: {
  projects: { id: string; title: string }[];
  autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(autoOpen);
  const [pending, start] = useTransition();

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)} data-testid="new-event">
        <Plus size={16} aria-hidden /> Nuevo evento
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 overlay-screen flex items-end md:items-center justify-center p-0 md:p-6"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Nuevo evento"
            className="card card-raised w-full md:max-w-lg max-h-[92dvh] overflow-y-auto rounded-b-none md:rounded-b-[18px] p-5 pb-safe"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg text-forest-deep">Nuevo evento</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar" className="btn btn-ghost !p-2">
                <X size={18} aria-hidden />
              </button>
            </div>
            <form
              action={(fd) =>
                start(async () => {
                  await createEventAction(fd);
                  setOpen(false);
                })
              }
              className="flex flex-col gap-3"
            >
              <div>
                <label className="label" htmlFor="ne-title">Título</label>
                <input id="ne-title" name="title" className="input" required autoFocus data-testid="event-title" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label" htmlFor="ne-date">Fecha</label>
                  <input id="ne-date" name="date" type="date" className="input" required data-testid="event-date" />
                </div>
                <div>
                  <label className="label" htmlFor="ne-start">Empieza</label>
                  <input id="ne-start" name="startTime" type="time" className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="ne-end">Termina</label>
                  <input id="ne-end" name="endTime" type="time" className="input" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="ne-type">Tipo</label>
                  <select id="ne-type" name="type" className="select">
                    <option value="reunion">Reunión</option>
                    <option value="evento">Evento</option>
                    <option value="deadline">Deadline</option>
                    <option value="recordatorio">Recordatorio</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="ne-project">Proyecto</label>
                  <select id="ne-project" name="projectId" className="select">
                    <option value="">Sin proyecto</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="label" htmlFor="ne-notes">Notas</label>
                <textarea id="ne-notes" name="notes" className="textarea" rows={2} />
              </div>
              <button type="submit" className="btn btn-primary" disabled={pending} data-testid="event-save">
                {pending ? "Guardando…" : "Guardar evento"}
              </button>
              <p className="text-xs text-stone-soft">
                Si Google Calendar está conectado, este evento también aparecerá en el calendario «Mafer OS» y sonará
                en tu teléfono.
              </p>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
