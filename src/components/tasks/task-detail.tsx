"use client";

import { useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { X, Trash2, Archive, CheckCircle2, Star, Plus, Link2, CalendarX2, Sparkles } from "lucide-react";
import {
  saveTaskAction,
  deleteCardAction,
  archiveCardAction,
  completeCardAction,
  setChecklistAction,
  addTodayPriority,
  getTaskDetailAction,
  getProjectColumnsAction,
  type TaskDetailData,
} from "@/lib/actions/cards";
import type { ChecklistItem } from "@/lib/db/schema";
import { suggestEstimates, normalizeDuration, normalizeEnergy, DURATION_LABEL, ENERGY_LABEL } from "@/lib/estimates";
import { DurationChips, EnergyChips } from "./estimate-chips";
import { useToast } from "@/components/ui/toast";

type ColumnOption = { id: string; title: string; kind: string };

/** Detalle editable de tarea, abrible desde cualquier vista.
 *  Carga sus datos frescos al abrirse (no depende de lo que la lista tenía en memoria). */
export function TaskDetailModal({ cardId, onClose }: { cardId: string; onClose: () => void }) {
  const [data, setData] = useState<TaskDetailData | null>(null);
  const toast = useToast();

  useEffect(() => {
    let alive = true;
    getTaskDetailAction(cardId).then((d) => {
      if (!alive) return;
      if (!d) {
        toast.show({ tone: "info", message: "Esa tarea ya no existe." });
        onClose();
        return;
      }
      setData(d);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId]);

  if (!data) {
    return (
      <div className="fixed inset-0 z-[55] bg-charcoal/30 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6" role="presentation">
        <div role="dialog" aria-modal="true" aria-label="Cargando tarea" className="card w-full md:max-w-3xl p-6 rounded-b-none md:rounded-b-[18px]" data-testid="card-detail">
          <p className="text-sm text-stone">Abriendo tarea…</p>
        </div>
      </div>
    );
  }
  return <TaskDetailEditor data={data} onClose={onClose} />;
}

/** Abre el detalle reflejándolo en la URL (?abrir=<id>) sin recargar la página.
 *  pushState/replaceState se integran con el router de Next → useSearchParams reacciona. */
export function openTaskUrl(cardId: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("abrir", cardId);
  window.history.pushState(null, "", url.toString());
}

function closeTaskUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete("abrir");
  window.history.replaceState(null, "", url.toString());
}

/** Se monta una vez en el layout: si la URL trae ?abrir=<id> (clic, enlace directo,
 *  refresh o botón atrás), muestra el detalle; al cerrar limpia solo ese parámetro
 *  conservando página y filtros. */
export function TaskDetailFromUrl() {
  const searchParams = useSearchParams();
  const abrir = searchParams.get("abrir");
  if (!abrir) return null;
  return <TaskDetailModal key={abrir} cardId={abrir} onClose={closeTaskUrl} />;
}

function TaskDetailEditor({ data, onClose }: { data: TaskDetailData; onClose: () => void }) {
  const { card, projects } = data;
  const [pending, start] = useTransition();
  const toast = useToast();

  // Proyecto y estado (columna) se manejan aparte del resto del formulario.
  const [projectId, setProjectId] = useState<string | null>(card.projectId);
  const [columnId, setColumnId] = useState<string | null>(card.columnId);
  const [columns, setColumns] = useState<ColumnOption[]>(data.columns);

  const [dueDate, setDueDate] = useState(card.dueDate ?? "");
  const [startTime, setStartTime] = useState(card.startTime ?? "");
  const [duration, setDuration] = useState<string | null>(normalizeDuration(card.duration));
  const [energy, setEnergy] = useState<string | null>(normalizeEnergy(card.energy));
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  // sugerencia local (reglas por palabras clave); solo se ofrece si falta algo por estimar
  const suggestion = suggestEstimates(card.title);
  const showSuggestion =
    !suggestionDismissed && suggestion !== null && (duration === null || energy === null);
  const [links, setLinks] = useState<{ label: string; url: string }[]>(card.links ?? []);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(card.checklist ?? []);
  const [newItem, setNewItem] = useState("");

  const [dirty, setDirty] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const done = Boolean(card.completedAt);

  function attemptClose() {
    if (dirty) setConfirmClose(true);
    else onClose();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") attemptClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty]);

  async function pickProject(pid: string | null) {
    setDirty(true);
    setProjectId(pid);
    if (!pid) {
      setColumns([]);
      setColumnId(null);
      return;
    }
    const cols = await getProjectColumnsAction(pid);
    setColumns(cols);
    // por defecto Backlog (o la columna actual si sigue siendo válida)
    const keep = cols.find((c) => c.id === card.columnId && pid === card.projectId);
    setColumnId(keep?.id ?? cols.find((c) => c.kind === "backlog")?.id ?? cols[0]?.id ?? null);
  }

  function toggleComplete() {
    start(async () => {
      try {
        await completeCardAction(card.id, !done);
      } catch {
        toast.show({ tone: "warn", message: "No se pudo guardar el cambio. La tarea quedó como estaba." });
        return;
      }
      if (!done) {
        toast.show({
          message: "Tarea completada ✓",
          action: {
            label: "Deshacer",
            onClick: async () => {
              try {
                await completeCardAction(card.id, false);
              } catch {
                toast.show({ tone: "warn", message: "No se pudo deshacer. Puedes reabrirla desde Terminadas." });
              }
            },
          },
          link: { label: "Ver en terminadas", href: "/tareas?f=terminadas" },
          duration: 8000,
        });
        onClose();
      } else {
        toast.show({ tone: "info", message: "Tarea reabierta — volvió a Próximo." });
        onClose();
      }
    });
  }

  function saveChecklist(next: ChecklistItem[]) {
    setChecklist(next);
    start(async () => {
      try {
        await setChecklistAction(card.id, next);
      } catch {
        toast.show({ tone: "warn", message: "No se pudo guardar la checklist." });
      }
    });
  }

  function submit(fd: FormData) {
    start(async () => {
      try {
        await saveTaskAction(fd);
        toast.show({ message: "Tarea actualizada ✓" });
        onClose();
      } catch {
        toast.show({ tone: "warn", message: "No se pudieron guardar los cambios. Inténtalo de nuevo." });
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-[55] bg-charcoal/30 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6"
      onClick={(e) => e.target === e.currentTarget && attemptClose()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Detalle de «${card.title}»`}
        className="card w-full md:max-w-3xl max-h-[94dvh] md:max-h-[88dvh] overflow-y-auto rounded-b-none md:rounded-b-[18px] p-5 md:p-6 pb-safe"
        data-testid="card-detail"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={`btn !py-1.5 !px-3 text-xs ${done ? "btn-secondary" : "btn-primary"}`}
              disabled={pending}
              onClick={toggleComplete}
              data-testid="card-complete"
            >
              <CheckCircle2 size={14} aria-hidden /> {done ? "Reabrir" : "Completar"}
            </button>
            {!done && (
              <button
                type="button"
                className="btn btn-secondary !py-1.5 !px-3 text-xs"
                disabled={pending}
                onClick={() => start(() => addTodayPriority(card.id))}
                title="Añadir a las 3 prioridades de hoy"
              >
                <Star size={14} aria-hidden /> Prioridad de hoy
              </button>
            )}
            {done && card.completedAt && (
              <span className="chip chip-done">✓ Terminada el {card.completedAt.slice(0, 10)}</span>
            )}
          </div>
          <button type="button" onClick={attemptClose} aria-label="Cerrar" className="btn btn-ghost !p-2" data-testid="card-close">
            <X size={18} aria-hidden />
          </button>
        </div>

        <form action={submit} onChange={() => setDirty(true)} className="flex flex-col gap-5">
          <input type="hidden" name="id" value={card.id} />
          <input type="hidden" name="projectId" value={projectId ?? ""} />
          <input type="hidden" name="columnId" value={columnId ?? ""} />
          <input type="hidden" name="duration" value={duration ?? ""} />
          <input type="hidden" name="energy" value={energy ?? ""} />
          <input type="hidden" name="links" value={JSON.stringify(links)} />

          <div className="md:grid md:grid-cols-[1fr_252px] md:gap-6 flex flex-col gap-5">
            {/* Columna principal: lo que la tarea ES */}
            <div className="flex flex-col gap-4 min-w-0">
              <div>
                <label className="label" htmlFor="cd-title">Título</label>
                <input id="cd-title" name="title" className="input font-medium" defaultValue={card.title} required data-testid="card-title-input" />
              </div>
              <div>
                <label className="label" htmlFor="cd-desc">Descripción</label>
                <textarea id="cd-desc" name="description" className="textarea" rows={4} defaultValue={card.description ?? ""} data-testid="card-desc-input" placeholder="Notas, contexto, lo que haga falta…" />
              </div>
              <div>
                <label className="label" htmlFor="cd-next">Próxima acción concreta</label>
                <input id="cd-next" name="nextAction" className="input" defaultValue={card.nextAction ?? ""} placeholder="¿Cuál es el siguiente paso físico y visible?" />
              </div>

              {/* Checklist: se guarda sola, no marca el formulario como sucio */}
              <div onChange={(e) => e.stopPropagation()}>
                <p className="label">Checklist</p>
                {checklist.length > 0 && (
                  <ul className="flex flex-col gap-1.5 mb-2" data-testid="checklist">
                    {checklist.map((item) => (
                      <li key={item.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          aria-label={`Marcar «${item.text}»`}
                          checked={item.done}
                          onChange={() =>
                            saveChecklist(checklist.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)))
                          }
                          className="h-4 w-4 accent-[#45573f] shrink-0"
                        />
                        <input
                          className={`text-sm flex-1 bg-transparent border-0 focus:outline-none focus:bg-beige/60 rounded px-1 -mx-1 ${item.done ? "line-through text-stone-soft" : ""}`}
                          defaultValue={item.text}
                          aria-label={`Editar «${item.text}»`}
                          onBlur={(e) => {
                            const text = e.target.value.trim();
                            if (text && text !== item.text) {
                              saveChecklist(checklist.map((i) => (i.id === item.id ? { ...i, text } : i)));
                            } else {
                              e.target.value = item.text;
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                        />
                        <button
                          type="button"
                          aria-label={`Eliminar «${item.text}»`}
                          className="text-stone-soft hover:text-blocked shrink-0"
                          onClick={() => saveChecklist(checklist.filter((i) => i.id !== item.id))}
                        >
                          <X size={14} aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-2">
                  <input
                    className="input !min-h-9 text-sm"
                    placeholder="Nuevo paso…"
                    value={newItem}
                    data-testid="checklist-add-input"
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
                    aria-label="Añadir paso a la checklist"
                    disabled={!newItem.trim()}
                    data-testid="checklist-add"
                    onClick={() => {
                      saveChecklist([...checklist, { id: crypto.randomUUID(), text: newItem.trim(), done: false }]);
                      setNewItem("");
                    }}
                  >
                    <Plus size={15} aria-hidden />
                  </button>
                </div>
              </div>

              {/* Enlaces / referencias */}
              <div>
                <p className="label flex items-center gap-1.5"><Link2 size={13} aria-hidden /> Enlaces</p>
                {links.length > 0 && (
                  <ul className="flex flex-col gap-1.5 mb-2">
                    {links.map((l, i) => (
                      <li key={i} className="flex gap-2 items-center">
                        <input
                          className="input !min-h-9 text-sm !w-36 shrink-0"
                          placeholder="Nombre"
                          value={l.label}
                          aria-label={`Nombre del enlace ${i + 1}`}
                          onChange={(e) => {
                            setDirty(true);
                            setLinks(links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)));
                          }}
                        />
                        <input
                          className="input !min-h-9 text-sm flex-1"
                          placeholder="https://"
                          value={l.url}
                          aria-label={`URL del enlace ${i + 1}`}
                          onChange={(e) => {
                            setDirty(true);
                            setLinks(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)));
                          }}
                        />
                        <button
                          type="button"
                          aria-label={`Eliminar enlace ${i + 1}`}
                          className="text-stone-soft hover:text-blocked shrink-0"
                          onClick={() => {
                            setDirty(true);
                            setLinks(links.filter((_, j) => j !== i));
                          }}
                        >
                          <X size={14} aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  className="btn btn-ghost !py-1 text-xs"
                  data-testid="add-link"
                  onClick={() => {
                    setDirty(true);
                    setLinks([...links, { label: "", url: "" }]);
                  }}
                >
                  <Plus size={13} aria-hidden /> Añadir enlace
                </button>
              </div>
            </div>

            {/* Columna lateral: dónde vive y cómo se organiza */}
            <div className="flex flex-col gap-4">
              <div>
                <p className="label">Proyecto</p>
                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Proyecto de la tarea">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={!projectId}
                    data-testid="project-none"
                    onClick={() => pickProject(null)}
                    className={`chip transition-colors ${!projectId ? "!bg-forest !text-cream !border-forest" : "hover:bg-sand"}`}
                  >
                    Sin proyecto
                  </button>
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      role="radio"
                      aria-checked={projectId === p.id}
                      data-testid={`project-${p.id}`}
                      onClick={() => pickProject(p.id)}
                      className={`chip transition-colors ${projectId === p.id ? "!bg-forest !text-cream !border-forest" : "hover:bg-sand"}`}
                    >
                      {p.title}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="label">Estado</p>
                {projectId && columns.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Lista del tablero">
                    {columns.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        role="radio"
                        aria-checked={columnId === c.id}
                        data-testid={`state-${c.kind}`}
                        onClick={() => {
                          setDirty(true);
                          setColumnId(c.id);
                        }}
                        className={`chip transition-colors ${columnId === c.id ? "!bg-olive !text-cream !border-olive" : "hover:bg-sand"}`}
                      >
                        {c.title}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-stone-soft">
                    Elige un proyecto para colocarla en una lista de su tablero.
                  </p>
                )}
              </div>

              {/* Sugerencia local: se ofrece, nunca se guarda sola */}
              {showSuggestion && (
                <div className="rounded-xl bg-sage-soft/60 border border-sage-soft px-3 py-2 text-sm" data-testid="detail-suggestion">
                  <p>
                    <Sparkles size={13} className="inline mr-1 text-olive" aria-hidden />
                    <span className="chip chip-sage !text-[11px] mr-1.5">Sugerido</span>
                    Duración <strong>{DURATION_LABEL[suggestion.duration]}</strong> · energía{" "}
                    <strong>{ENERGY_LABEL[suggestion.energy].toLowerCase()}</strong>
                    <span className="text-stone"> — porque el título contiene «{suggestion.matched}».</span>
                  </p>
                  <div className="flex gap-2 mt-1.5">
                    <button
                      type="button"
                      className="btn btn-secondary !py-1 !px-2.5 text-xs"
                      data-testid="detail-suggestion-use"
                      onClick={() => {
                        if (duration === null) setDuration(suggestion.duration);
                        if (energy === null) setEnergy(suggestion.energy);
                        setDirty(true);
                        setSuggestionDismissed(true);
                      }}
                    >
                      Usar sugerencia
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost !py-1 !px-2.5 text-xs"
                      data-testid="detail-suggestion-skip"
                      onClick={() => setSuggestionDismissed(true)}
                    >
                      Ahora no
                    </button>
                  </div>
                </div>
              )}

              <div>
                <p className="label">Duración estimada</p>
                <DurationChips
                  value={duration}
                  onChange={(v) => {
                    setDirty(true);
                    setDuration(v);
                  }}
                />
              </div>
              <div>
                <p className="label">Energía requerida</p>
                <EnergyChips
                  value={energy}
                  onChange={(v) => {
                    setDirty(true);
                    setEnergy(v);
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="cd-priority">Prioridad</label>
                  <select id="cd-priority" name="priority" className="select" defaultValue={card.priority ?? "media"}>
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                  </select>
                </div>
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
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="label" htmlFor="cd-due">Fecha límite</label>
                  {(dueDate || startTime) && (
                    <button
                      type="button"
                      className="text-xs text-stone hover:text-blocked flex items-center gap-1"
                      data-testid="clear-date"
                      onClick={() => {
                        setDirty(true);
                        setDueDate("");
                        setStartTime("");
                      }}
                    >
                      <CalendarX2 size={12} aria-hidden /> Quitar
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <input id="cd-due" name="dueDate" type="date" className="input flex-1" value={dueDate} onChange={(e) => setDueDate(e.target.value)} data-testid="card-due-input" />
                  <input aria-label="Hora (opcional)" name="startTime" type="time" className="input !w-28" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="label" htmlFor="cd-reminder">Recordatorio</label>
                <select id="cd-reminder" name="reminder" className="select" defaultValue={card.reminder ?? ""}>
                  <option value="">Sin recordatorio</option>
                  <option value="gcal-timed">Google Calendar (con hora)</option>
                  <option value="gcal-allday">Google Calendar (todo el día)</option>
                </select>
              </div>

              <div>
                <label className="label" htmlFor="cd-blocked">Bloqueada por…</label>
                <input id="cd-blocked" name="blockedReason" className="input" defaultValue={card.blockedReason ?? ""} placeholder="¿Qué la detiene?" />
              </div>
              <div>
                <label className="label" htmlFor="cd-waiting">Esperando a…</label>
                <input id="cd-waiting" name="waitingFor" className="input" defaultValue={card.waitingFor ?? ""} placeholder="Persona, respuesta, pago…" />
              </div>
              <div>
                <label className="label" htmlFor="cd-tags">Etiquetas (separadas por coma)</label>
                <input id="cd-tags" name="tags" className="input" defaultValue={(card.tags ?? []).join(", ")} />
              </div>
            </div>
          </div>

          <div className="flex gap-2 border-t border-beige pt-4">
            <button type="submit" className="btn btn-primary flex-1 md:flex-none md:min-w-44" disabled={pending} data-testid="card-save">
              {pending ? "Guardando…" : "Guardar cambios"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose} data-testid="card-cancel">
              Cancelar
            </button>
          </div>
        </form>

        <div className="mt-4 border-t border-beige pt-3 flex items-center justify-between">
          <button
            type="button"
            className="btn btn-ghost text-xs"
            disabled={pending}
            data-testid="card-archive"
            onClick={() =>
              start(async () => {
                await archiveCardAction(card.id, true);
                toast.show({ tone: "info", message: "Tarea archivada." });
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
                data-testid="card-delete-confirm"
                onClick={() =>
                  start(async () => {
                    await deleteCardAction(card.id);
                    toast.show({ tone: "info", message: "Tarea eliminada." });
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
            <button type="button" className="btn btn-danger !py-1.5 text-xs" onClick={() => setConfirmDelete(true)} data-testid="card-delete">
              <Trash2 size={14} aria-hidden /> Eliminar
            </button>
          )}
        </div>

        {/* Aviso de cambios sin guardar (nada de alertas nativas) */}
        {confirmClose && (
          <div className="fixed inset-0 z-[60] bg-charcoal/40 backdrop-blur-[2px] flex items-center justify-center p-6" data-testid="unsaved-warning">
            <div className="card p-5 max-w-sm text-center flex flex-col gap-3">
              <p className="text-sm font-medium">Tienes cambios sin guardar</p>
              <p className="text-xs text-stone">Si cierras ahora, se perderán los cambios que no guardaste.</p>
              <div className="flex gap-2 justify-center">
                <button type="button" className="btn btn-secondary text-sm" onClick={() => setConfirmClose(false)} data-testid="keep-editing">
                  Seguir editando
                </button>
                <button type="button" className="btn btn-danger text-sm" onClick={onClose} data-testid="discard-changes">
                  Descartar cambios
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
