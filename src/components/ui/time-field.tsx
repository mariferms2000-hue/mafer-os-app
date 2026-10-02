"use client";

import { useEffect, useRef, useState } from "react";
import {
  SEGMENT_MAX,
  pad2,
  splitTime,
  nextSegmentText,
  stepSegment,
  typeIntoSegment,
  withSegment,
  type Segment,
} from "@/lib/time-field";

/* Hora en 24 h siempre: dos segmentos escribibles HH : MM, sin flechas
   visibles. Sustituye al <input type="time"> nativo, que muestra AM/PM según
   el idioma del dispositivo.

   - Escribir: teclado numérico en móvil; las reglas viven en `lib/time-field`.
     La primera tecla tras enfocar reemplaza el número y las siguientes se
     suman, sin importar dónde quedó el cursor. Con la hora completa, el foco
     pasa solo a los minutos.
   - Teclado: ↑/↓ suman o restan 1 en el segmento activo; Tab cambia de segmento.
   - Touch: tocar un número abre el teclado numérico.

   Controlado: `value` ("HH:MM", siempre válido) viene de fuera y `onChange` solo
   recibe horas completas y válidas. Lo que se está escribiendo vive en `draft`
   hasta salir del segmento; vacío o inválido no cambia nada. */

type Draft = { seg: Segment; text: string } | null;

const LABELS: Record<Segment, string> = { h: "Hora", m: "Minutos" };

export function TimeField({
  value,
  onChange,
  labelledBy,
  testid = "time-field",
}: {
  value: string;
  onChange: (next: string) => void;
  labelledBy?: string;
  testid?: string;
}) {
  // El borrador se pinta desde el estado y se lee desde la ref: al pasar solo a
  // los minutos, el blur de la hora ocurre dentro del mismo evento, antes de que
  // React vuelva a pintar, y necesita ver lo recién escrito.
  const [draft, setDraftState] = useState<Draft>(null);
  const draftRef = useRef<Draft>(null);
  const setDraft = (d: Draft) => {
    draftRef.current = d;
    setDraftState(d);
  };
  const hourRef = useRef<HTMLInputElement>(null);
  const minuteRef = useRef<HTMLInputElement>(null);
  // Última hora enviada: dos cambios seguidos (hora y luego minutos) pueden
  // llegar antes de que `value` se actualice desde la URL; así no se pisan.
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);

  const parts = splitTime(value);

  const commit = (seg: Segment, v: number) => {
    const next = withSegment(latest.current, seg, v);
    if (next === latest.current) return;
    latest.current = next;
    onChange(next);
  };

  const step = (seg: Segment, delta: number) => {
    setDraft(null);
    commit(seg, stepSegment(seg, splitTime(latest.current)[seg], delta));
  };

  const onType = (seg: Segment, e: React.ChangeEvent<HTMLInputElement>) => {
    const native = e.nativeEvent as InputEvent;
    const current = draftRef.current?.seg === seg ? draftRef.current.text : "";
    const raw = nextSegmentText(current, {
      inputType: native.inputType,
      data: native.data,
      value: e.target.value,
    });
    const r = typeIntoSegment(seg, raw);
    setDraft({ seg, text: r.text });
    if (r.immediate) commit(seg, r.value!);
    if (r.complete && seg === "h") minuteRef.current?.focus();
  };

  // Al salir: un dígito suelto válido se aplica («7» → 07); vacío o inválido
  // («24», «60») se descarta y vuelve a verse la última hora válida.
  const onBlur = (seg: Segment) => {
    const d = draftRef.current;
    if (d?.seg !== seg) return;
    const { value: v } = typeIntoSegment(seg, d.text);
    if (v !== null) commit(seg, v);
    setDraft(null);
  };

  const onKeyDown = (seg: Segment) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    step(seg, e.key === "ArrowUp" ? 1 : -1);
    const input = e.currentTarget;
    requestAnimationFrame(() => input.select());
  };

  const segment = (seg: Segment) => {
    const shown = draft?.seg === seg ? draft.text : pad2(parts[seg]);
    return (
      <input
        ref={seg === "h" ? hourRef : minuteRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        enterKeyHint="done"
        role="spinbutton"
        aria-label={LABELS[seg]}
        aria-valuenow={parts[seg]}
        aria-valuemin={0}
        aria-valuemax={SEGMENT_MAX[seg]}
        aria-valuetext={pad2(parts[seg])}
        value={shown}
        onChange={(e) => onType(seg, e)}
        onKeyDown={onKeyDown(seg)}
        onFocus={(e) => e.target.select()}
        onBlur={() => onBlur(seg)}
        className="time-segment"
        data-testid={`${testid}-${seg}`}
      />
    );
  };

  return (
    <div role="group" aria-labelledby={labelledBy} className="time-field" data-testid={testid}>
      {segment("h")}
      <span className="time-colon" aria-hidden>
        :
      </span>
      {segment("m")}
    </div>
  );
}
