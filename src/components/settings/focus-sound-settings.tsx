"use client";

import { useEffect, useState } from "react";
import { Play } from "lucide-react";
import { FOCUS_SOUND_OPTIONS, getFocusSoundChoice, setFocusSoundChoice, playFocusChime } from "@/lib/focus-sound";

/** Elegir y probar el ringtone que suena al terminar un bloque de enfoque
 *  o descanso en el Jardín de enfoque. Preferencia guardada en este
 *  navegador (localStorage), no en el servidor — silenciarla se hace
 *  desde el propio overlay del Jardín. */
export function FocusSoundSettings() {
  const [choice, setChoice] = useState(FOCUS_SOUND_OPTIONS[0].id);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura de localStorage, solo resoluble tras montar (SSR-safe)
    setChoice(getFocusSoundChoice());
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={choice}
        onChange={(e) => {
          setChoice(e.target.value);
          setFocusSoundChoice(e.target.value);
        }}
        className="select !w-auto"
        aria-label="Sonido de aviso al terminar el pomodoro"
        data-testid="focus-sound-select"
      >
        {FOCUS_SOUND_OPTIONS.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => playFocusChime()}
        className="btn btn-secondary !py-1.5 !px-3 text-sm"
        data-testid="focus-sound-preview"
      >
        <Play size={14} aria-hidden /> Probar sonido
      </button>
      <p className="text-xs text-stone-soft basis-full">
        Se silencia desde el Jardín de enfoque; aquí solo eliges cuál suena al terminar.
      </p>
    </div>
  );
}
