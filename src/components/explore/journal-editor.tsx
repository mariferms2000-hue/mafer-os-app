"use client";

import { useState, useTransition } from "react";
import { Star, Trash2, Check } from "lucide-react";
import {
  updateJournalAction,
  toggleJournalFavoriteAction,
  deleteJournalAction,
} from "@/lib/actions/explore";
import { TEMPLATE_LABEL, TEMPLATE_PROMPTS } from "./journal-labels";
import type { schema } from "@/lib/db";

type Entry = typeof schema.journalEntries.$inferSelect;

export function JournalEditor({ entry }: { entry: Entry }) {
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [template, setTemplate] = useState(entry.templateType ?? "libre");

  return (
    <form
      action={(fd) =>
        start(async () => {
          await updateJournalAction(fd);
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        })
      }
      className="card p-5 md:p-7 flex flex-col gap-4"
    >
      <input type="hidden" name="id" value={entry.id} />
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor="je-title">Título</label>
        <input id="je-title" name="title" className="input !border-0 !bg-transparent !px-0 text-2xl font-display" defaultValue={entry.title} data-testid="journal-title" />
        <button
          type="button"
          aria-label={entry.favorite ? "Quitar de favoritas" : "Marcar favorita"}
          className="btn btn-ghost !p-2 shrink-0"
          disabled={pending}
          onClick={() => start(() => toggleJournalFavoriteAction(entry.id))}
        >
          <Star size={18} className={entry.favorite ? "text-waiting fill-current" : ""} aria-hidden />
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <input name="date" type="date" className="input !w-auto !min-h-9 text-sm" defaultValue={entry.date} aria-label="Fecha" />
        <select
          name="templateType"
          className="select !w-auto !min-h-9 text-sm"
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          aria-label="Tipo de entrada"
        >
          {Object.entries(TEMPLATE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select name="mood" className="select !w-auto !min-h-9 text-sm" defaultValue={entry.mood ?? ""} aria-label="Ánimo (opcional)">
          <option value="">Ánimo (opcional)</option>
          <option value="ligero">Ligero 🌤</option>
          <option value="neutral">Neutral 🌫</option>
          <option value="pesado">Pesado 🌧</option>
        </select>
      </div>
      <label className="sr-only" htmlFor="je-body">Texto</label>
      <textarea
        id="je-body"
        name="body"
        className="textarea !border-0 !bg-transparent !px-0 text-[15px] leading-relaxed"
        rows={14}
        defaultValue={entry.body ?? ""}
        placeholder={TEMPLATE_PROMPTS[template]}
        data-testid="journal-body"
      />
      <div>
        <label className="label" htmlFor="je-tags">Etiquetas (separadas por coma)</label>
        <input id="je-tags" name="tags" className="input !min-h-9 text-sm" defaultValue={(entry.tags ?? []).join(", ")} />
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-beige pt-4">
        <button type="submit" className="btn btn-primary" disabled={pending} data-testid="journal-save">
          {pending ? "Guardando…" : saved ? <><Check size={15} aria-hidden /> Guardado</> : "Guardar"}
        </button>
        {confirmDelete ? (
          <span className="flex items-center gap-2">
            <span className="text-xs text-stone">¿Segura?</span>
            <button type="button" className="btn btn-danger !py-1.5 text-xs" disabled={pending}
              onClick={() => start(() => deleteJournalAction(entry.id))}>
              Sí, eliminar
            </button>
            <button type="button" className="btn btn-ghost !py-1.5 text-xs" onClick={() => setConfirmDelete(false)}>No</button>
          </span>
        ) : (
          <button type="button" className="btn btn-ghost !py-1.5 text-xs" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={14} aria-hidden /> Eliminar
          </button>
        )}
      </div>
    </form>
  );
}
