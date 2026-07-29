"use client";

import { Plane } from "lucide-react";
import { openTripUrl } from "@/components/calendar/trip-detail";
import { isTripActiveOn, tripWeekOverlap } from "@/lib/trip-logic";

export type TripSpan = { id: string; title: string; startDate: string; endDate: string };

/** Franja de viajes de una semana (Mes o Semana): una barra por viaje que la
 *  toca, alineada a las columnas de día correctas — se distingue de eventos
 *  y tareas con su propio color (chip-trip) y el ícono de avión. */
export function TripWeekBand({ week, trips }: { week: (string | null)[]; trips: TripSpan[] }) {
  const bars = trips
    .map((t) => {
      const span = tripWeekOverlap(week, t);
      return span && { t, ...span };
    })
    .filter((x): x is { t: TripSpan; startCol: number; endCol: number } => !!x);
  if (bars.length === 0) return null;
  return (
    <div className="flex flex-col gap-1 mb-1.5" data-testid="trip-week-band">
      {bars.map(({ t, startCol, endCol }) => (
        <div key={t.id} className="grid grid-cols-7 gap-1.5">
          <button
            type="button"
            onClick={() => openTripUrl(t.id)}
            title={`Viaje: ${t.title}`}
            data-testid={`trip-band-${t.id}`}
            style={{ gridColumn: `${startCol + 1} / ${endCol + 2}` }}
            className="chip-trip flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium truncate text-left border"
          >
            <Plane size={11} className="shrink-0" aria-hidden />
            <span className="truncate">{t.title}</span>
          </button>
        </div>
      ))}
    </div>
  );
}

/** Tarjeta/badge compacto para vista Día y Agenda: un viaje que sigue activo
 *  en esta fecha (o varios). */
export function TripDayBadges({ date, trips }: { date: string; trips: TripSpan[] }) {
  const active = trips.filter((t) => isTripActiveOn(t, date));
  if (active.length === 0) return null;
  return (
    <div className="flex flex-col gap-1 mb-2" data-testid="trip-day-badges">
      {active.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => openTripUrl(t.id)}
          data-testid={`trip-badge-${t.id}`}
          className="chip-trip w-full flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-left border"
        >
          <Plane size={12} className="shrink-0" aria-hidden />
          <span className="truncate">
            Viaje: {t.title}
            {t.startDate === date && t.endDate !== date ? " (empieza hoy)" : ""}
            {t.endDate === date && t.startDate !== date ? " (termina hoy)" : ""}
          </span>
        </button>
      ))}
    </div>
  );
}
