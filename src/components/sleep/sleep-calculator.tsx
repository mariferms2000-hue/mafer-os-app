"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  formatTime,
  minutesFromDeviceClock,
  optionsFor,
  parseTime,
  readSleepState,
  sleepStateQuery,
  SLEEP_CYCLE_MIN,
  SLEEP_LATENCY_MIN,
  type SleepMode,
  type SleepState,
} from "@/lib/sleep-logic";

/* La URL (/sueno?modo=…&h=…) es la fuente de verdad: el modo y la hora se leen
   de ahí y cada cambio la reescribe con history.replaceState, que Next integra
   con useSearchParams sin pedir nada al servidor ni sumar entradas al historial.
   (El primer argumento DEBE ser null: si lleva el estado interno de Next —__NA—,
   Next lo toma como propio y no sincroniza useSearchParams.) Las URLs inválidas
   ya llegan corregidas: la página las redirige en el servidor.

   Única excepción: mientras el campo está vacío o a medio escribir, ese texto
   vive en `draft` (la URL conserva la última hora válida). La jerarquía de las
   opciones la decide `emphasis` (9 h y 7 h 30 min al frente, 6 h detrás). */

const MODES: { key: SleepMode; label: string; question: string; results: string }[] = [
  { key: "despertar", label: "Despertar a…", question: "¿A qué hora quieres despertar?", results: "Acuéstate a las" },
  { key: "dormir", label: "Dormir a…", question: "¿A qué hora te vas a dormir?", results: "Despierta a las" },
];

function writeUrl(state: SleepState) {
  window.history.replaceState(null, "", `${window.location.pathname}?${sleepStateQuery(state)}`);
}

export function SleepCalculator() {
  const searchParams = useSearchParams();
  const state = readSleepState(searchParams);
  const [draft, setDraft] = useState<string | null>(null);
  const mode = MODES.find((m) => m.key === state.mode)!;

  const setState = (next: SleepState) => {
    setDraft(null);
    writeUrl(next);
  };

  const onTimeChange = (raw: string) => {
    const minutes = parseTime(raw);
    if (minutes === null) setDraft(raw);
    else setState({ mode: state.mode, time: formatTime(minutes) });
  };

  const inputValue = draft ?? state.time;
  const minutes = draft === null ? parseTime(state.time) : null;
  const options = minutes === null ? [] : optionsFor(state.mode, minutes);

  return (
    <div className="mt-6 md:mt-8">
      <div role="group" aria-label="Modo de cálculo" className="flex gap-1.5" data-testid="sleep-mode">
        {MODES.map((m) => {
          const active = m.key === state.mode;
          return (
            <button
              key={m.key}
              type="button"
              aria-pressed={active}
              onClick={() => setState({ mode: m.key, time: state.time })}
              className={`rounded-xl px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                active ? "bg-forest text-cream" : "bg-beige text-ink-green hover:bg-sand"
              }`}
              data-testid={`sleep-mode-${m.key}`}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      <label htmlFor="sleep-time" className="block mt-8 md:mt-10 font-display text-xl md:text-2xl text-forest-deep">
        {mode.question}
      </label>
      <input
        id="sleep-time"
        type="time"
        value={inputValue}
        onChange={(e) => onTimeChange(e.target.value)}
        className="time-hero mt-3"
        data-testid="sleep-time-input"
      />
      {state.mode === "dormir" && (
        <button
          type="button"
          onClick={() => setState({ mode: "dormir", time: formatTime(minutesFromDeviceClock()) })}
          className="btn btn-ghost !px-2 -ml-2 mt-2 text-sm"
          data-testid="sleep-now"
        >
          Me voy a dormir ahora
        </button>
      )}

      <section aria-labelledby="sleep-results" className="mt-10" aria-live="polite">
        <h2 id="sleep-results" className="section-eyebrow">
          {mode.results}
        </h2>
        {options.length === 0 ? (
          <p className="mt-3 text-sm text-stone">Elige una hora para ver las sugerencias.</p>
        ) : (
          <ul className="mt-2 divide-y divide-beige border-y border-beige" data-testid="sleep-results">
            {options.map((o) => {
              const primary = o.emphasis === "primary";
              return (
                <li
                  key={o.cycles}
                  className={`flex items-baseline justify-between gap-4 ${primary ? "py-4" : "py-3"}`}
                  data-emphasis={o.emphasis}
                  data-testid="sleep-option"
                >
                  <span
                    className={`font-display tabular-nums leading-none ${
                      primary ? "text-[34px] md:text-[40px] text-forest-deep" : "text-2xl text-stone-soft"
                    }`}
                  >
                    {o.time}
                  </span>
                  <span className={primary ? "text-sm text-stone" : "text-xs text-stone-soft"}>
                    {o.durationLabel} de sueño
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-6 text-xs text-stone-soft leading-relaxed">
          Orientativo, no una indicación médica: supone ciclos de ~{SLEEP_CYCLE_MIN} min y ~{SLEEP_LATENCY_MIN} min
          para quedarte dormida. Cada cuerpo y cada noche varían.
        </p>
      </section>
    </div>
  );
}
