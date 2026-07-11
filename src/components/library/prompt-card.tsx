"use client";

import { useState, useTransition } from "react";
import { Copy, Check, Star, Trash2, Pencil, Files, Download } from "lucide-react";
import {
  updatePromptAction,
  duplicatePromptAction,
  togglePromptFavoriteAction,
  deletePromptAction,
} from "@/lib/actions/library";
import type { schema } from "@/lib/db";

type Prompt = typeof schema.prompts.$inferSelect;

export function PromptCard({ prompt }: { prompt: Prompt }) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();

  async function copy() {
    await navigator.clipboard.writeText(prompt.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  function exportMd() {
    const md = `# ${prompt.title}\n\n- Herramienta: ${prompt.tool}\n- Categoría: ${prompt.category}\n- Versión: ${prompt.version}\n- Propósito: ${prompt.purpose}\n- Archivos necesarios: ${prompt.requiredFiles || "ninguno"}\n- Resultado esperado: ${prompt.expectedOutput}\n\n## Prompt\n\n\`\`\`\n${prompt.body}\n\`\`\`\n`;
    const blob = new Blob([md], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${prompt.title.toLowerCase().replace(/[^a-z0-9áéíóúñ]+/gi, "-")}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <li className="card p-4" data-testid="prompt-card">
      <div className="flex flex-wrap items-center gap-2 mb-1.5">
        <h3 className="text-sm font-semibold flex-1">{prompt.title}</h3>
        <span className="chip">{prompt.tool}</span>
        <span className="chip chip-sage">{prompt.category}</span>
        <span className="chip">v{prompt.version}</span>
        {prompt.isStarter && <span className="chip">Ejemplo</span>}
      </div>
      {prompt.purpose && <p className="text-sm text-stone mb-2">{prompt.purpose}</p>}
      <pre className="bg-beige/70 border border-sand rounded-xl p-3 text-xs whitespace-pre-wrap max-h-44 overflow-y-auto font-mono">
        {prompt.body}
      </pre>
      {(prompt.requiredFiles || prompt.expectedOutput) && (
        <div className="text-xs text-stone mt-2 flex flex-col gap-0.5">
          {prompt.requiredFiles && <p><strong>Necesita:</strong> {prompt.requiredFiles}</p>}
          {prompt.expectedOutput && <p><strong>Devuelve:</strong> {prompt.expectedOutput}</p>}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5 mt-3">
        <button type="button" className="btn btn-primary !py-1.5 !px-3 text-xs" onClick={copy} data-testid="prompt-copy">
          {copied ? <><Check size={13} aria-hidden /> Copiado</> : <><Copy size={13} aria-hidden /> Copiar</>}
        </button>
        <button type="button" className="btn btn-ghost !py-1.5 !px-2.5 text-xs" onClick={() => setEditing(!editing)}>
          <Pencil size={13} aria-hidden /> Editar
        </button>
        <button type="button" className="btn btn-ghost !py-1.5 !px-2.5 text-xs" disabled={pending}
          onClick={() => start(() => duplicatePromptAction(prompt.id))}>
          <Files size={13} aria-hidden /> Duplicar
        </button>
        <button type="button" className="btn btn-ghost !py-1.5 !px-2.5 text-xs" onClick={exportMd}>
          <Download size={13} aria-hidden /> .md
        </button>
        <button
          type="button"
          aria-label={prompt.favorite ? "Quitar de favoritos" : "Marcar favorito"}
          className="btn btn-ghost !p-2 ml-auto"
          disabled={pending}
          onClick={() => start(() => togglePromptFavoriteAction(prompt.id))}
        >
          <Star size={15} className={prompt.favorite ? "text-waiting fill-current" : ""} aria-hidden />
        </button>
        {confirmDelete ? (
          <span className="flex items-center gap-1.5">
            <button type="button" className="btn btn-danger !py-1 !px-2 text-xs" disabled={pending}
              onClick={() => start(() => deletePromptAction(prompt.id))}>
              Eliminar
            </button>
            <button type="button" className="btn btn-ghost !py-1 !px-2 text-xs" onClick={() => setConfirmDelete(false)}>No</button>
          </span>
        ) : (
          <button type="button" aria-label="Eliminar prompt" className="btn btn-ghost !p-2" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={15} aria-hidden />
          </button>
        )}
      </div>

      {editing && (
        <form
          action={(fd) =>
            start(async () => {
              await updatePromptAction(fd);
              setEditing(false);
            })
          }
          className="mt-3 border-t border-beige pt-3 flex flex-col gap-2.5"
        >
          <input type="hidden" name="id" value={prompt.id} />
          <input name="title" className="input !min-h-9 text-sm" defaultValue={prompt.title} aria-label="Título" />
          <textarea name="body" className="textarea font-mono text-xs" rows={8} defaultValue={prompt.body} aria-label="Prompt" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <input name="tool" className="input !min-h-9 text-sm" defaultValue={prompt.tool ?? ""} aria-label="Herramienta" placeholder="Herramienta" />
            <input name="category" className="input !min-h-9 text-sm" defaultValue={prompt.category ?? ""} aria-label="Categoría" placeholder="Categoría" />
            <input name="version" className="input !min-h-9 text-sm" defaultValue={prompt.version ?? "1.0"} aria-label="Versión" placeholder="Versión" />
            <input name="requiredFiles" className="input !min-h-9 text-sm" defaultValue={prompt.requiredFiles ?? ""} aria-label="Archivos necesarios" placeholder="Archivos necesarios" />
          </div>
          <input name="expectedOutput" className="input !min-h-9 text-sm" defaultValue={prompt.expectedOutput ?? ""} aria-label="Resultado esperado" placeholder="Resultado esperado" />
          <textarea name="notes" className="textarea text-sm" rows={2} defaultValue={prompt.notes ?? ""} aria-label="Notas" placeholder="Notas" />
          <button type="submit" className="btn btn-primary !py-1.5 text-sm self-start" disabled={pending}>
            Guardar cambios
          </button>
        </form>
      )}
    </li>
  );
}
