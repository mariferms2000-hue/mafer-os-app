"use client";

import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { TaskLine } from "@/components/hoy/task-line";
import { TYPE_META } from "@/components/calendar/occurrence";
import { openEventUrl } from "@/components/calendar/event-detail";
import { addDays } from "@/lib/tz";
import type { AgendaDay, AgendaEvent, AgendaItem, WeekAgenda as WeekAgendaData } from "@/lib/week-agenda";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DIAS_LARGOS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const INICIALES = ["L", "M", "M", "J", "V", "S", "D"];
/** Los demás días de la semana enseñan pocas cosas: el resto, a un toque en Calendario. */
const MAX_POR_DIA = 3;

const num = (ymd: string) => Number(ymd.slice(8, 10));
const mes = (ymd: string) => MESES[Number(ymd.slice(5, 7)) - 1];

/** «13–19 oct», «29 sep – 5 oct». */
function rango(start: string, end: string) {
  return mes(start) === mes(end) ? `${num(start)}–${num(end)} ${mes(end)}` : `${num(start)} ${mes(start)} – ${num(end)} ${mes(end)}`;
}

function horario(e: AgendaEvent) {
  if (!e.startTime) return "Todo el día";
  return e.endTime ? `${e.startTime}–${e.endTime}` : e.startTime;
}

function EventRow({ e }: { e: AgendaEvent }) {
  const meta = TYPE_META[e.type ?? "evento"] ?? TYPE_META.evento;
  const Icon = meta.icon;
  return (
    <button
      type="button"
      onClick={() => openEventUrl(e.id)}
      className="w-full flex items-start gap-2.5 py-2 text-left group"
      aria-label={`Abrir evento «${e.title}»`}
      data-testid="agenda-event"
    >
      <Icon size={17} className="mt-0.5 shrink-0 text-sage-deep" aria-hidden />
      <span className="min-w-0 flex-1 text-sm leading-snug text-charcoal group-hover:text-forest transition-colors line-clamp-2" title={meta.label}>
        {e.title}
      </span>
      <span className={`chip shrink-0 tabular-nums ${meta.chip || "chip-sage"}`}>{horario(e)}</span>
    </button>
  );
}

function Item({ i }: { i: AgendaItem }) {
  return i.kind === "evento" ? <EventRow e={i.event} /> : <TaskLine card={i.card} compact inAgenda />;
}

function DayGroup({ day, index, cap }: { day: AgendaDay; index: number; cap?: number }) {
  const shown = cap ? day.items.slice(0, cap) : day.items;
  const rest = day.items.length - shown.length;
  return (
    <div data-testid={day.isToday ? "agenda-today" : "agenda-day"} data-date={day.date} className="mt-5 first:mt-0">
      <h3 className={`font-display flex items-baseline gap-2 text-forest-deep leading-tight ${day.isToday ? "text-xl" : "text-lg"}`}>
        {day.isToday ? "Hoy" : DIAS_LARGOS[index]}
        <span className="font-body text-sm font-normal text-stone">
          {day.isToday ? `${DIAS_LARGOS[index].toLowerCase()} ${num(day.date)}` : `${num(day.date)} ${mes(day.date)}`}
        </span>
      </h3>
      {day.items.length === 0 ? (
        <p className="text-sm text-stone py-2">Sin reuniones ni fechas límite. Espacio para trabajo con calma.</p>
      ) : (
        <ul className="divide-y divide-beige">
          {shown.map((i) => (
            <li key={`${i.kind}-${i.kind === "evento" ? i.event.id : i.card.id}`}>
              <Item i={i} />
            </li>
          ))}
        </ul>
      )}
      {rest > 0 && (
        <Link
          href={`/calendario?vista=dia&fecha=${day.date}`}
          className="text-xs text-stone hover:text-forest underline-offset-4 hover:underline"
          data-testid="agenda-day-more"
        >
          +{rest} más ese día
        </Link>
      )}
    </div>
  );
}

/** Agenda de la semana en Hoy: una tira de lunes a domingo para ver la forma
 *  de la semana de un vistazo y, debajo, hoy completo y los días que vienen
 *  con lo esencial. Los días pasados solo cuentan eventos: las tareas que se
 *  quedaron atrás están en «Para que nada se caiga → Vencidas». */
