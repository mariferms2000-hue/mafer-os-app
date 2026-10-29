"use client";

import { useState, useTransition } from "react";
import {
  X,
  Check,
  Trash2,
  Archive,
  Sparkles,
  CircleCheckBig,
  SquareKanban,
  Lightbulb,
  Rocket,
  NotebookPen,
  Scale,
  Link2,
  CalendarDays,
  MoreHorizontal,
  PencilLine,
} from "lucide-react";
import {
  convertInboxItem,
  updateInboxItem,
  archiveInboxItem,
  deleteInboxItem,
  undoInboxToTaskAction,
  completeInboxItemAction,
  undoInboxDoneAction,
} from "@/lib/actions/inbox";
import { captureAge, quickDueDates } from "@/lib/inbox-dates";
import { useToast } from "@/components/ui/toast";
import type { schema } from "@/lib/db";
import { EVENT_TYPES } from "@/lib/event-types";

type Item = typeof schema.inboxItems.$inferSelect;
type Project = { id: string; title: string };

const TYPES = [
  { value: "tarea", label: "Tarea", icon: CircleCheckBig },
  { value: "proyecto", label: "Proyecto", icon: SquareKanban },
  { value: "idea", label: "Idea", icon: Lightbulb },
  { value: "aprendizaje", label: "Learn Fast", icon: Rocket },
  { value: "journal", label: "Journal", icon: NotebookPen },
  { value: "decision", label: "Decisión", icon: Scale },
  { value: "recurso", label: "Recurso", icon: Link2 },
  { value: "evento", label: "Evento", icon: CalendarDays },
];

const TYPE_LABEL = Object.fromEntries(TYPES.map((t) => [t.value, t.label]));

/** Inbox (Bloque 2): capturar, organizar y ejecutar son pasos distintos, y
 *  organizar debe costar dos toques. Cada captura ofrece las salidas más
 *  comunes a la vista — Tarea (con fecha rápida) y Evento — y el resto de
 *  destinos en «Más…». Sin paso de clasificación obligatorio. */
export function InboxList({ items, projects, today }: { items: Item[]; projects: Project[]; today: string }) {
  const [openItem, setOpenItem] = useState<{ item: Item; type: string | null } | null>(null);

  return (
    <>
      <ul className="flex flex-col gap-2.5" data-testid="inbox-list">
        {items.map((item) => (
          <InboxCard
            key={item.id}
            item={item}
            today={today}
            onProcess={(type) => setOpenItem({ item, type })}
          />
        ))}
      </ul>
      {openItem && (
        <ProcessPanel
          item={openItem.item}
          initialType={openItem.type}
          projects={projects}
          onClose={() => setOpenItem(null)}
        />
      )}
    </>
  );
}

