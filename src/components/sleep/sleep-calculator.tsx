"use client";

import { useState } from "react";
import { bedtimesFor, parseTime, SLEEP_CYCLE_MIN, SLEEP_LATENCY_MIN } from "@/lib/sleep-logic";

/* Fase 2: solo «Quiero despertar a…». La hora elegida es la protagonista; los
   resultados son una lista con separadores (nada de tarjetas) y la jerarquía
   la decide `emphasis`: 9 h y 7 h 30 min al frente, 6 h en segundo plano. */

const DEFAULT_WAKE = "07:30";

export function SleepCalculator() {
  const [wake, setWake] = useState(DEFAULT_WAKE);
  const wakeMinutes = parseTime(wake);
  const options = wakeMinutes === null ? [] : bedtimesFor(wakeMinutes);

  return (
    <div className="mt-8 md:mt-12">
      <label htmlFor="sleep-wake" className="block font-display text-xl md:text-2xl text-forest-deep">
        ¿A qué hora quieres despertar?
      </label>
      <input
        id="sleep-wake"
        type="time"
        value={wake}
        onChange={(e) => setWake(e.target.value)}
        className="time-hero mt-3"
        data-testid="sleep-wake-input"
      />

      <section aria-labelledby="sleep-results" className="mt-10" aria-live="polite">
        <h2 id="sleep-results" className="section-eyebrow">
          Acuéstate a las
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
