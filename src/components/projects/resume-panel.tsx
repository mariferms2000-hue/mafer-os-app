"use client";

import { useState, useTransition } from "react";
import {
  RotateCcw, ArrowRight, Ban, Hourglass, CalendarClock, Scale, NotebookPen,
  PencilLine, SquareKanban, Link2,
} from "lucide-react";
import Link from "next/link";
import { saveResumeNoteAction } from "@/lib/actions/projects";
import { openTaskUrl } from "@/components/tasks/task-detail";
import { MarkPriorityButton } from "@/components/tasks/priority-button";
import { NextActionPicker } from "./next-action";
import { useToast } from "@/components/ui/toast";

/** Todo serializable: lo calcula el servidor de forma transparente. */
export type ResumeData = {
  projectId: string;
  objective: string;
  statusLabel: string; // «Activo · 5 tareas abiertas»
  /** Dónde me quedé, ya reconstruido (o null si no hay datos suficientes). */
  whereIWas: string | null;
  lastActivityHuman: string;
  lastDecision: string | null;
  inProgressTask: { id: string; title: string } | null;
  nextAction: { id: string; title: string } | null; // tarjeta viva
  nextActionLegacy: string; // texto suelto
  blocked: { id: string; title: string; reason: string }[];
  waiting: { id: string; title: string; who: string }[];
  upcoming: { id: string; title: string; date: string }[];
  promptsCount: number;
  resourcesCount: number;
  links: { label: string; url: string }[];
  resumeNote: string;
  openTasks: { id: string; title: string }[];
};

/** «Retomar proyecto»: reconstruye el contexto en un vistazo y termina en UNA
 *  acción principal. No muestra secciones vacías ni inventa resúmenes. */
