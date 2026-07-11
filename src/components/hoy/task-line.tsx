"use client";

import { useTransition } from "react";
import { Circle, CheckCircle2, Clock, Zap, CalendarClock, Ban, Hourglass } from "lucide-react";
import Link from "next/link";
import { completeCardAction } from "@/lib/actions/cards";
import type { CardRow } from "@/lib/queries/today";

export const DURATION_LABEL: Record<string, string> = {
  "5m": "5 min",
  "15m": "15 min",
  "30m": "30 min",
  "60m": "1 hora",
  deep: "Trabajo profundo",
};

/** Línea de tarea reutilizable: check + título + chips de contexto. */
export function TaskLine({ card, showProject = true }: { card: CardRow; showProject?: boolean }) {
  const [pending, start] = useTransition();
  const done = Boolean(card.completedAt);

  return (
    <div className="flex items-start gap-2.5 py-2 group">
      <button
        type="button"
        aria-label={done ? `Reabrir «${card.title}»` : `Completar «${card.title}»`}
        disabled={pending}
        onClick={() => start(() => completeCardAction(card.id, !done))}
        className="mt-0.5 text-sage-deep hover:text-forest transition-colors shrink-0"
      >
        {done ? <CheckCircle2 size={19} aria-hidden /> : <Circle size={19} aria-hidden />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`text-sm leading-snug ${done ? "line-through text-stone-soft" : "text-charcoal"}`}>
          {card.title}
        </p>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {showProject && card.projectTitle && card.projectId && (
            <Link href={`/proyectos/${card.projectId}`} className="chip hover:bg-sand">
              {card.projectTitle}
            </Link>
          )}
          {card.duration && (
            <span className="chip">
              <Clock size={11} aria-hidden /> {DURATION_LABEL[card.duration] ?? card.duration}
            </span>
          )}
          {card.energy && (
            <span className="chip">
              <Zap size={11} aria-hidden /> Energía {card.energy}
            </span>
          )}
          {card.dueDate && (
            <span className="chip">
              <CalendarClock size={11} aria-hidden /> {card.dueDate}
            </span>
          )}
          {card.blockedReason && (
            <span className="chip chip-blocked">
              <Ban size={11} aria-hidden /> {card.blockedReason}
            </span>
          )}
          {card.waitingFor && (
            <span className="chip chip-waiting">
              <Hourglass size={11} aria-hidden /> Espera: {card.waitingFor}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
