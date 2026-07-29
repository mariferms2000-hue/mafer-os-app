"use client";

import { useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { X, Trash2, Plane } from "lucide-react";
import { getTripDetailAction, updateTripAction, deleteTripAction, type Trip } from "@/lib/actions/trips";
import { useToast } from "@/components/ui/toast";

/** Detalle editable de viaje, abrible desde cualquier vista del calendario.
 *  Mismo patrón que el detalle de evento: carga sus datos frescos al abrirse. */
export function TripDetailModal({ tripId, onClose }: { tripId: string; onClose: () => void }) {
  const [data, setData] = useState<Trip | null>(null);
  const toast = useToast();

  useEffect(() => {
    let alive = true;
    getTripDetailAction(tripId).then((d) => {
      if (!alive) return;
      if (!d) {
        toast.show({ tone: "info", message: "Ese viaje ya no existe." });
        onClose();
        return;
      }
      setData(d);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  if (!data) {
    return (
      <div className="fixed inset-0 z-[55] overlay-screen flex items-end md:items-center justify-center p-0 md:p-6" role="presentation">
        <div role="dialog" aria-modal="true" aria-label="Cargando viaje" className="card card-raised w-full md:max-w-lg p-6 rounded-b-none md:rounded-b-[18px]" data-testid="trip-detail">
          <p className="text-sm text-stone">Abriendo viaje…</p>
        </div>
      </div>
    );
  }
  return <TripDetailEditor trip={data} onClose={onClose} />;
}

/** Abre el detalle reflejándolo en la URL (?viaje=<id>) sin recargar la página. */
export function openTripUrl(tripId: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("viaje", tripId);
  window.history.pushState(null, "", url.toString());
}

function closeTripUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete("viaje");
  window.history.replaceState(null, "", url.toString());
}

/** Se monta una vez en el layout: si la URL trae ?viaje=<id>, muestra el detalle. */
export function TripDetailFromUrl() {
  const searchParams = useSearchParams();
  const viaje = searchParams.get("viaje");
  if (!viaje) return null;
  return <TripDetailModal key={viaje} tripId={viaje} onClose={closeTripUrl} />;
}

function TripDetailEditor({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  const [pending, start] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [rangeError, setRangeError] = useState(false);
  const toast = useToast();

  function submit(fd: FormData) {
    const startDate = String(fd.get("startDate") ?? "");
    const endDate = String(fd.get("endDate") ?? "");
    if (endDate < startDate) {
      setRangeError(true);
      return;
    }
    setRangeError(false);
    start(async () => {
      try {
        await updateTripAction(fd);
        toast.show({ message: "Viaje actualizado ✓" });
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
        aria-label={`Detalle de «${trip.title}»`}
        className="card card-raised w-full md:max-w-lg max-h-[92dvh] overflow-y-auto rounded-b-none md:rounded-b-[18px] p-5 pb-safe"
        data-testid="trip-detail"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg text-forest-deep flex items-center gap-2">
            <Plane size={18} aria-hidden /> Detalle del viaje
          </h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="btn btn-ghost !p-2" data-testid="trip-close">
            <X size={18} aria-hidden />
          </button>
        </div>

        <form action={submit} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={trip.id} />
          <div>
            <label className="label" htmlFor="td-title">Título</label>
            <input id="td-title" name="title" className="input" required defaultValue={trip.title} data-testid="trip-title-input" />
          </div>
          <div>
            <label className="label" htmlFor="td-destination">Destino (opcional)</label>
            <input id="td-destination" name="destination" className="input" defaultValue={trip.destination ?? ""} data-testid="trip-destination-input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="td-start">Fecha de inicio</label>
              <input id="td-start" name="startDate" type="date" className="input" required defaultValue={trip.startDate} data-testid="trip-start-input" />
            </div>
            <div>
              <label className="label" htmlFor="td-end">Fecha de fin</label>
              <input id="td-end" name="endDate" type="date" className="input" required defaultValue={trip.endDate} data-testid="trip-end-input" />
            </div>
          </div>
          {rangeError && (
            <p className="text-xs text-blocked" data-testid="trip-range-error">
              La fecha de fin no puede ser anterior a la de inicio.
            </p>
          )}
          <div>
            <label className="label" htmlFor="td-notes">Notas (opcional)</label>
            <textarea id="td-notes" name="notes" className="textarea" rows={3} defaultValue={trip.notes ?? ""} data-testid="trip-notes-input" />
          </div>

          <div className="flex gap-2 border-t border-beige pt-4">
            <button type="submit" className="btn btn-primary flex-1 md:flex-none md:min-w-44" disabled={pending} data-testid="trip-save">
              {pending ? "Guardando…" : "Guardar cambios"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose} data-testid="trip-cancel">
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
                data-testid="trip-delete-confirm"
                onClick={() =>
                  start(async () => {
                    await deleteTripAction(trip.id);
                    toast.show({ tone: "info", message: "Viaje eliminado." });
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
            <button type="button" className="btn btn-danger !py-1.5 text-xs" onClick={() => setConfirmDelete(true)} data-testid="trip-delete">
              <Trash2 size={14} aria-hidden /> Eliminar viaje
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
