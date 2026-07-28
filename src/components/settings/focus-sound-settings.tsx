"use client";

import { useEffect, useState } from "react";
import { Play, Volume2 } from "lucide-react";
import {
  FOCUS_SOUND_OPTIONS,
  getFocusSoundChoice,
  setFocusSoundChoice,
  getFocusSoundVolume,
  setFocusSoundVolume,
  playFocusChime,
} from "@/lib/focus-sound";

/** Elegir, ajustar el volumen y probar el ringtone que suena al terminar un
 *  bloque de enfoque o descanso en el Jardín de enfoque. Preferencias
 *  guardadas en este navegador (localStorage), no en el servidor — silenciarlo
 *  del todo se hace desde el propio overlay del Jardín. El volumen aquí es
 *  solo del sonido propio del Pomodoro: nunca toca el volumen de las
 *  notificaciones del sistema, eso lo controla el sistema operativo. */
export function FocusSoundSettings() {
  const [choice, setChoice] = useState(FOCUS_SOUND_OPTIONS[0].id);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura de localStorage, solo resoluble tras montar (SSR-safe)
    setChoice(getFocusSoundChoice());
    setVolume(getFocusSoundVolume());
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
      <label className="flex items-center gap-2 text-sm text-stone">
        <Volume2 size={16} aria-hidden />
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={Math.round(volume * 100)}
          onChange={(e) => {
            const next = Number(e.target.value) / 100;
            setVolume(next);
            setFocusSoundVolume(next);
          }}
          className="w-32 accent-forest"
          aria-label="Volumen del aviso del pomodoro"
          data-testid="focus-sound-volume"
        />
        <span className="text-xs text-stone-soft tabular-nums w-9">{Math.round(volume * 100)}%</span>
      </label>
      <p className="text-xs text-stone-soft basis-full">
        Se silencia desde el Jardín de enfoque; aquí eliges cuál suena, qué tan fuerte y lo pruebas. Esto no cambia
        el volumen de las notificaciones del sistema.
      </p>
    </div>
  );
}
