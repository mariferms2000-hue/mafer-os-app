"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TimeField } from "@/components/ui/time-field";
import {
  DEFAULT_SLEEP_STATE,
  formatTime,
  hasSleepParams,
  minutesFromDeviceClock,
  parseStoredSleepState,
  optionsFor,
  parseTime,
  readSleepState,
  serializeSleepState,
  sleepStateQuery,
  SLEEP_CYCLE_MIN,
  SLEEP_STORAGE_KEY,
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

   Última selección en este dispositivo — prioridad URL > localStorage > defaults:
   - Con `modo`/`h` en la URL, manda la URL (el servidor ya la validó).
   - Sin ellos, el servidor pinta la calculadora INVISIBLE (mismo espacio, sin
     destello de 07:30 ni diferencia de hidratación) y aquí se navega con
     router.replace a lo guardado o a los valores por defecto. Es router.replace
     y no replaceState: al montar, el router de Next revierte un replaceState.
   - Cada estado válido que llega a la URL se guarda. Los borradores del
     selector nunca llegan a la URL, así que nunca se guardan.

   La hora se elige con TimeField (24 h siempre). Lo que se está escribiendo
   vive dentro de TimeField y solo llega aquí una hora completa y válida, así
   que la URL siempre conserva la última hora válida. La jerarquía de las
   opciones la decide `emphasis` (9 h y 7 h 30 min al frente, 6 h detrás). */

const MODES: { key: SleepMode; label: string; question: string; results: string }[] = [
  { key: "despertar", label: "Despertar a…", question: "¿A qué hora quieres despertar?", results: "Acuéstate a las" },
  { key: "dormir", label: "Dormir a…", question: "¿A qué hora te vas a dormir?", results: "Despierta a las" },
];

function writeUrl(state: SleepState) {
  window.history.replaceState(null, "", `${window.location.pathname}?${sleepStateQuery(state)}`);
}

function loadStoredState(): SleepState | null {
  try {
    return parseStoredSleepState(window.localStorage.getItem(SLEEP_STORAGE_KEY));
  } catch {
    return null; // localStorage bloqueado o inexistente
  }
}

function saveState(state: SleepState) {
  try {
    window.localStorage.setItem(SLEEP_STORAGE_KEY, serializeSleepState(state));
  } catch {}
}

export function SleepCalculator() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const hasParams = hasSleepParams(searchParams);
  const state = readSleepState(searchParams);

  useEffect(() => {
    if (hasParams) return;
    const restored = loadStoredState() ?? DEFAULT_SLEEP_STATE;
    router.replace(`${pathname}?${sleepStateQuery(restored)}`, { scroll: false });
  }, [hasParams, pathname, router]);

  const { canonical, mode: currentMode, time: currentTime } = state;
  useEffect(() => {
    if (hasParams && canonical) saveState({ mode: currentMode, time: currentTime });
  }, [hasParams, canonical, currentMode, currentTime]);

  const mode = MODES.find((m) => m.key === state.mode)!;
  const setState = writeUrl;
  // readSleepState siempre devuelve una hora válida.
  const options = optionsFor(state.mode, parseTime(state.time)!);

  return (
    <div className={`mt-6 md:mt-8 ${hasParams ? "" : "invisible"}`} data-testid="sleep-calculator">
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

      <p id="sleep-question" className="mt-7 md:mt-9 font-display text-xl md:text-2xl text-forest-deep">
        {mode.question}
      </p>
      <div className="-ml-1">
        <TimeField
          value={state.time}
          onChange={(time) => setState({ mode: state.mode, time })}
          labelledBy="sleep-question"
          testid="sleep-time"
        />
      </div>
      {state.mode === "dormir" && (
        <button
          type="button"
          onClick={() => setState({ mode: "dormir", time: formatTime(minutesFromDeviceClock()) })}
          className="btn btn-ghost !px-2 -ml-2 mt-1 text-sm"
          data-testid="sleep-now"
        >
          Me voy a dormir ahora
        </button>
      )}

      <section aria-labelledby="sleep-results" className="mt-7 md:mt-9" aria-live="polite">
        <h2 id="sleep-results" className="section-eyebrow">
          {mode.results}
        </h2>
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
        <p className="mt-6 text-xs text-stone-soft leading-relaxed">
          Orientativo, no una indicación médica: supone ciclos de ~{SLEEP_CYCLE_MIN} min y ~{SLEEP_LATENCY_MIN} min
          para quedarte dormida. Cada cuerpo y cada noche varían.
        </p>
      </section>
    </div>
  );
}
