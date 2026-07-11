"use client";

import { useState, useTransition } from "react";
import { ArchiveRestore, Trash2 } from "lucide-react";
import { archiveCardAction, deleteCardAction } from "@/lib/actions/cards";
import { useToast } from "@/components/ui/toast";
import type { CardRow } from "@/lib/queries/today";

export function ArchivedLine({ card }: { card: CardRow }) {
  const [pending, start] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const toast = useToast();

  return (
    <div className="flex items-center gap-2.5 py-2 flex-wrap">
      <p className="text-sm text-stone flex-1 min-w-0 truncate">{card.title}</p>
      {card.projectTitle && <span className="chip shrink-0">{card.projectTitle}</span>}
      <button
        type="button"
        className="btn btn-ghost !py-1 !px-2 text-xs shrink-0"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await archiveCardAction(card.id, false);
            toast.show({ message: "Tarea restaurada del archivo." });
          })
        }
      >
        <ArchiveRestore size={13} aria-hidden /> Restaurar
      </button>
      {confirmDelete ? (
        <span className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-stone">¿Definitivo?</span>
          <button
            type="button"
            className="btn btn-danger !py-1 !px-2 text-xs"
            disabled={pending}
            onClick={() => start(() => deleteCardAction(card.id))}
          >
            Sí, eliminar
          </button>
          <button type="button" className="btn btn-ghost !py-1 !px-2 text-xs" onClick={() => setConfirmDelete(false)}>
            No
          </button>
        </span>
      ) : (
        <button
          type="button"
          aria-label={`Eliminar definitivamente «${card.title}»`}
          className="btn btn-ghost !p-1.5 shrink-0"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 size={14} aria-hidden />
        </button>
      )}
    </div>
  );
}
