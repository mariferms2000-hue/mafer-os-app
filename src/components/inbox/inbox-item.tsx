"use client";

import { useState, useTransition } from "react";
import { Trash2, ArrowRight } from "lucide-react";
import { convertInboxItem, deleteInboxItem } from "@/lib/actions/inbox";
import type { schema } from "@/lib/db";

type Item = typeof schema.inboxItems.$inferSelect;

const TARGETS = [
  { value: "tarea", label: "Tarea" },
  { value: "proyecto", label: "Proyecto" },
  { value: "idea", label: "Idea (Incubadora)" },
  { value: "aprendizaje", label: "Learn Fast" },
  { value: "journal", label: "Journal" },
  { value: "decision", label: "Decisión" },
  { value: "recurso", label: "Recurso" },
];

export function InboxItem({
  item,
  projects,
}: {
  item: Item;
  projects: { id: string; title: string }[];
}) {
  const [target, setTarget] = useState(item.typeHint && item.typeHint !== "" ? item.typeHint : "tarea");
  const [pending, start] = useTransition();

  return (
    <li className="card p-4" data-testid="inbox-item">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{item.content}</p>
          {item.note && <p className="text-sm text-stone mt-0.5 whitespace-pre-wrap">{item.note}</p>}
          <div className="flex gap-1.5 mt-1.5">
            <span className="chip">{item.createdAt.slice(0, 10)}</span>
            {item.typeHint && <span className="chip chip-sage capitalize">{item.typeHint}</span>}
            {item.isStarter && <span className="chip">Ejemplo</span>}
          </div>
        </div>
        <button
          type="button"
          aria-label={`Eliminar «${item.content}»`}
          className="btn btn-ghost !p-2 shrink-0"
          disabled={pending}
          onClick={() => start(() => deleteInboxItem(item.id))}
        >
          <Trash2 size={16} aria-hidden />
        </button>
      </div>

      <form
        action={(fd) => start(() => convertInboxItem(fd))}
        className="mt-3 flex flex-wrap items-center gap-2"
      >
        <input type="hidden" name="id" value={item.id} />
        <label className="sr-only" htmlFor={`target-${item.id}`}>Convertir en</label>
        <select
          id={`target-${item.id}`}
          name="target"
          className="select !w-auto !min-h-9 text-sm"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          data-testid="inbox-target"
        >
          {TARGETS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        {target === "tarea" && (
          <>
            <label className="sr-only" htmlFor={`proj-${item.id}`}>Proyecto</label>
            <select id={`proj-${item.id}`} name="projectId" className="select !w-auto !min-h-9 text-sm" defaultValue={item.projectId ?? ""}>
              <option value="">Sin proyecto</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </>
        )}
        <button type="submit" className="btn btn-primary !min-h-9 !py-1.5 text-sm" disabled={pending} data-testid="inbox-convert">
          <ArrowRight size={14} aria-hidden /> {pending ? "Convirtiendo…" : "Convertir"}
        </button>
      </form>
    </li>
  );
}
