"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { createProjectAction } from "@/lib/actions/projects";
import { PROJECT_ICON_OPTIONS } from "./project-icon";

export function NewProjectButton({ autoOpen = false }: { autoOpen?: boolean }) {
  const [open, setOpen] = useState(autoOpen);
  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)} data-testid="new-project">
        <Plus size={16} aria-hidden /> Nuevo proyecto
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
            aria-label="Nuevo proyecto"
            className="card card-raised w-full md:max-w-lg max-h-[92dvh] overflow-y-auto rounded-b-none md:rounded-b-[18px] p-5 pb-safe"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg text-forest-deep">Nuevo proyecto</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar" className="btn btn-ghost !p-2">
                <X size={18} aria-hidden />
              </button>
            </div>
            <form action={createProjectAction} className="flex flex-col gap-3">
              <div>
                <label className="label" htmlFor="np-title">Nombre</label>
                <input id="np-title" name="title" className="input" required autoFocus data-testid="new-project-title" />
              </div>
              <div>
                <label className="label" htmlFor="np-objective">Objetivo (¿cómo se ve terminado?)</label>
                <textarea id="np-objective" name="objective" className="textarea" rows={2} />
              </div>
              <div>
                <label className="label" htmlFor="np-next">Siguiente acción (opcional — se crea como tarea real)</label>
                <input id="np-next" name="nextActionTitle" className="input" placeholder="El primer paso físico y visible" data-testid="new-project-next" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="np-area">Área</label>
                  <select id="np-area" name="area" className="select">
                    <option value="personal">Personal</option>
                    <option value="profesional">Profesional</option>
                    <option value="aprendizaje">Aprendizaje</option>
                    <option value="familia">Familia / colaboración</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="np-status">Estado</label>
                  <select id="np-status" name="status" className="select" defaultValue="activo">
                    <option value="activo">Activo</option>
                    <option value="pausado">Pausado</option>
                    <option value="esperando">Esperando</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="np-date">Fecha objetivo</label>
                  <input id="np-date" name="targetDate" type="date" className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="np-icon">Ícono</label>
                  <select id="np-icon" name="icon" className="select">
                    {PROJECT_ICON_OPTIONS.map((i) => (
                      <option key={i} value={i}>{i}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="label" htmlFor="np-resume">Contexto para retomar (opcional)</label>
                <textarea id="np-resume" name="resumeNote" className="textarea" rows={2} placeholder="Notas en tus palabras para tu yo del futuro" />
              </div>
              <button type="submit" className="btn btn-primary" data-testid="new-project-save">
                Crear proyecto
              </button>
              <p className="text-xs text-stone-soft">
                Se creará con su tablero: Backlog · Próximo · En proceso · Esperando · Bloqueado · Después · Terminado.
              </p>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
