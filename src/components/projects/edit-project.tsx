"use client";

import { useState, useTransition } from "react";
import { Pencil, X, Archive, Trash2 } from "lucide-react";
import {
  updateProjectAction,
  archiveProjectAction,
  deleteProjectAction,
} from "@/lib/actions/projects";
import { PROJECT_ICON_OPTIONS } from "./project-icon";
import type { schema } from "@/lib/db";

type Project = typeof schema.projects.$inferSelect;

export function EditProjectButton({ project }: { project: Project }) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();

  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)} data-testid="edit-project">
        <Pencil size={15} aria-hidden /> Editar
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
            aria-label={`Editar ${project.title}`}
            className="card card-raised w-full md:max-w-xl max-h-[92dvh] overflow-y-auto rounded-b-none md:rounded-b-[18px] p-5 pb-safe"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg text-forest-deep">Editar proyecto</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar" className="btn btn-ghost !p-2">
                <X size={18} aria-hidden />
              </button>
            </div>
            <form
              action={(fd) =>
                start(async () => {
                  await updateProjectAction(fd);
                  setOpen(false);
                })
              }
              className="flex flex-col gap-3"
            >
              <input type="hidden" name="id" value={project.id} />
              <div>
                <label className="label" htmlFor="ep-title">Nombre</label>
                <input id="ep-title" name="title" className="input" defaultValue={project.title} required />
              </div>
              <div>
                <label className="label" htmlFor="ep-objective">Objetivo</label>
                <textarea id="ep-objective" name="objective" className="textarea" rows={2} defaultValue={project.objective ?? ""} />
              </div>
              <div>
                <label className="label" htmlFor="ep-resume">Contexto para retomar</label>
                <textarea id="ep-resume" name="resumeNote" className="textarea" rows={2} defaultValue={project.resumeNote ?? ""} placeholder="Notas en tus palabras para retomar sin reconstruir todo" data-testid="project-resume-note" />
                <p className="text-xs text-stone-soft mt-1">La siguiente acción se gestiona desde la página del proyecto (es una tarea real).</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="label" htmlFor="ep-status">Estado</label>
                  <select id="ep-status" name="status" className="select" defaultValue={project.status}>
                    <option value="activo">Activo</option>
                    <option value="pausado">Pausado</option>
                    <option value="esperando">Esperando</option>
                    <option value="terminado">Terminado</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="ep-health">Salud</label>
                  <select id="ep-health" name="health" className="select" defaultValue={project.health ?? "bien"}>
                    <option value="bien">Bien</option>
                    <option value="atencion">Necesita atención</option>
                    <option value="riesgo">En riesgo</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="ep-area">Área</label>
                  <select id="ep-area" name="area" className="select" defaultValue={project.area ?? "personal"}>
                    <option value="personal">Personal</option>
                    <option value="profesional">Profesional</option>
                    <option value="aprendizaje">Aprendizaje</option>
                    <option value="familia">Familia</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="ep-icon">Ícono</label>
                  <select id="ep-icon" name="icon" className="select" defaultValue={project.icon ?? "folder"}>
                    {PROJECT_ICON_OPTIONS.map((i) => (
                      <option key={i} value={i}>{i}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="ep-start">Inicio</label>
                  <input id="ep-start" name="startDate" type="date" className="input" defaultValue={project.startDate ?? ""} />
                </div>
                <div>
                  <label className="label" htmlFor="ep-target">Fecha objetivo</label>
                  <input id="ep-target" name="targetDate" type="date" className="input" defaultValue={project.targetDate ?? ""} />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="ep-notes">Notas</label>
                <textarea id="ep-notes" name="notes" className="textarea" rows={3} defaultValue={project.notes ?? ""} />
              </div>
              <button type="submit" className="btn btn-primary" disabled={pending} data-testid="project-save">
                {pending ? "Guardando…" : "Guardar"}
              </button>
            </form>

            <div className="mt-4 border-t border-beige pt-3 flex items-center justify-between">
              <button
                type="button"
                className="btn btn-ghost text-xs"
                disabled={pending}
                onClick={() => start(() => archiveProjectAction(project.id, !project.archived))}
              >
                <Archive size={14} aria-hidden /> {project.archived ? "Desarchivar" : "Archivar"}
              </button>
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone">Se borran también sus tarjetas. ¿Segura?</span>
                  <button
                    type="button"
                    className="btn btn-danger !py-1.5 text-xs"
                    disabled={pending}
                    onClick={() => start(() => deleteProjectAction(project.id))}
                  >
                    Sí, eliminar
                  </button>
                  <button type="button" className="btn btn-ghost !py-1.5 text-xs" onClick={() => setConfirmDelete(false)}>
                    No
                  </button>
                </div>
              ) : (
                <button type="button" className="btn btn-danger !py-1.5 text-xs" onClick={() => setConfirmDelete(true)}>
                  <Trash2 size={14} aria-hidden /> Eliminar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
