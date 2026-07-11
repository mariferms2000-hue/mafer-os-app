"use client";

import { useState, useTransition } from "react";
import { MoreHorizontal, Rocket, SquareKanban, Moon, Archive, XCircle, Trash2 } from "lucide-react";
import {
  graduateIdeaAction,
  updateIdeaStatusAction,
  deleteIdeaAction,
} from "@/lib/actions/explore";
import type { schema } from "@/lib/db";

type Idea = typeof schema.ideas.$inferSelect;

const CATEGORY_LABEL: Record<string, string> = {
  proyecto: "Posible proyecto",
  estudio: "Estudios / formación",
  negocio: "Idea de negocio",
  experimento: "Experimento personal",
  general: "Por explorar",
};

export function IdeaCard({ idea }: { idea: Idea }) {
  const [menu, setMenu] = useState(false);
  const [pending, start] = useTransition();

  return (
    <li className="card p-4 flex flex-col gap-2" data-testid="idea-card">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium">{idea.title}</p>
        <div className="relative shrink-0">
          <button
            type="button"
            aria-label={`Opciones para «${idea.title}»`}
            className="btn btn-ghost !p-1.5"
            onClick={() => setMenu((m) => !m)}
          >
            <MoreHorizontal size={16} aria-hidden />
          </button>
          {menu && (
            <div className="absolute right-0 z-20 mt-1 card p-1.5 flex flex-col min-w-52 text-sm">
              <button type="button" disabled={pending} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-sage-soft"
                onClick={() => start(() => graduateIdeaAction(idea.id, "proyecto"))}>
                <SquareKanban size={14} aria-hidden /> Convertir en proyecto
              </button>
              <button type="button" disabled={pending} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-sage-soft"
                onClick={() => start(() => graduateIdeaAction(idea.id, "learnfast"))}>
                <Rocket size={14} aria-hidden /> Convertir en Learn Fast
              </button>
              <button type="button" disabled={pending} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-beige"
                onClick={() => start(async () => { await updateIdeaStatusAction(idea.id, "algun-dia"); setMenu(false); })}>
                <Moon size={14} aria-hidden /> Algún día
              </button>
              <button type="button" disabled={pending} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-beige"
                onClick={() => start(async () => { await updateIdeaStatusAction(idea.id, "archivada"); setMenu(false); })}>
                <Archive size={14} aria-hidden /> Archivar
              </button>
              <button type="button" disabled={pending} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-beige"
                onClick={() => start(async () => { await updateIdeaStatusAction(idea.id, "rechazada"); setMenu(false); })}>
                <XCircle size={14} aria-hidden /> No va (rechazar)
              </button>
              <button type="button" disabled={pending} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-blocked hover:bg-blocked-soft"
                onClick={() => start(() => deleteIdeaAction(idea.id))}>
                <Trash2 size={14} aria-hidden /> Eliminar
              </button>
            </div>
          )}
        </div>
      </div>
      {idea.description && <p className="text-sm text-stone line-clamp-3">{idea.description}</p>}
      <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
        <span className="chip">{CATEGORY_LABEL[idea.category ?? "general"] ?? idea.category}</span>
        {idea.status === "algun-dia" && <span className="chip chip-waiting">Algún día</span>}
        {idea.status === "graduada" && <span className="chip chip-done">Graduada</span>}
        {idea.isStarter && <span className="chip">Ejemplo</span>}
      </div>
    </li>
  );
}
