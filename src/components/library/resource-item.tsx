"use client";

import { useTransition } from "react";
import { Star, Trash2, ExternalLink } from "lucide-react";
import {
  updateResourceStatusAction,
  toggleResourceFavoriteAction,
  deleteResourceAction,
} from "@/lib/actions/library";
import type { schema } from "@/lib/db";

type Resource = typeof schema.resources.$inferSelect;

export function ResourceItem({ resource, projectTitle }: { resource: Resource; projectTitle?: string }) {
  const [pending, start] = useTransition();

  return (
    <li className="card p-3.5 flex flex-wrap items-center gap-2.5" data-testid="resource-item">
      <div className="min-w-0 flex-1">
        {resource.url ? (
          <a href={resource.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-forest hover:underline underline-offset-4 inline-flex items-center gap-1">
            {resource.title} <ExternalLink size={12} aria-hidden />
          </a>
        ) : (
          <p className="text-sm font-medium">{resource.title}</p>
        )}
        {resource.notes && <p className="text-xs text-stone mt-0.5">{resource.notes}</p>}
        <div className="flex flex-wrap gap-1.5 mt-1">
          <span className="chip capitalize">{resource.type}</span>
          {resource.topic && <span className="chip">#{resource.topic}</span>}
          {projectTitle && <span className="chip chip-sage">{projectTitle}</span>}
          {resource.isStarter && <span className="chip">Ejemplo</span>}
          {!resource.projectId && !resource.learningId && (
            <span className="chip !border-dashed" title="Edita el recurso para vincularlo a un proyecto o tema de aprendizaje">
              Sin vincular aún
            </span>
          )}
        </div>
      </div>
      <label className="sr-only" htmlFor={`status-${resource.id}`}>Estado</label>
      <select
        id={`status-${resource.id}`}
        className="select !w-auto !min-h-8 text-xs"
        defaultValue={resource.status ?? "pendiente"}
        onChange={(e) => start(() => updateResourceStatusAction(resource.id, e.target.value))}
        disabled={pending}
      >
        <option value="pendiente">Pendiente</option>
        <option value="en-proceso">En proceso</option>
        <option value="revisado">Revisado</option>
        <option value="archivado">Archivado</option>
      </select>
      <button
        type="button"
        aria-label={resource.favorite ? "Quitar de favoritos" : "Marcar favorito"}
        className="btn btn-ghost !p-2"
        disabled={pending}
        onClick={() => start(() => toggleResourceFavoriteAction(resource.id))}
      >
        <Star size={15} className={resource.favorite ? "text-waiting fill-current" : ""} aria-hidden />
      </button>
      <button
        type="button"
        aria-label={`Eliminar «${resource.title}»`}
        className="btn btn-ghost !p-2"
        disabled={pending}
        onClick={() => start(() => deleteResourceAction(resource.id))}
      >
        <Trash2 size={15} aria-hidden />
      </button>
    </li>
  );
}
