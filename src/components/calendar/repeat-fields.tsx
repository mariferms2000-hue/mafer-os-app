"use client";

import { useState } from "react";
import { Repeat } from "lucide-react";

/** «Repetir cada día hasta…» para eventos de varios días (un solo registro;
 *  en Google, un evento recurrente diario). Con hora avisa cada día a esa
 *  hora; sin hora, es de todo el día cada día. Lo lee
 *  repeatUntilDeFormulario (src/lib/event-repeat.ts). */
export function RepeatFields({ idPrefix, defaultUntil }: { idPrefix: string; defaultUntil?: string | null }) {
  const [on, setOn] = useState(Boolean(defaultUntil));
  return (
    <div className="rounded-xl border border-sand p-3 flex flex-col gap-2">
      <label className="flex items-center gap-2 text-sm text-ink-green cursor-pointer" htmlFor={`${idPrefix}-repeat`}>
        <input
          id={`${idPrefix}-repeat`}
          name="repeat"
          type="checkbox"
          checked={on}
          onChange={(e) => setOn(e.target.checked)}
          data-testid="event-repeat"
        />
        <Repeat size={14} aria-hidden /> Repetir cada día
      </label>
      {on && (
        <div>
          <label className="label" htmlFor={`${idPrefix}-until`}>Hasta (incluido)</label>
          <input
            id={`${idPrefix}-until`}
            name="repeatUntil"
            type="date"
            className="input"
            required
            defaultValue={defaultUntil ?? ""}
            data-testid="event-repeat-until"
          />
          <p className="text-xs text-stone-soft mt-1">
            Un solo evento que aparece cada día. Con hora, te avisa cada día a esa hora; sin hora, es de todo el día.
          </p>
        </div>
      )}
    </div>
  );
}
