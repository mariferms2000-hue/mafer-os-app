"use client";

import { CalendarDays, Users, Flag, Bell, CircleCheckBig, type LucideIcon } from "lucide-react";
import { openTaskUrl } from "@/components/tasks/task-detail";
import { openEventUrl } from "@/components/calendar/event-detail";

export type Occurrence = {
  id: string;
  date: string;
  time: string | null;
  endTime?: string | null;
  title: string;
  kind: "evento" | "tarea";
  type: string; // reunion|deadline|recordatorio|evento|tarea
  projectId: string | null;
  href?: string;
};

export const TYPE_META: Record<string, { icon: LucideIcon; label: string; chip: string }> = {
  reunion: { icon: Users, label: "Reunión", chip: "chip-sage" },
  deadline: { icon: Flag, label: "Deadline", chip: "chip-blocked" },
  recordatorio: { icon: Bell, label: "Recordatorio", chip: "chip-waiting" },
  evento: { icon: CalendarDays, label: "Evento", chip: "chip-sage" },
  tarea: { icon: CircleCheckBig, label: "Tarea", chip: "" },
};

/** El id de la ocurrencia lleva el prefijo `e-`/`c-` para ser único en la lista
 *  combinada; aquí se quita para recuperar el id real de la tarjeta o evento. */
function rawId(o: Occurrence) {
  return o.id.slice(2);
}

/** Abre el mismo detalle que ya usa el resto de la app: la tarea (si la
 *  ocurrencia viene de una tarjeta con fecha) o el evento. */
export function openOccurrence(o: Occurrence) {
  if (o.kind === "tarea") openTaskUrl(rawId(o));
  else openEventUrl(rawId(o));
}

/** Línea de agenda / vista día: usada tanto para eventos como para tareas. */
export function OccLine({ o }: { o: Occurrence }) {
  const meta = TYPE_META[o.type] ?? TYPE_META.evento;
  const Icon = meta.icon;
  return (
    <button
      type="button"
      onClick={() => openOccurrence(o)}
      className="w-full flex items-center gap-2 text-sm py-1 min-w-0 text-left"
      data-testid={`occ-${o.id}`}
    >
      <span className={`chip shrink-0 ${meta.chip}`} title={meta.label}>
        <Icon size={11} aria-hidden /> {o.time ?? "Día"}
      </span>
      <span className="truncate hover:underline underline-offset-4">{o.title}</span>
    </button>
  );
}

/** Chip compacto de la vista Mes. */
export function MonthChip({ o }: { o: Occurrence }) {
  const meta = TYPE_META[o.type] ?? TYPE_META.evento;
  const Icon = meta.icon;
  return (
    <li>
      <button
        type="button"
        onClick={() => openOccurrence(o)}
        title={`${meta.label}: ${o.title}`}
        data-testid={`occ-${o.id}`}
        className={`w-full flex items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[11px] leading-tight text-left ${
          o.kind === "evento" ? "bg-sage-soft text-forest-deep" : "bg-beige text-ink-green"
        }`}
      >
        <Icon size={10} className="shrink-0" aria-hidden />
        {o.time && <span className="font-semibold shrink-0">{o.time}</span>}
        <span className="truncate">{o.title}</span>
      </button>
    </li>
  );
}

/** Bloque de la vista Semana. */
export function WeekChip({ o }: { o: Occurrence }) {
  const meta = TYPE_META[o.type] ?? TYPE_META.evento;
  const Icon = meta.icon;
  return (
    <button
      type="button"
      onClick={() => openOccurrence(o)}
      title={`${meta.label}: ${o.title}`}
      data-testid={`occ-${o.id}`}
      className={`w-full rounded-md px-1.5 py-1 text-[11px] leading-tight text-left ${
        o.kind === "evento" ? "bg-sage-soft text-forest-deep" : "bg-beige text-ink-green"
      }`}
    >
      <span className="flex items-center gap-1 font-semibold">
        <Icon size={10} aria-hidden /> {o.time ?? "Día"}
      </span>
      <span className="block truncate">{o.title}</span>
    </button>
  );
}
