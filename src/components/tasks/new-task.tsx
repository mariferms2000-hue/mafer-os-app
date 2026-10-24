"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Plus, X, ChevronDown, ChevronUp } from "lucide-react";
import { createCardAction } from "@/lib/actions/cards";
import { avisosEnabledAction } from "@/lib/actions/avisos";
import { DEFAULT_LEAD } from "@/lib/avisos/logic";
import { AvisoFields, avisoFormProblem } from "./aviso-fields";
import { warnAviso } from "./aviso-toast";
import { ClassifyStep } from "./classify-step";
import { useToast } from "@/components/ui/toast";

export type ProjectOption = { id: string; title: string };

export function NewTaskButton({
  projects,
  defaultProjectId,
}: {
  projects: ProjectOption[];
  defaultProjectId?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)} data-testid="new-task">
        <Plus size={16} aria-hidden /> Nueva tarea
      </button>
      {open && (
        <NewTaskModal projects={projects} defaultProjectId={defaultProjectId} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

/** Crear una tarea con fricción mínima: solo el título es obligatorio.
 *  Después de guardar aparece la clasificación breve y opcional (paso 2),
 *  con sugerencia local que Mafer confirma, cambia u omite («Ahora no»). */
export function NewTaskModal({
  projects,
  defaultProjectId,
  onClose,
}: {
  projects: ProjectOption[];
  defaultProjectId?: string;
  onClose: () => void;
}) {
  const [more, setMore] = useState(false);
  const [created, setCreated] = useState<{ id: string; title: string } | null>(null);
  const [pending, start] = useTransition();
  const busy = useRef(false);
  const toast = useToast();
  const [avisosOn, setAvisosOn] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [aviso, setAviso] = useState(false);
  const [lead, setLead] = useState(DEFAULT_LEAD);
  const [proposed, setProposed] = useState(false);

  useEffect(() => {
    let alive = true;
    avisosEnabledAction()
      .then((v) => alive && setAvisosOn(v))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[55] overlay-screen flex items-end md:items-center justify-center p-0 md:p-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Nueva tarea"
        className="card card-raised w-full md:max-w-lg max-h-[92dvh] overflow-y-auto rounded-b-none md:rounded-b-[18px] p-5 pb-safe"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg text-forest-deep">{created ? "Clasificar (opcional)" : "Nueva tarea"}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="btn btn-ghost !p-2">
            <X size={18} aria-hidden />
          </button>
        </div>

        {created ? (
          <ClassifyStep cardId={created.id} title={created.title} onDone={onClose} showOpenTask />
        ) : (
          <form
            action={(fd) => {
              const title = String(fd.get("title") ?? "").trim();
              if (!title || busy.current) return;
              const problem = avisosOn ? avisoFormProblem(fd) : null;
              if (problem) {
                toast.show({ tone: "warn", message: problem });
                return;
              }
              busy.current = true;
              start(async () => {
                try {
                  const res = await createCardAction(fd);
                  if (res) {
                    toast.show({ message: "Tarea creada ✓", link: { label: "Ver tareas", href: "/tareas" } });
                    warnAviso(toast, res);
                    setCreated({ id: res.id, title });
                  } else {
                    onClose();
                  }
                } catch {
                  toast.show({ tone: "warn", message: "No se pudo crear la tarea. Inténtalo de nuevo." });
                } finally {
                  busy.current = false;
                }
              });
            }}
            className="flex flex-col gap-3"
          >
            <div>
              <label className="label" htmlFor="nt-title">¿Qué hay que hacer?</label>
              <input
                id="nt-title"
                name="title"
                className="input"
                required
                autoFocus
                placeholder="Solo el título — lo demás es opcional"
                data-testid="new-task-title"
              />
            </div>

            <button
              type="button"
              className="text-sm text-forest flex items-center gap-1 self-start hover:underline underline-offset-4"
              onClick={() => setMore((m) => !m)}
              aria-expanded={more}
              data-testid="new-task-more"
            >
              {more ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
              {more ? "Menos opciones" : "Más opciones"}
            </button>

            {more && (
              <div className="flex flex-col gap-3 border-t border-beige pt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label" htmlFor="nt-project">Proyecto (opcional)</label>
                    <select id="nt-project" name="projectId" className="select" defaultValue={defaultProjectId ?? ""}>
                      <option value="">Sin proyecto</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="nt-state">Estado</label>
                    <select id="nt-state" name="columnKind" className="select" defaultValue="proximo">
                      <option value="proximo">Próximo</option>
                      <option value="backlog">Backlog</option>
                      <option value="proceso">En proceso</option>
                      <option value="esperando">Esperando</option>
                      <option value="despues">Después</option>
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="nt-date">Fecha (opcional)</label>
                    <input id="nt-date" name="dueDate" type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} data-testid="new-task-date" />
                  </div>
                  <div>
                    <label className="label" htmlFor="nt-priority">Prioridad</label>
                    <select id="nt-priority" name="priority" className="select" defaultValue="media">
                      <option value="baja">Baja</option>
                      <option value="media">Media</option>
                      <option value="alta">Alta</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label" htmlFor="nt-desc">Descripción</label>
                  <textarea id="nt-desc" name="description" className="textarea" rows={2} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label" htmlFor="nt-time">Hora</label>
                    <input id="nt-time" name="startTime" type="time" className="input" value={startTime} onChange={(e) => setStartTime(e.target.value)} data-testid="new-task-time" />
                  </div>
                  {avisosOn ? (
                    <div>
                      <span className="label">Aviso</span>
                      <AvisoFields
                        on={aviso}
                        onToggle={setAviso}
                        lead={lead}
                        onLead={setLead}
                        dueDate={dueDate}
                        startTime={startTime}
                        onProposeTime={(t) => {
                          setStartTime(t);
                          setProposed(true);
                        }}
                        proposedTime={proposed}
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="label" htmlFor="nt-reminder">Recordatorio</label>
                      <select id="nt-reminder" name="reminder" className="select" defaultValue="">
                        <option value="">Sin recordatorio</option>
                        <option value="gcal-timed">Google Calendar (con hora)</option>
                        <option value="gcal-allday">Google Calendar (todo el día)</option>
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="label" htmlFor="nt-blocked">Bloqueada por…</label>
                    <input id="nt-blocked" name="blockedReason" className="input" />
                  </div>
                  <div>
                    <label className="label" htmlFor="nt-waiting">Esperando a…</label>
                    <input id="nt-waiting" name="waitingFor" className="input" />
                  </div>
                </div>
                <div>
                  <label className="label" htmlFor="nt-tags">Etiquetas (separadas por coma)</label>
                  <input id="nt-tags" name="tags" className="input" />
                </div>
                <p className="text-xs text-stone-soft">
                  La duración y la energía se sugieren después de guardar; la checklist y los enlaces
                  se agregan abriendo la tarea.
                </p>
              </div>
            )}

            <button type="submit" className="btn btn-primary" disabled={pending} data-testid="new-task-save">
              {pending ? "Creando…" : "Crear tarea"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