function InboxCard({
  item,
  today,
  onProcess,
}: {
  item: Item;
  today: string;
  onProcess: (type: string | null) => void;
}) {
  const [menu, setMenu] = useState(false);
  const [dates, setDates] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();

  function toggleMenu() {
    setMenu((m) => !m);
    setConfirmDelete(false);
  }

  /** Captura → tarea en un toque más: sin proyecto (se asigna después si hace falta). */
  function toTask(date: string | null) {
    const fd = new FormData();
    fd.set("id", item.id);
    fd.set("target", "tarea");
    fd.set("content", item.content);
    fd.set("note", item.note ?? "");
    if (date) fd.set("date", date);
    start(async () => {
      try {
        const res = await convertInboxItem(fd);
        const cardId = res?.convertedTo.split(":")[1];
        toast.show({
          message: "Convertida en tarea ✓",
          action: {
            label: "Deshacer",
            onClick: async () => {
              const ok = await undoInboxToTaskAction(item.id);
              if (!ok) toast.show({ tone: "warn", message: "Ya no se puede deshacer: la tarea cambió." });
            },
          },
          link: cardId ? { label: "Abrir", href: `/tareas?abrir=${cardId}` } : undefined,
          duration: 8000,
        });
      } catch {
        toast.show({ tone: "error", message: "No se pudo convertir. La captura sigue en el Inbox." });
      }
    });
  }

  /** «✓ Hecho»: sí lo hice → una tarea ya completada que cuenta como progreso.
   *  Si el progreso falló, la tarea quedó hecha igual y el toast lo dice. */
  function markDone() {
    start(async () => {
      let res: Awaited<ReturnType<typeof completeInboxItemAction>>;
      try {
        res = await completeInboxItemAction(item.id);
      } catch {
        toast.show({ tone: "error", message: "No se pudo marcar como hecha. La captura sigue en el Inbox." });
        return;
      }
      if (!res) return;
      // si este completado ganó la recompensa, Deshacer la revoca (sin volver a tirar)
      const rewardId = res.progress?.reward?.id ?? null;
      toast.show({
        tone: res.progressFailed ? "warn" : "ok",
        message: res.progressFailed ? "✓ Hecho. No se pudo actualizar el progreso." : "Hecho ✓",
        action: {
          label: "Deshacer",
          onClick: async () => {
            try {
              const undo = await undoInboxDoneAction(item.id, rewardId);
              if (undo.status === "changed") toast.show({ tone: "warn", message: "Ya no se puede deshacer: la tarea cambió." });
              if (undo.status === "failed") toast.show({ tone: "error", message: "No se pudo deshacer. La tarea sigue en Terminadas." });
            } catch {
              toast.show({ tone: "error", message: "No se pudo deshacer. La tarea sigue en Terminadas." });
            }
          },
        },
        link: { label: "Ver en terminadas", href: "/tareas?v=terminadas" },
        duration: 8000,
      });
    });
  }

  return (
    <li className="card p-4" data-testid="inbox-item">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium break-words">{item.content}</p>
          {item.note && <p className="text-sm text-stone mt-0.5 line-clamp-1">{item.note}</p>}
          <p className="text-xs text-stone-soft mt-1 flex flex-wrap items-center gap-1.5">
            <span data-testid="inbox-age">{captureAge(item.createdAt, today)}</span>
            {item.typeHint && <span className="chip chip-sage">{TYPE_LABEL[item.typeHint] ?? item.typeHint}</span>}
            {item.isStarter && <span className="chip">Ejemplo</span>}
          </p>
        </div>
        <div className="relative shrink-0">
          <button
            type="button"
            aria-label={`Más opciones para «${item.content}»`}
            className="btn btn-ghost !p-2"
            onClick={toggleMenu}
            data-testid="inbox-menu"
          >
            <MoreHorizontal size={16} aria-hidden />
          </button>
          {menu && (
            <div className="absolute right-0 z-20 mt-1 card p-1.5 flex flex-col min-w-44 text-sm">
              <button
                type="button"
                disabled={pending}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-beige"
                onClick={() => {
                  setMenu(false);
                  onProcess(null);
                }}
              >
                <PencilLine size={14} aria-hidden /> Editar captura
              </button>
              <button
                type="button"
                disabled={pending}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-beige"
                data-testid="inbox-archive"
                onClick={() =>
                  start(async () => {
                    await archiveInboxItem(item.id);
                    toast.show({ message: "Captura archivada." });
                  })
                }
              >
                <Archive size={14} aria-hidden /> Archivar
              </button>
              {confirmDelete ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5">
                  <span className="text-xs text-stone">¿Eliminar?</span>
                  <button
                    type="button"
                    disabled={pending}
                    className="btn btn-danger !py-1 !px-2 text-xs"
                    data-testid="inbox-delete-confirm"
                    onClick={() =>
                      start(async () => {
                        await deleteInboxItem(item.id);
                        toast.show({ tone: "info", message: "Captura eliminada." });
                      })
                    }
                  >
                    Sí, eliminar
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost !py-1 !px-2 text-xs"
                    onClick={() => setConfirmDelete(false)}
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-blocked hover:bg-blocked-soft"
                  data-testid="inbox-delete"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 size={14} aria-hidden /> Eliminar
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Salidas rápidas */}
      <div className="flex flex-wrap items-center gap-1.5 mt-3" role="group" aria-label={`Convertir «${item.content}»`}>
        <button
          type="button"
          className="btn btn-secondary !py-1.5 !px-3 text-sm"
          disabled={pending}
          onClick={markDone}
          data-testid="inbox-done"
        >
          <Check size={14} aria-hidden /> Hecho
        </button>
        <button
          type="button"
          className={`btn !py-1.5 !px-3 text-sm ${dates ? "btn-primary" : "btn-secondary"}`}
          aria-expanded={dates}
          disabled={pending}
          onClick={() => setDates((d) => !d)}
          data-testid="inbox-to-task"
        >
          <CircleCheckBig size={14} aria-hidden /> Tarea
        </button>
        <button
          type="button"
          className="btn btn-secondary !py-1.5 !px-3 text-sm"
          disabled={pending}
          onClick={() => onProcess("evento")}
          data-testid="inbox-to-event"
        >
          <CalendarDays size={14} aria-hidden /> Evento
        </button>
        <button
          type="button"
          className="btn btn-ghost !py-1.5 !px-3 text-sm"
          disabled={pending}
          onClick={() => onProcess(item.typeHint || null)}
          data-testid="inbox-process"
        >
          <Sparkles size={14} aria-hidden /> Más…
        </button>
      </div>
      {dates && (
        <div className="flex flex-wrap items-center gap-1.5 mt-2" role="group" aria-label="¿Para cuándo?" data-testid="inbox-task-dates">
          <span className="text-xs text-stone mr-0.5">¿Para cuándo?</span>
          {quickDueDates(today).map((q) => (
            <button
              key={q.key}
              type="button"
              className="chip hover:bg-sand transition-colors !py-1 !px-2.5 text-[13px]"
              disabled={pending}
              onClick={() => toTask(q.date)}
              data-testid={`inbox-task-${q.key}`}
            >
              {q.label}
            </button>
          ))}
        </div>
      )}
    </li>
  );
}

/** Panel de procesado: lateral en desktop, bottom sheet en móvil.
 *  Progressive disclosure: primero «¿Qué es esto?», luego solo los campos del tipo. */
function ProcessPanel({
  item,
  initialType,
  projects,
  onClose,
}: {
  item: Item;
  initialType: string | null;
  projects: Project[];
  onClose: () => void;
}) {
  const [type, setType] = useState<string | null>(initialType);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();

  return (
    <div
      className="fixed inset-0 z-[55] overlay-screen flex items-end md:items-stretch md:justify-end"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Procesar «${item.content}»`}
        className="card card-raised w-full md:w-[440px] md:h-full max-h-[92dvh] md:max-h-none overflow-y-auto rounded-b-none md:rounded-none md:rounded-l-[18px] p-5 pb-safe"
        data-testid="process-panel"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg text-forest-deep">Procesar captura</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="btn btn-ghost !p-2">
            <X size={18} aria-hidden />
          </button>
        </div>

        <form
          action={(fd) =>
            start(async () => {
              if (type) {
                const res = await convertInboxItem(fd);
                const [tipo, targetId] = res?.convertedTo.split(":") ?? [];
                toast.show({
                  message: `Convertido en ${TYPE_LABEL[type].toLowerCase()} ✓`,
                  link: tipo === "tarea" && targetId ? { label: "Abrir", href: `/tareas?abrir=${targetId}` } : undefined,
                });
              } else {
                await updateInboxItem(fd);
                toast.show({ message: "Cambios guardados. Sigue en tu Inbox." });
              }
              onClose();
            })
          }
          className="flex flex-col gap-4"
        >
          <input type="hidden" name="id" value={item.id} />
          {type && <input type="hidden" name="target" value={type} />}

          <div>
            <label className="label" htmlFor="pp-content">Captura</label>
            <textarea id="pp-content" name="content" className="textarea" rows={2} defaultValue={item.content} />
          </div>
          <div>
            <label className="label" htmlFor="pp-note">Nota</label>
            <textarea id="pp-note" name="note" className="textarea" rows={2} defaultValue={item.note ?? ""} placeholder="Contexto opcional" />
          </div>

          <fieldset>
            <legend className="label">¿Qué es esto?</legend>
            <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Tipo de captura">
              {TYPES.map(({ value, label, icon: Icon }) => {
                const active = type === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    data-testid={`type-${value}`}
                    onClick={() => setType(active ? null : value)}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "bg-forest text-cream border-forest"
                        : "bg-paper border-sand text-ink-green hover:bg-beige"
                    }`}
                  >
                    <Icon size={15} aria-hidden /> {label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Campos según el tipo elegido — nada antes de decidir */}
          {type === "tarea" && (
            <div className="grid grid-cols-2 gap-3 border-t border-beige pt-3">
              <div className="col-span-2">
                <label className="label" htmlFor="pp-project">Proyecto (opcional)</label>
                <select id="pp-project" name="projectId" className="select" defaultValue={item.projectId ?? ""}>
                  <option value="">Sin proyecto</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>
              {/* Ancho completo: al quitar «Siguiente acción», Fecha se quedaba a media
                  columna con un hueco a la derecha. */}
              <div className="col-span-2">
                <label className="label" htmlFor="pp-date">Fecha</label>
                <input id="pp-date" name="date" type="date" className="input" defaultValue={item.date ?? ""} />
              </div>
              {/* Sin «Siguiente acción»: es un concepto de PROYECTO (ver NextActionBlock).
                  Una tarea no la muestra ni la deja editar en su detalle, así que pedirla
                  aquí solo guardaba un dato huérfano en cards.nextAction. */}
            </div>
          )}

          {type === "proyecto" && (
            <div className="border-t border-beige pt-3">
              <label className="label" htmlFor="pp-objective">¿Cómo se ve terminado?</label>
              <textarea id="pp-objective" name="objective" className="textarea" rows={2} />
            </div>
          )}

          {type === "idea" && (
            <div className="border-t border-beige pt-3">
              <label className="label" htmlFor="pp-category">Categoría</label>
              <select id="pp-category" name="category" className="select" defaultValue="general">
                <option value="general">Por explorar</option>
                <option value="proyecto">Posible proyecto</option>
                <option value="estudio">Estudios / formación</option>
                <option value="negocio">Idea de negocio</option>
                <option value="experimento">Experimento personal</option>
              </select>
            </div>
          )}

          {type === "aprendizaje" && (
            <div className="flex flex-col gap-3 border-t border-beige pt-3">
              <div>
                <label className="label" htmlFor="pp-motivation">¿Por qué te importa?</label>
                <textarea id="pp-motivation" name="motivation" className="textarea" rows={2} />
              </div>
              <div>
                <label className="label" htmlFor="pp-depth">Nivel deseado</label>
                <select id="pp-depth" name="depth" className="select" defaultValue="exploracion">
                  <option value="exploracion">Exploración</option>
                  <option value="fundamentos">Fundamentos</option>
                  <option value="aplicacion">Aplicación</option>
                  <option value="dominio">Dominio</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="pp-questions">Preguntas iniciales (una por línea)</label>
                <textarea id="pp-questions" name="keyQuestions" className="textarea" rows={2} />
              </div>
            </div>
          )}

          {type === "journal" && (
            <div className="grid grid-cols-2 gap-3 border-t border-beige pt-3">
              <div>
                <label className="label" htmlFor="pp-jdate">Fecha</label>
                <input id="pp-jdate" name="date" type="date" className="input" defaultValue={item.date ?? ""} />
              </div>
              <div>
                <label className="label" htmlFor="pp-template">Plantilla</label>
                <select id="pp-template" name="templateType" className="select" defaultValue="libre">
                  <option value="libre">Escritura libre</option>
                  <option value="diaria">Reflexión diaria</option>
                  <option value="semanal">Reset semanal</option>
                  <option value="gratitud">Gratitud</option>
                </select>
              </div>
            </div>
          )}

          {type === "decision" && (
            <div className="flex flex-col gap-3 border-t border-beige pt-3">
              <div>
                <label className="label" htmlFor="pp-reason">Razón</label>
                <textarea id="pp-reason" name="reason" className="textarea" rows={2} />
              </div>
              <div>
                <label className="label" htmlFor="pp-dproject">Proyecto</label>
                <select id="pp-dproject" name="projectId" className="select" defaultValue={item.projectId ?? ""}>
                  <option value="">Sin proyecto</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {type === "recurso" && (
            <div className="grid grid-cols-2 gap-3 border-t border-beige pt-3">
              <div className="col-span-2">
                <label className="label" htmlFor="pp-url">URL</label>
                <input id="pp-url" name="url" className="input" placeholder="https://" />
              </div>
              <div>
                <label className="label" htmlFor="pp-rtype">Tipo</label>
                <select id="pp-rtype" name="resourceType" className="select" defaultValue="articulo">
                  <option value="video">Video</option>
                  <option value="articulo">Artículo</option>
                  <option value="libro">Libro</option>
                  <option value="curso">Curso</option>
                  <option value="sitio">Sitio</option>
                  <option value="herramienta">Herramienta</option>
                  <option value="documento">Documento</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="pp-topic">Tema</label>
                <input id="pp-topic" name="topic" className="input" />
              </div>
              <div className="col-span-2">
                <label className="label" htmlFor="pp-rproject">Proyecto relacionado</label>
                <select id="pp-rproject" name="projectId" className="select" defaultValue={item.projectId ?? ""}>
                  <option value="">Sin proyecto</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {type === "evento" && (
            <div className="grid grid-cols-2 gap-3 border-t border-beige pt-3">
              <div className="col-span-2">
                <label className="label" htmlFor="pp-edate">Fecha</label>
                <input
                  id="pp-edate"
                  name="date"
                  type="date"
                  className="input"
                  required
                  defaultValue={item.date ?? ""}
                  data-testid="pp-event-date"
                />
              </div>
              <div>
                <label className="label" htmlFor="pp-estart">Hora de inicio</label>
                <input id="pp-estart" name="startTime" type="time" className="input" />
              </div>
              <div>
                <label className="label" htmlFor="pp-eend">Hora de fin</label>
                <input id="pp-eend" name="endTime" type="time" className="input" />
              </div>
              <div>
                <label className="label" htmlFor="pp-etype">Tipo</label>
                <select id="pp-etype" name="eventType" className="select" defaultValue="evento">
                  {EVENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="pp-eproject">Proyecto</label>
                <select id="pp-eproject" name="projectId" className="select" defaultValue={item.projectId ?? ""}>
                  <option value="">Sin proyecto</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>
              <p className="col-span-2 text-xs text-ink-green/70">
                Sin hora de inicio queda como evento de todo el día. Si Google Calendar está conectado, también
                aparecerá en el calendario «Mafer OS».
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2 border-t border-beige pt-4">
            <button type="submit" className="btn btn-primary" disabled={pending} data-testid="process-submit">
              {pending ? "Un momento…" : type ? `Convertir en ${TYPE_LABEL[type].toLowerCase()}` : "Guardar cambios"}
            </button>
            <div className="flex items-center justify-between gap-2">
              <button type="button" className="btn btn-ghost text-xs" onClick={onClose}>
                Dejar en Inbox
              </button>
              <button
                type="button"
                className="btn btn-ghost text-xs"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await archiveInboxItem(item.id);
                    toast.show({ message: "Captura archivada." });
                    onClose();
                  })
                }
              >
                <Archive size={13} aria-hidden /> Archivar
              </button>
              {confirmDelete ? (
                <span className="flex items-center gap-1.5">
                  <button
                    type="button"
                    className="btn btn-danger !py-1 !px-2 text-xs"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        await deleteInboxItem(item.id);
                        onClose();
                      })
                    }
                  >
                    Sí, eliminar
                  </button>
                  <button type="button" className="btn btn-ghost !py-1 !px-2 text-xs" onClick={() => setConfirmDelete(false)}>
                    No
                  </button>
                </span>
              ) : (
                <button type="button" className="btn btn-danger !py-1 !px-2 text-xs" onClick={() => setConfirmDelete(true)}>
                  <Trash2 size={13} aria-hidden /> Eliminar
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