export function ResumePanel({ data, open }: { data: ResumeData; open: boolean }) {
  const [editingNote, setEditingNote] = useState(false);
  const [note, setNote] = useState(data.resumeNote);
  const [picker, setPicker] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();

  const item = (label: React.ReactNode, content: React.ReactNode) => (
    <div>
      <p className="label">{label}</p>
      <div className="text-sm text-stone">{content}</div>
    </div>
  );

  return (
    <details className="card mb-4 group" open={open} data-testid="resume-panel">
      <summary className="flex items-center gap-2 cursor-pointer list-none px-5 py-3.5 text-sm font-medium text-forest">
        <RotateCcw size={16} aria-hidden /> Retomar proyecto — ¿dónde me quedé?
        <span className="ml-auto text-stone-soft text-xs group-open:hidden">abrir</span>
      </summary>

      <div className="px-5 pb-5 flex flex-col gap-4 text-sm">
        <div className="grid gap-4 md:grid-cols-2">
          {data.objective && item("Objetivo", data.objective)}
          {item("Estado actual", data.statusLabel)}

          {item(
            "Dónde me quedé",
            data.whereIWas ? (
              <span className="text-ink-green" data-testid="where-i-was">{data.whereIWas}</span>
            ) : (
              <span data-testid="where-i-was-empty">
                No hay suficiente actividad registrada para reconstruir el punto exacto. Revisa el
                tablero, define la siguiente acción o añade una nota de contexto aquí abajo.
              </span>
            )
          )}
          {item("Última actividad", data.lastActivityHuman)}

          {data.lastDecision && item(<><Scale size={12} className="inline mr-1" aria-hidden />Última decisión</>, data.lastDecision)}
          {data.inProgressTask &&
            item(
              "En proceso ahora",
              <button type="button" className="underline underline-offset-4 hover:text-forest" onClick={() => openTaskUrl(data.inProgressTask!.id)}>
                {data.inProgressTask.title}
              </button>
            )}

          {data.blocked.length > 0 &&
            item(
              <><Ban size={12} className="inline mr-1" aria-hidden />Bloqueado</>,
              <ul className="flex flex-col gap-0.5">
                {data.blocked.map((b) => (
                  <li key={b.id}>
                    <button type="button" className="underline underline-offset-4 hover:text-forest text-left" onClick={() => openTaskUrl(b.id)}>
                      {b.title}
                    </button>{" "}
                    — {b.reason}
                  </li>
                ))}
              </ul>
            )}
          {data.waiting.length > 0 &&
            item(
              <><Hourglass size={12} className="inline mr-1" aria-hidden />Esperando a</>,
              <ul className="flex flex-col gap-0.5">
                {data.waiting.map((w) => (
                  <li key={w.id}>
                    {w.who} —{" "}
                    <button type="button" className="underline underline-offset-4 hover:text-forest" onClick={() => openTaskUrl(w.id)}>
                      {w.title}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          {data.upcoming.length > 0 &&
            item(
              <><CalendarClock size={12} className="inline mr-1" aria-hidden />Próximas fechas</>,
              <ul className="flex flex-col gap-0.5">
                {data.upcoming.map((u) => (
                  <li key={u.id}>
                    {u.date} —{" "}
                    <button type="button" className="underline underline-offset-4 hover:text-forest" onClick={() => openTaskUrl(u.id)}>
                      {u.title}
                    </button>
                  </li>
                ))}
              </ul>
            )}

          {(data.promptsCount > 0 || data.resourcesCount > 0 || data.links.length > 0) &&
            item(
              <><Link2 size={12} className="inline mr-1" aria-hidden />Vinculado</>,
              <span className="flex flex-wrap gap-1.5">
                {data.promptsCount > 0 && (
                  <Link href={`/biblioteca/prompts?proyecto=${data.projectId}`} className="chip hover:bg-sand">
                    {data.promptsCount} prompt{data.promptsCount !== 1 ? "s" : ""}
                  </Link>
                )}
                {data.resourcesCount > 0 && (
                  <Link href={`/biblioteca/recursos?proyecto=${data.projectId}`} className="chip hover:bg-sand">
                    {data.resourcesCount} recurso{data.resourcesCount !== 1 ? "s" : ""}
                  </Link>
                )}
                {data.links.map((l, i) => (
                  <a key={i} href={l.url} target="_blank" rel="noreferrer" className="chip hover:bg-sand">
                    {l.label || l.url}
                  </a>
                ))}
              </span>
            )}
        </div>

        {/* Nota manual de contexto */}
        <div>
          <p className="label flex items-center gap-1.5">
            <NotebookPen size={12} aria-hidden /> Contexto para retomar (tu nota)
          </p>
          {editingNote ? (
            <div className="flex flex-col gap-2">
              <textarea
                className="textarea text-sm"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="En tus palabras: dónde ibas, qué falta, qué NO hay que olvidar…"
                data-testid="resume-note-input"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-primary !py-1.5 text-xs"
                  disabled={pending}
                  data-testid="resume-note-save"
                  onClick={() =>
                    start(async () => {
                      try {
                        await saveResumeNoteAction(data.projectId, note);
                        toast.show({ message: "Contexto guardado ✓" });
                        setEditingNote(false);
                      } catch {
                        toast.show({ tone: "error", message: "No se pudo guardar la nota." });
                      }
                    })
                  }
                >
                  Guardar nota
                </button>
                <button type="button" className="btn btn-ghost !py-1.5 text-xs" onClick={() => { setNote(data.resumeNote); setEditingNote(false); }}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-stone">
              {data.resumeNote ? (
                <span className="whitespace-pre-wrap" data-testid="resume-note">{data.resumeNote}</span>
              ) : (
                <span className="text-stone-soft">Sin nota todavía.</span>
              )}{" "}
              <button type="button" className="underline underline-offset-4 text-xs hover:text-forest" onClick={() => setEditingNote(true)} data-testid="resume-note-edit">
                {data.resumeNote ? "Editar" : "Escribir nota"}
              </button>
            </p>
          )}
        </div>

        {/* Acción principal */}
        <div className="border-t border-beige pt-4" data-testid="resume-cta">
          {data.nextAction ? (
            <>
              <p className="text-base font-medium text-ink-green mb-2">
                <ArrowRight size={15} className="inline mr-1 text-olive" aria-hidden />
                Continuar con: «{data.nextAction.title}»
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary !py-2 text-sm" onClick={() => openTaskUrl(data.nextAction!.id)} data-testid="resume-open-task">
                  <PencilLine size={14} aria-hidden /> Abrir tarea
                </button>
                <MarkPriorityButton cardId={data.nextAction.id} className="btn btn-secondary !py-2 text-sm" />
                <a href="#tablero" className="btn btn-secondary !py-2 text-sm">
                  <SquareKanban size={14} aria-hidden /> Ver tablero
                </a>
                <button type="button" className="btn btn-ghost !py-2 text-sm" onClick={() => setPicker(true)} data-testid="resume-edit-next">
                  Editar siguiente acción
                </button>
              </div>
            </>
          ) : data.nextActionLegacy ? (
            <>
              <p className="text-base font-medium text-ink-green mb-2">Continuar con: «{data.nextActionLegacy}»</p>
              <button type="button" className="btn btn-primary !py-2 text-sm" onClick={() => setPicker(true)} data-testid="define-next-action-resume">
                Vincularla a una tarea real
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-stone mb-2" data-testid="resume-no-next">
                Este proyecto todavía no tiene una próxima acción concreta.
              </p>
              <button type="button" className="btn btn-primary !py-2 text-sm" onClick={() => setPicker(true)} data-testid="define-next-action-resume">
                Definir siguiente acción
              </button>
            </>
          )}
        </div>
      </div>

      {picker && <NextActionPicker projectId={data.projectId} openTasks={data.openTasks} onClose={() => setPicker(false)} />}
    </details>
  );
}
