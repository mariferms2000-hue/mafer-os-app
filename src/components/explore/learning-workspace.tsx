"use client";

import { useState, useTransition } from "react";
import { Plus, X, Trash2, ExternalLink } from "lucide-react";
import {
  updateLearningAction,
  setLearningExercisesAction,
  deleteLearningAction,
} from "@/lib/actions/explore";
import { createResourceAction } from "@/lib/actions/library";
import type { schema } from "@/lib/db";
import type { ChecklistItem } from "@/lib/db/schema";

type Topic = typeof schema.learningTopics.$inferSelect;
type Resource = typeof schema.resources.$inferSelect;

export function LearningWorkspace({ topic, resources }: { topic: Topic; resources: Resource[] }) {
  const [pending, start] = useTransition();
  const [exercises, setExercises] = useState<ChecklistItem[]>(topic.exercises ?? []);
  const [newEx, setNewEx] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  function saveExercises(next: ChecklistItem[]) {
    setExercises(next);
    start(() => setLearningExercisesAction(topic.id, next));
  }

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <form
        action={(fd) => start(() => updateLearningAction(fd))}
        className="lg:col-span-2 card p-5 flex flex-col gap-4"
      >
        <input type="hidden" name="id" value={topic.id} />
        <div>
          <label className="label" htmlFor="lw-title">Tema</label>
          <input id="lw-title" name="title" className="input text-lg font-medium" defaultValue={topic.title} />
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="lw-motivation">¿Por qué me importa?</label>
            <textarea id="lw-motivation" name="motivation" className="textarea" rows={2} defaultValue={topic.motivation ?? ""} />
          </div>
          <div>
            <label className="label" htmlFor="lw-outcome">¿Qué significa «suficientemente bueno»?</label>
            <textarea id="lw-outcome" name="outcome" className="textarea" rows={2} defaultValue={topic.outcome ?? ""} />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="label" htmlFor="lw-depth">Profundidad</label>
            <select id="lw-depth" name="depth" className="select" defaultValue={topic.depth ?? "exploracion"}>
              <option value="exploracion">Exploración</option>
              <option value="fundamentos">Fundamentos</option>
              <option value="aplicacion">Aplicación</option>
              <option value="dominio">Dominio</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="lw-status">Estado</label>
            <select id="lw-status" name="status" className="select" defaultValue={topic.status}>
              <option value="idea">Idea</option>
              <option value="activo">Activo</option>
              <option value="pausado">Pausado</option>
              <option value="terminado">Terminado</option>
              <option value="archivado">Archivado</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="lw-evidence">Tipo de evidencia</label>
            <select id="lw-evidence" name="evidenceClass" className="select" defaultValue={topic.evidenceClass ?? "sin-clasificar"}>
              <option value="sin-clasificar">Sin clasificar</option>
              <option value="evidencia-solida">Evidencia sólida</option>
              <option value="evidencia-limitada">Evidencia limitada</option>
              <option value="marco-tradicional">Marco tradicional</option>
              <option value="hipotesis">Hipótesis</option>
              <option value="reflexion-personal">Reflexión personal</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="lw-progress">Progreso %</label>
            <input id="lw-progress" name="progress" type="number" min={0} max={100} className="input" defaultValue={topic.progress ?? 0} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="lw-questions">Preguntas clave (una por línea)</label>
          <textarea id="lw-questions" name="keyQuestions" className="textarea" rows={3} defaultValue={(topic.keyQuestions ?? []).join("\n")} />
        </div>
        <fieldset className="border border-sand rounded-xl p-3">
          <legend className="label !mb-0 px-1">Sprint actual</legend>
          <div className="grid md:grid-cols-3 gap-3 mt-1">
            <div className="md:col-span-3">
              <label className="label" htmlFor="lw-sprint-goal">Meta del sprint</label>
              <input id="lw-sprint-goal" name="sprintGoal" className="input" defaultValue={topic.sprint?.goal ?? ""} placeholder="Ej.: entender los fundamentos y hacer un primer ejercicio real" />
            </div>
            <div>
              <label className="label" htmlFor="lw-sprint-start">Empieza</label>
              <input id="lw-sprint-start" name="sprintStart" type="date" className="input" defaultValue={topic.sprint?.start ?? ""} />
            </div>
            <div>
              <label className="label" htmlFor="lw-sprint-end">Termina</label>
              <input id="lw-sprint-end" name="sprintEnd" type="date" className="input" defaultValue={topic.sprint?.end ?? ""} />
            </div>
            <div>
              <label className="label" htmlFor="lw-review">Próxima revisión</label>
              <input id="lw-review" name="reviewDate" type="date" className="input" defaultValue={topic.reviewDate ?? ""} />
            </div>
          </div>
        </fieldset>
        <div>
          <label className="label" htmlFor="lw-notes">Notas</label>
          <textarea id="lw-notes" name="notes" className="textarea" rows={5} defaultValue={topic.notes ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="lw-result">Resultado / entregable final</label>
          <textarea id="lw-result" name="result" className="textarea" rows={2} defaultValue={topic.result ?? ""} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={pending} data-testid="learning-save">
          {pending ? "Guardando…" : "Guardar"}
        </button>
      </form>

      <div className="flex flex-col gap-5">
        <section className="card p-5">
          <h2 className="text-base font-body font-semibold text-ink-green mb-2">Ejercicios y práctica</h2>
          <ul className="flex flex-col gap-1.5">
            {exercises.map((ex) => (
              <li key={ex.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`ex-${ex.id}`}
                  checked={ex.done}
                  onChange={() => saveExercises(exercises.map((i) => (i.id === ex.id ? { ...i, done: !i.done } : i)))}
                  className="h-4 w-4 accent-[#45573f]"
                />
                <label htmlFor={`ex-${ex.id}`} className={`text-sm flex-1 ${ex.done ? "line-through text-stone-soft" : ""}`}>
                  {ex.text}
                </label>
                <button type="button" aria-label={`Eliminar «${ex.text}»`} className="text-stone-soft hover:text-blocked"
                  onClick={() => saveExercises(exercises.filter((i) => i.id !== ex.id))}>
                  <X size={14} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2 mt-2">
            <input
              className="input !min-h-9 text-sm"
              placeholder="Nuevo ejercicio…"
              value={newEx}
              onChange={(e) => setNewEx(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newEx.trim()) {
                  e.preventDefault();
                  saveExercises([...exercises, { id: crypto.randomUUID(), text: newEx.trim(), done: false }]);
                  setNewEx("");
                }
              }}
            />
            <button type="button" className="btn btn-secondary !min-h-9" disabled={!newEx.trim()}
              onClick={() => {
                saveExercises([...exercises, { id: crypto.randomUUID(), text: newEx.trim(), done: false }]);
                setNewEx("");
              }}>
              <Plus size={15} aria-hidden />
            </button>
          </div>
        </section>

        <section className="card p-5">
          <h2 className="text-base font-body font-semibold text-ink-green mb-2">Recursos</h2>
          <ul className="flex flex-col gap-2 mb-3">
            {resources.map((r) => (
              <li key={r.id} className="text-sm flex items-center gap-2">
                {r.url ? (
                  <a href={r.url} target="_blank" rel="noreferrer" className="text-forest underline underline-offset-4 truncate inline-flex items-center gap-1">
                    {r.title} <ExternalLink size={12} aria-hidden />
                  </a>
                ) : (
                  <span className="truncate">{r.title}</span>
                )}
                <span className="chip ml-auto shrink-0 capitalize">{r.type}</span>
              </li>
            ))}
            {resources.length === 0 && <li className="text-sm text-stone-soft">Aún sin recursos.</li>}
          </ul>
          <form action={(fd) => start(() => createResourceAction(fd))} className="flex flex-col gap-2">
            <input type="hidden" name="learningId" value={topic.id} />
            <input name="title" className="input !min-h-9 text-sm" placeholder="Título del recurso" required />
            <input name="url" className="input !min-h-9 text-sm" placeholder="https:// (opcional)" />
            <button type="submit" className="btn btn-secondary !min-h-9 text-sm" disabled={pending}>
              <Plus size={14} aria-hidden /> Añadir recurso
            </button>
          </form>
        </section>

        <section className="card p-4">
          {confirmDelete ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-stone">¿Eliminar este tema y su contenido?</span>
              <button type="button" className="btn btn-danger !py-1.5 text-xs" disabled={pending}
                onClick={() => start(() => deleteLearningAction(topic.id))}>
                Sí, eliminar
              </button>
              <button type="button" className="btn btn-ghost !py-1.5 text-xs" onClick={() => setConfirmDelete(false)}>No</button>
            </div>
          ) : (
            <button type="button" className="btn btn-danger !py-1.5 text-xs" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={14} aria-hidden /> Eliminar tema
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
