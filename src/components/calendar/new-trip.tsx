"use client";

import { useState, useTransition } from "react";
import { Plane, X } from "lucide-react";
import { createTripAction } from "@/lib/actions/trips";

export function NewTripButton() {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [rangeError, setRangeError] = useState(false);

  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)} data-testid="new-trip">
        <Plane size={16} aria-hidden /> Nuevo viaje
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
            aria-label="Nuevo viaje"
            className="card card-raised w-full md:max-w-lg max-h-[92dvh] overflow-y-auto rounded-b-none md:rounded-b-[18px] p-5 pb-safe"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg text-forest-deep flex items-center gap-2">
                <Plane size={18} aria-hidden /> Nuevo viaje
              </h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar" className="btn btn-ghost !p-2">
                <X size={18} aria-hidden />
              </button>
            </div>
            <form
              action={(fd) => {
                const startDate = String(fd.get("startDate") ?? "");
                const endDate = String(fd.get("endDate") ?? "");
                if (endDate < startDate) {
                  setRangeError(true);
                  return;
                }
                setRangeError(false);
                start(async () => {
                  await createTripAction(fd);
                  setOpen(false);
                });
              }}
              className="flex flex-col gap-3"
            >
              <div>
                <label className="label" htmlFor="nt-title">Título</label>
                <input id="nt-title" name="title" className="input" required autoFocus data-testid="trip-title" />
              </div>
              <div>
                <label className="label" htmlFor="nt-destination">Destino (opcional)</label>
                <input id="nt-destination" name="destination" className="input" data-testid="trip-destination" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="nt-start">Fecha de inicio</label>
                  <input id="nt-start" name="startDate" type="date" className="input" required data-testid="trip-start" />
                </div>
                <div>
                  <label className="label" htmlFor="nt-end">Fecha de fin</label>
                  <input id="nt-end" name="endDate" type="date" className="input" required data-testid="trip-end" />
                </div>
              </div>
              {rangeError && (
                <p className="text-xs text-blocked" data-testid="trip-range-error">
                  La fecha de fin no puede ser anterior a la de inicio.
                </p>
              )}
              <div>
                <label className="label" htmlFor="nt-notes">Notas (opcional)</label>
                <textarea id="nt-notes" name="notes" className="textarea" rows={2} />
              </div>
              <button type="submit" className="btn btn-primary" disabled={pending} data-testid="trip-save">
                {pending ? "Guardando…" : "Guardar viaje"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
