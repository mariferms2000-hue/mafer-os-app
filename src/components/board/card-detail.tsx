"use client";

import { useState, useTransition } from "react";
import { X, Trash2, Archive, CheckCircle2, Star, Plus } from "lucide-react";
import {
  updateCardAction,
  deleteCardAction,
  archiveCardAction,
  completeCardAction,
  setChecklistAction,
  addTodayPriority,
} from "@/lib/actions/cards";
import type { ChecklistItem } from "@/lib/db/schema";
import { useToast } from "@/components/ui/toast";

export type BoardCard = {
  id: string;
  title: string;
  description: string | null;
  columnId: string | null;
  position: number;
  type: string;
  priority: string | null;
  duration: string | null;
  energy: string | null;
  dueDate: string | null;
  startTime: string | null;
  reminder: string | null;
  nextAction: string | null;
  blockedReason: string | null;
  waitingFor: string | null;
  tags: string[] | null;
  checklist: ChecklistItem[] | null;
  completedAt: string | null;
};

export function CardDetail({ card, onClose }: { card: BoardCard; onClose: () => void }) {
  const [pending, start] = useTransition();
  const [checklist, setChecklist] = useState<ChecklistItem[]>(card.checklist ?? []);
  const [newItem, setNewItem] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const toast = useToast();
  const done = Boolean(card.completedAt);

  function toggleComplete() {
    start(async () => {
      await completeCardAction(card.id, !done);
      if (!done) {
        toast.show({
          message: "Tarea completada ✓",
          action: { label: "Deshacer", onClick: () => completeCardAction(card.id, false) },
          link: { label: "Ver en terminadas", href: "/tareas?f=terminadas" },
          duration: 8000,
        });
        onClose();
      } else {
        toast.show({ tone: "info", message: "Tarea reabierta — volvió a Próximo." });
      }
    });
  }

  function saveChecklist(next: ChecklistItem[]) {
    setChecklist(next);
    start(() => setChecklistAction(card.id, next));
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-charcoal/30 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Detalle de «${card.title}»`}
        className="card w-full md:max-w-2xl max-h-[92dvh] md:max-h-[85dvh] overflow-y-auto rounded-b-none md:rounded-b-[18px] p-5 pb-safe"
        data-testid="card-detail"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`btn !py-1.5 !px-3 text-xs ${done ? "btn-secondary" : "btn-primary"}`}
              disabled={pending}
              onClick={toggleComplete}
              data-testid="card-complete"
            >
              <CheckCircle2 size={14} aria-hidden /> {done ? "Reabrir" : "Completar"}
            </button>
            <button
              type="button"
              className="btn btn-secondary !py-1.5 !px-3 text-xs"
              disabled={pending}
              onClick={() => start(() => addTodayPriority(card.id))}
              title="Añadir a las 3 prioridades de hoy"
            >
              <Star size={14} aria-hidden /> Prioridad de hoy
            </button>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="btn btn-ghost !p-2">
            <X size={18} aria-hidden />
          </button>
        </div>

        <form
          action={(fd) =>
            start(async () => {
              await updateCardAction(fd);
              onClose();
            })
          }
          className="flex flex-col gap-4"
        >
          <input type="hidden" name="id" value={card.id} />
          <div>
            <label className="label" htmlFor="cd-title">Título</label>
            <input id="cd-title" name="title" className="input font-medium" defaultValue={card.title} required data-testid="card-title-input" />
          </div>
          <div>
            <label className="label" htmlFor="cd-desc">Descripción</label>
            <textarea id="cd-desc" name="description" className="textarea" rows={3} defaultValue={card.description ?? ""} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="label" htmlFor="cd-type">Tipo</label>
              <select id="cd-type" name="type" className="select" defaultValue={card.type}>
                <option value="tarea">Tarea</option>
                <option value="idea">Idea</option>
                <option value="pregunta">Pregunta</option>
                <option value="decision">Decisión</option>
                <option value="recurso">Recurso</option>
                <option value="aprendizaje">Aprendizaje</option>
                <option value="seguimiento">Seguimiento</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="cd-priority">Prioridad</label>
              <select id="cd-priority" name="priority" className="select" defaultValue={card.priority ?? "media"}>
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="cd-duration">Duración</label>
              <select id="cd-duration" name="duration" className="select" defaultValue={card.duration ?? ""}>
                <option value="">Sin estimar</option>
                <option value="5m">5 minutos</option>
                <option value="15m">15 minutos</option>
                <option value="30m">30 minutos</option>
                <option value="60m">1 hora</option>
                <option value="deep">Trabajo profundo</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="cd-energy">Energía</label>
              <select id="cd-energy" name="energy" className="select" defaultValue={card.energy ?? ""}>
                <option value="">—</option>
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="label" htmlFor="cd-due">Fecha límite</label>
              <input id="cd-due" name="dueDate" type="date" className="input" defaultValue={card.dueDate ?? ""} />
            </div>
            <div>
              <label className="label" htmlFor="cd-time">Hora (opcional)</label>
              <input id="cd-time" name="startTime" type="time" className="input" defaultValue={card.startTime ?? ""} />
            </div>
            <div>
              <label className="label" htmlFor="cd-reminder">Recordatorio</label>
              <select id="cd-reminder" name="reminder" className="select" defaultValue={card.reminder ?? ""}>
                <option value="">Sin recordatorio</option>
                <option value="gcal-timed">Google Calendar (con hora)</option>
                <option value="gcal-allday">Google Calendar (todo el día)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="cd-next">Próxima acción concreta</label>
            <input id="cd-next" name="nextAction" className="input" defaultValue={card.nextAction ?? ""} placeholder="¿Cuál es el siguiente paso físico y visible?" />
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="cd-blocked">Bloqueada por…</label>
              <input id="cd-blocked" name="blockedReason" className="input" defaultValue={card.blockedReason ?? ""} placeholder="¿Qué la detiene?" />
            </div>
            <div>
              <label className="label" htmlFor="cd-waiting">Esperando a…</label>
              <input id="cd-waiting" name="waitingFor" className="input" defaultValue={card.waitingFor ?? ""} placeholder="Persona, respuesta, pago…" />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="cd-tags">Etiquetas (separadas por coma)</label>
            <input id="cd-tags" name="tags" className="input" defaultValue={(card.tags ?? []).join(", ")} />
          </div>

          <button type="submit" className="btn btn-primary" disabled={pending} data-testid="card-save">
            {pending ? "Guardando…" : "Guardar cambios"}
          </button>
        </form>

        {/* Checklist (se guarda sola, fuera del formulario) */}
        <div className="mt-5 border-t border-beige pt-4">
          <p className="label">Checklist</p>
          <ul className="flex flex-col gap-1.5">
            {checklist.map((item) => (
              <li key={item.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`chk-${item.id}`}
                  checked={item.done}
                  onChange={() =>
                    saveChecklist(checklist.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)))
                  }
                  className="h-4 w-4 accent-[#45573f]"
                />
                <label htmlFor={`chk-${item.id}`} className={`text-sm flex-1 ${item.done ? "line-through text-stone-soft" : ""}`}>
                  {item.text}
                </label>
                <button
                  type="button"
                  aria-label={`Eliminar «${item.text}»`}
                  className="text-stone-soft hover:text-blocked"
                  onClick={() => saveChecklist(checklist.filter((i) => i.id !== item.id))}
                >
                  <X size={14} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2 mt-2">
            <input
              className="input !min-h-9 text-sm"
              placeholder="Nuevo paso…"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newItem.trim()) {
                  e.preventDefault();
                  saveChecklist([...checklist, { id: crypto.randomUUID(), text: newItem.trim(), done: false }]);
                  setNewItem("");
                }
              }}
            />
            <button
              type="button"
              className="btn btn-secondary !min-h-9"
              disabled={!newItem.trim()}
              onClick={() => {
                saveChecklist([...checklist, { id: crypto.randomUUID(), text: newItem.trim(), done: false }]);
                setNewItem("");
              }}
            >
              <Plus size={15} aria-hidden />
            </button>
          </div>
        </div>

        <div className="mt-5 border-t border-beige pt-4 flex items-center justify-between">
          <button
            type="button"
            className="btn btn-ghost text-xs"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await archiveCardAction(card.id, true);
                onClose();
              })
            }
          >
            <Archive size={14} aria-hidden /> Archivar
          </button>
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-stone">¿Segura?</span>
              <button
                type="button"
                className="btn btn-danger !py-1.5 text-xs"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await deleteCardAction(card.id);
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
            <button type="button" className="btn btn-danger !py-1.5 text-xs" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={14} aria-hidden /> Eliminar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