export function WeekAgenda({ agenda }: { agenda: WeekAgendaData }) {
  const { weekStart, weekEnd, days, isCurrentWeek } = agenda;
  const hoy = days.find((d) => d.isToday);
  // En la semana actual la lista empieza hoy; en otras semanas, todos los días con algo.
  const siguientes = days
    .map((d, i) => ({ d, i }))
    .filter(({ d }) => !d.isToday && d.items.length > 0 && (!isCurrentWeek || !d.isPast));
  const semana = (n: number) => `/?semana=${addDays(weekStart, 7 * n)}`;

  return (
    <section aria-labelledby="agenda-semana" className="card p-5 min-w-0" data-testid="agenda">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 id="agenda-semana" className="section-eyebrow flex items-center gap-1.5 min-w-0">
          <CalendarDays size={13} className="text-sage-deep shrink-0" aria-hidden />
          <span className="truncate">{isCurrentWeek ? "Agenda de la semana" : "Agenda"}</span>
        </h2>
        <nav aria-label="Cambiar de semana" className="flex items-center gap-0.5 shrink-0">
          <Link href={semana(-1)} scroll={false} className="btn btn-ghost !p-1.5" aria-label="Semana anterior" data-testid="agenda-prev">
            <ChevronLeft size={15} aria-hidden />
          </Link>
          <span className="text-xs text-stone tabular-nums px-1" data-testid="agenda-range">{rango(weekStart, weekEnd)}</span>
          <Link href={semana(1)} scroll={false} className="btn btn-ghost !p-1.5" aria-label="Semana siguiente" data-testid="agenda-next">
            <ChevronRight size={15} aria-hidden />
          </Link>
          {!isCurrentWeek && (
            <Link href="/" scroll={false} className="chip hover:bg-sand ml-1" data-testid="agenda-this-week" title="Volver a esta semana">
              Hoy
            </Link>
          )}
        </nav>
      </div>

      {/* Tira de la semana: inicial y fecha, hoy resaltado; un toque abre ese día en Calendario */}
      <ol className="grid grid-cols-7 gap-1 mb-4" data-testid="agenda-strip">
        {days.map((d, i) => {
          const n = d.items.length;
          return (
            <li key={d.date}>
              <Link
                href={`/calendario?vista=dia&fecha=${d.date}`}
                aria-label={`${DIAS_LARGOS[i]} ${num(d.date)}: ${n === 0 ? "nada" : `${n} ${n === 1 ? "cosa" : "cosas"}`}`}
                aria-current={d.isToday ? "date" : undefined}
                className={`flex flex-col items-center rounded-xl py-1.5 transition-colors ${
                  d.isToday ? "chip-on" : d.isPast ? "text-stone-soft hover:bg-beige" : "text-charcoal hover:bg-beige"
                }`}
              >
                <span className="text-[10px] font-semibold uppercase leading-none">{INICIALES[i]}</span>
                <span className="text-sm tabular-nums leading-tight mt-0.5">{num(d.date)}</span>
              </Link>
            </li>
          );
        })}
      </ol>

      {hoy && <DayGroup day={hoy} index={days.indexOf(hoy)} />}

      {siguientes.length > 0 && (
        <div className={hoy ? "mt-4 pt-3 border-t border-beige" : ""} data-testid="agenda-rest">
          {siguientes.map(({ d, i }) => (
            <DayGroup key={d.date} day={d} index={i} cap={MAX_POR_DIA} />
          ))}
        </div>
      )}
      {siguientes.length === 0 && (!hoy || hoy.items.length > 0) && (
        <p className={`text-sm text-stone ${hoy ? "mt-3 pt-3 border-t border-beige" : ""}`} data-testid="agenda-rest-empty">
          {hoy ? "El resto de la semana está libre." : "Nada agendado esta semana."}
        </p>
      )}

      <Link href={`/calendario?vista=semana&fecha=${weekStart}`} className="inline-block mt-3 text-xs text-stone hover:text-forest underline-offset-4 hover:underline">
        Ver calendario
      </Link>
    </section>
  );
}
