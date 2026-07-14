"use client";

import { useState, useTransition } from "react";
import {
  X,
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
  MoreHorizontal,
} from "lucide-react";
import {
  convertInboxItem,
  updateInboxItem,
  archiveInboxItem,
  deleteInboxItem,
} from "@/lib/actions/inbox";
import { useToast } from "@/components/ui/toast";
import type { schema } from "@/lib/db";

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
];

const TYPE_LABEL = Object.fromEntries(TYPES.map((t) => [t.value, t.label]));

export function InboxList({ items, projects }: { items: Item[]; projects: Project[] }) {
  const [openItem, setOpenItem] = useState<Item | null>(null);

  return (
    <>
      <ul className="flex flex-col gap-2.5" data-testid="inbox-list">
        {items.map((item) => (
          <InboxCard key={item.id} item={item} onProcess={() => setOpenItem(item)} />
        ))}
      </ul>
      {openItem && (
        <ProcessPanel
          item={openItem}
          projects={projects}
          onClose={() => setOpenItem(null)}
        />
      )}
    </>
  );
}

function InboxCard({ item, onProcess }: { item: Item; onProcess: () => void }) {
  const [menu, setMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();

  function toggleMenu() {
    setMenu((m) => !m);
    setConfirmDelete(false);
  }

  return (
    <li className="card p-4 flex items-start gap-3" data-testid="inbox-item">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{item.content}</p>
        {item.note && <p className="text-sm text-stone mt-0.5 line-clamp-1">{item.note}</p>}
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          <span className="chip">{item.createdAt.slice(0, 10)}</span>
          {item.typeHint && <span className="chip chip-sage">{TYPE_LABEL[item.typeHint] ?? item.typeHint}</span>}
          {item.isStarter && <span className="chip">Ejemplo</span>}
        </div>
      </div>
      <button
        type="button"
        className="btn btn-primary !py-1.5 !px-3.5 text-sm shrink-0"
        onClick={onProcess}
        data-testid="inbox-process"
      >
        <Sparkles size={14} aria-hidden /> Procesar
      </button>
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
    </li>
  );
}

/** Panel de procesado: lateral en desktop, bottom sheet en móvil.
 *  Progressive disclosure: primero «¿Qué es esto?», luego solo los campos del tipo. */
function ProcessPanel({
  item,
  projects,
  onClose,
}: {
  item: Item;
  projects: Project[];
  onClose: () => void;
}) {
  const [type, setType] = useState<string | null>(item.typeHint || null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();

  return (
    <div
      className="fixed inset-0 z-50 bg-charcoal/30 backdrop-blur-sm flex items-end md:items-stretch md:justify-end"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Procesar «${item.content}»`}
        className="card w-full md:w-[440px] md:h-full max-h-[92dvh] md:max-h-none overflow-y-auto rounded-b-none md:rounded-none md:rounded-l-[18px] p-5 pb-safe"
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
                await convertInboxItem(fd);
                toast.show({
                  message: `Convertido en ${TYPE_LABEL[type].toLowerCase()} ✓`,
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
              <div>
                <label className="label" htmlFor="pp-date">Fecha</label>
                <input id="pp-date" name="date" type="date" className="input" defaultValue={item.date ?? ""} />
              </div>
              <div>
                <label className="label" htmlFor="pp-duration">Duración</label>
                <select id="pp-duration" name="duration" className="select" defaultValue="">
                  <option value="">Sin estimar</option>
                  <option value="5m">5 min</option>
                  <option value="15m">15 min</option>
                  <option value="30m">30 min</option>
                  <option value="60m">1 hora</option>
                  <option value="deep">Profundo</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="label" htmlFor="pp-next">Siguiente acción</label>
                <input id="pp-next" name="nextAction" className="input" placeholder="El primer paso visible" />
              </div>
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
