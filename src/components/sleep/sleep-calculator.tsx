"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TimeField } from "@/components/ui/time-field";
import { NightTimeline } from "@/components/sleep/night-timeline";
import { sleepTimeline } from "@/lib/sleep-timeline";
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
  type SleepMode,
  type SleepOption,
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
   opciones la decide `emphasis`: 5 y 6 ciclos al frente, agrupadas; 3, 4 y 7
   ciclos como alternativas secundarias. */

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
  const minutes = parseTime(state.time)!;
  const options = optionsFor(state.mode, minutes);
  // Orden cronológico: las principales (5 y 6 ciclos) siempre quedan juntas al
  // centro, así que se agrupan.
  const firstPrimary = options.findIndex((o) => o.emphasis === "primary");
  const lastPrimary = options.findLastIndex((o) => o.emphasis === "primary");
  const before = options.slice(0, firstPrimary);
  const band = options.slice(firstPrimary, lastPrimary + 1);
  const after = options.slice(lastPrimary + 1);

  return (
    <div className={`mt-5 md:mt-6 ${hasParams ? "" : "invisible"}`} data-testid="sleep-calculator">
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

      {/* Escritorio: controles en una columna angosta y resultados al lado, como
          centro de la herramienta. Móvil: una sola columna compacta. */}
      <div className="mt-6 lg:mt-8 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-x-12">
        <div>
          <p id="sleep-question" className="font-display text-lg md:text-xl text-forest-deep leading-snug">
            {mode.question}
          </p>
          <div className="mt-2 flex flex-wrap items-end gap-x-5 gap-y-1 lg:flex-col lg:items-start">
            <TimeField
              value={state.time}
              onChange={(time) => setState({ mode: state.mode, time })}
              labelledBy="sleep-question"
              testid="sleep-time"
            />
            {state.mode === "dormir" && (
              <button
                type="button"
                onClick={() => setState({ mode: "dormir", time: formatTime(minutesFromDeviceClock()) })}
                className="btn btn-ghost !px-2 -ml-2 text-sm"
                data-testid="sleep-now"
              >
                Me voy a dormir ahora
              </button>
            )}
          </div>
        </div>

        <section aria-labelledby="sleep-results" className="mt-7 lg:mt-0 max-w-[34rem]" aria-live="polite">
          <h2 id="sleep-results" className="section-eyebrow">
            {mode.results}
          </h2>
          {/* «La noche»: apoyo visual de la lista (que sigue siendo la lectura principal). */}
          <NightTimeline timeline={sleepTimeline(state.mode, minutes, state.time, options)} mode={state.mode} />
          <div role="list" className="mt-3 border-t border-beige" data-testid="sleep-results">
            {before.map((o) => (
              <OptionRow key={o.cycles} option={o} />
            ))}
            {band.length > 0 && (
              <div
                role="none"
                className="my-1.5 rounded-[var(--radius-soft)] border border-sage/40 bg-sage-soft/40 divide-y divide-sage/25"
                data-testid="sleep-primary-group"
              >
                {band.map((o) => (
                  <OptionRow key={o.cycles} option={o} />
                ))}
              </div>
            )}
            {after.map((o) => (
              <OptionRow key={o.cycles} option={o} />
            ))}
          </div>
          <p className="mt-4 text-xs text-stone leading-relaxed">
            Cálculo orientativo basado en ciclos de ~{SLEEP_CYCLE_MIN} min. Las necesidades de sueño varían.
          </p>
        </section>
      </div>
    </div>
  );
}

/* Una opción: hora → ciclos → duración, en ese orden de jerarquía.
   Desde sm, tres columnas alineadas; en móvil, ciclos y duración comparten
   la segunda columna en una sola línea («5 ciclos · 7 h 30 min», sin «de
   sueño» para que quepa incluso en 320 px). Sin pills ni badges: la
   jerarquía la dan tamaño, peso y color (y el grupo, para las principales). */
function OptionRow({ option: o }: { option: SleepOption }) {
  const primary = o.emphasis === "primary";
  const duration = `${o.durationLabel} de sueño`;
  return (
    <div
      role="listitem"
      className={`grid grid-cols-[auto_minmax(0,1fr)] whitespace-nowrap sm:grid-cols-[6.5rem_6rem_minmax(0,1fr)] items-baseline gap-x-4 px-3 ${
        primary ? "py-3.5" : "py-2.5 border-b border-beige"
      }`}
      data-emphasis={o.emphasis}
      data-testid="sleep-option"
    >
      <span
        className={`font-display tabular-nums leading-none ${
          primary ? "text-[30px] md:text-[34px] text-forest-deep" : "text-[22px] md:text-2xl text-stone"
        }`}
        data-testid="sleep-option-time"
      >
        {o.time}
      </span>
      <span className={primary ? "text-[15px] font-medium text-charcoal" : "text-sm text-stone"}>
        {o.cycles} ciclos
        <span className={`sm:hidden font-normal ${primary ? "text-stone" : "text-stone-soft"}`}> · {o.durationLabel}</span>
      </span>
      <span className={`hidden sm:block ${primary ? "text-sm text-stone" : "text-[13px] text-stone-soft"}`}>
        {duration}
      </span>
    </div>
  );
}
