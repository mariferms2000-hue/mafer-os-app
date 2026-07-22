"use client";

import { useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { X, Trash2 } from "lucide-react";
import {
  getEventDetailAction,
  updateEventAction,
  deleteEventAction,
  type EventDetailData,
} from "@/lib/actions/events";
import { useToast } from "@/components/ui/toast";

/** Detalle editable de evento, abrible desde cualquier vista del calendario.
 *  Mismo patrón que el detalle de tarea: carga sus datos frescos al abrirse. */
export function EventDetailModal({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  const [data, setData] = useState<EventDetailData | null>(null);
  const toast = useToast();

  useEffect(() => {
    let alive = true;
    getEventDetailAction(eventId).then((d) => {
      if (!alive) return;
      if (!d) {
        toast.show({ tone: "info", message: "Ese evento ya no existe." });
        onClose();
        return;
      }
      setData(d);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  if (!data) {
    return (
      <div className="fixed inset-0 z-[55] overlay-screen flex items-end md:items-center justify-center p-0 md:p-6" role="presentation">
        <div role="dialog" aria-modal="true" aria-label="Cargando evento" className="card card-raised w-full md:max-w-lg p-6 rounded-b-none md:rounded-b-[18px]" data-testid="event-detail">
          <p className="text-sm text-stone">Abriendo evento…</p>
        </div>
      </div>
    );
  }
  return <EventDetailEditor data={data} onClose={onClose} />;
}

/** Abre el detalle reflejándolo en la URL (?evento=<id>) sin recargar la página. */
export function openEventUrl(eventId: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("evento", eventId);
  window.history.pushState(null, "", url.toString());
}

function closeEventUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete("evento");
  window.history.replaceState(null, "", url.toString());
}

/** Se monta una vez en el layout: si la URL trae ?evento=<id>, muestra el detalle. */
export function EventDetailFromUrl() {
  const searchParams = useSearchParams();
  const evento = searchParams.get("evento");
  if (!evento) return null;
  return <EventDetailModal key={evento} eventId={evento} onClose={closeEventUrl} />;
}

function EventDetailEditor({ data, onClose }: { data: EventDetailData; onClose: () => void }) {
  const { event, projects } = data;
  const [pending, start] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const toast = useToast();

  function submit(fd: FormData) {
    start(async () => {
      try {
        await updateEventAction(fd);
        toast.show({ message: "Evento actualizado ✓" });
        onClose();
      } catch {
        toast.show({ tone: "warn", message: "No se pudieron guardar los cambios. Inténtalo de nuevo." });
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-[55] overlay-screen flex items-end md:items-center justify-center p-0 md:p-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Detalle de «${event.title}»`}
        className="card card-raised w-full md:max-w-lg max-h-[92dvh] overflow-y-auto rounded-b-none md:rounded-b-[18px] p-5 pb-safe"
        data-testid="event-detail"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg text-forest-deep">Detalle del evento</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="btn btn-ghost !p-2" data-testid="event-close">
            <X size={18} aria-hidden />
          </button>
        </div>

        <form action={submit} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={event.id} />
          <div>
            <label className="label" htmlFor="ed-title">Título</label>
            <input id="ed-title" name="title" className="input" required defaultValue={event.title} data-testid="event-title-input" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label" htmlFor="ed-date">Fecha</label>
              <input id="ed-date" name="date" type="date" className="input" required defaultValue={event.date} data-testid="event-date-input" />
            </div>
            <div>
              <label className="label" htmlFor="ed-start">Empieza</label>
              <input id="ed-start" name="startTime" type="time" className="input" defaultValue={event.startTime ?? ""} />
            </div>
            <div>
              <label className="label" htmlFor="ed-end">Termina</label>
              <input id="ed-end" name="endTime" type="time" className="input" defaultValue={event.endTime ?? ""} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="ed-type">Tipo</label>
              <select id="ed-type" name="type" className="select" defaultValue={event.type ?? "evento"}>
                <option value="reunion">Reunión</option>
                <option value="evento">Evento</option>
                <option value="deadline">Deadline</option>
                <option value="recordatorio">Recordatorio</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="ed-project">Proyecto</label>
              <select id="ed-project" name="projectId" className="select" defaultValue={event.projectId ?? ""}>
                <option value="">Sin proyecto</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="ed-notes">Notas</label>
            <textarea id="ed-notes" name="notes" className="textarea" rows={3} defaultValue={event.notes ?? ""} data-testid="event-notes-input" />
          </div>

          <div className="flex gap-2 border-t border-beige pt-4">
            <button type="submit" className="btn btn-primary flex-1 md:flex-none md:min-w-44" disabled={pending} data-testid="event-save">
              {pending ? "Guardando…" : "Guardar cambios"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose} data-testid="event-cancel">
              Cancelar
            </button>
          </div>
        </form>

        <div className="mt-4 border-t border-beige pt-3 flex items-center justify-end">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-stone">¿Segura?</span>
              <button
                type="button"
                className="btn btn-danger !py-1.5 text-xs"
                disabled={pending}
                data-testid="event-delete-confirm"
                onClick={() =>
                  start(async () => {
                    await deleteEventAction(event.id);
                    toast.show({ tone: "info", message: "Evento eliminado." });
                    onClose();
                  })
                }
              >
                Sí, eliminar
              </button>
              <button type="button" className="btn btn-ghost !py-1.5 text-xs" onClick={() => setConfirmDelete(false)}>
                No
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn-danger !py-1.5 text-xs" onClick={() => setConfirmDelete(true)} data-testid="event-delete">
              <Trash2 size={14} aria-hidden /> Eliminar evento
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
