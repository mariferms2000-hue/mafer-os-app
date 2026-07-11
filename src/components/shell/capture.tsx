"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Plus,
  X,
  Check,
  Inbox,
  CircleCheckBig,
  SquareKanban,
  CalendarDays,
  NotebookPen,
  Lightbulb,
} from "lucide-react";
import { captureAction } from "@/lib/actions/inbox";
import { NewTaskModal, type ProjectOption } from "@/components/tasks/new-task";
import { NewCapturePanel } from "@/components/inbox/quick-capture";

const TYPES = [
  { value: "", label: "Sin clasificar" },
  { value: "tarea", label: "Tarea" },
  { value: "idea", label: "Idea" },
  { value: "proyecto", label: "Proyecto" },
  { value: "aprendizaje", label: "Aprendizaje" },
  { value: "journal", label: "Journal" },
  { value: "decision", label: "Decisión" },
  { value: "recurso", label: "Recurso" },
];

/** Botón flotante global: abre un menú explícito — nunca crea algo sin decir qué.
 *  Contextual: dentro del Inbox, una sola pulsación abre directamente «Nueva captura». */
export function CaptureFab({ projects }: { projects: ProjectOption[] }) {
  const [menu, setMenu] = useState(false);
  const [modal, setModal] = useState<"captura" | "tarea" | "captura-inbox" | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const enInbox = pathname.startsWith("/inbox");

  const go = (href: string) => {
    setMenu(false);
    router.push(href);
  };

  const ACTIONS = [
    { key: "captura", label: "Nueva captura", hint: "Al Inbox, sin pensar", icon: Inbox, onClick: () => { setMenu(false); setModal("captura"); }, testid: "fab-captura" },
    { key: "tarea", label: "Nueva tarea", hint: "Con proyecto y fecha", icon: CircleCheckBig, onClick: () => { setMenu(false); setModal("tarea"); }, testid: "fab-tarea" },
    { key: "proyecto", label: "Nuevo proyecto", hint: "Con su tablero", icon: SquareKanban, onClick: () => go("/proyectos?nuevo=1"), testid: "fab-proyecto" },
    { key: "evento", label: "Nuevo evento", hint: "Reunión o fecha", icon: CalendarDays, onClick: () => go("/calendario?nuevo=1"), testid: "fab-evento" },
    { key: "journal", label: "Nota de journal", hint: "Pensar por escrito", icon: NotebookPen, onClick: () => go("/explorar/journal?nueva=1"), testid: "fab-journal" },
    { key: "idea", label: "Nueva idea", hint: "A la incubadora", icon: Lightbulb, onClick: () => go("/explorar?nueva=1"), testid: "fab-idea" },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (enInbox) {
            setModal("captura-inbox");
          } else {
            setMenu((m) => !m);
          }
        }}
        aria-label={enInbox ? "Nueva captura" : menu ? "Cerrar menú de creación" : "Crear algo nuevo"}
        aria-expanded={enInbox ? undefined : menu}
        className={`fixed z-50 bottom-20 right-4 md:bottom-8 md:right-8 h-14 w-14 rounded-full bg-forest text-cream shadow-lift flex items-center justify-center hover:bg-forest-deep transition-transform ${
          menu ? "rotate-45" : ""
        }`}
        data-testid="capture-fab"
      >
        <Plus size={26} aria-hidden />
      </button>

      {menu && (
        <div
          className="fixed inset-0 z-40 bg-charcoal/20"
          onClick={() => setMenu(false)}
          role="presentation"
        >
          <div
            role="menu"
            aria-label="Crear"
            className="absolute bottom-36 right-4 md:bottom-24 md:right-8 card p-2 flex flex-col gap-0.5 w-64 shadow-lift"
            onClick={(e) => e.stopPropagation()}
          >
            {ACTIONS.map(({ key, label, hint, icon: Icon, onClick, testid }) => (
              <button
                key={key}
                type="button"
                role="menuitem"
                onClick={onClick}
                data-testid={testid}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-sage-soft transition-colors"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-beige text-forest shrink-0">
                  <Icon size={16} aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="block text-xs text-stone">{hint}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {modal === "captura" && <CaptureModal projects={projects} onClose={() => setModal(null)} />}
      {modal === "captura-inbox" && <NewCapturePanel onClose={() => setModal(null)} />}
      {modal === "tarea" && <NewTaskModal projects={projects} onClose={() => setModal(null)} />}
    </>
  );
}

function CaptureModal({ projects, onClose }: { projects: ProjectOption[]; onClose: () => void }) {
  const [saved, setSaved] = useState(false);
  const [more, setMore] = useState(false);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function submit(formData: FormData) {
    startTransition(async () => {
      await captureAction(formData);
      formRef.current?.reset();
      setMore(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    });
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
        aria-label="Capturar en el Inbox"
        className="card w-full md:max-w-lg rounded-b-none md:rounded-b-[18px] p-5 pb-safe"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg text-forest-deep">Capturar</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="btn btn-ghost !p-2">
            <X size={18} aria-hidden />
          </button>
        </div>
        <form ref={formRef} action={submit} className="flex flex-col gap-3">
          <textarea
            name="content"
            className="textarea"
            placeholder="Escribe lo que tengas en mente… se guarda en tu Inbox."
            required
            autoFocus
            rows={3}
            data-testid="capture-input"
          />
          {more && (
            <>
              <textarea name="note" className="textarea" rows={2} placeholder="Nota adicional (opcional)" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="cap-type">Tipo</label>
                  <select id="cap-type" name="typeHint" className="select">
                    {TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="cap-date">Fecha</label>
                  <input id="cap-date" name="date" type="date" className="input" />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="cap-project">Proyecto</label>
                <select id="cap-project" name="projectId" className="select">
                  <option value="">Sin proyecto</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>
            </>
          )}
          <div className="flex items-center gap-2">
            <button type="submit" className="btn btn-primary flex-1" disabled={pending} data-testid="capture-save">
              {pending ? "Guardando…" : saved ? "Guardado ✓" : "Guardar en Inbox"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setMore((m) => !m)}>
              {more ? "Menos" : "Detalles"}
            </button>
          </div>
          {saved && (
            <p className="text-sm text-done flex items-center gap-1.5" role="status">
              <Check size={15} aria-hidden /> Capturado. Puedes seguir escribiendo o cerrar.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
