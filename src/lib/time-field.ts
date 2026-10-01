/* Selector de hora propio (24 h) — lógica pura de los dos segmentos HH y MM.

   Existe porque el <input type="time"> nativo muestra AM/PM según el idioma
   del navegador o del sistema, y Mafer OS es 24 h siempre.

   Reglas de escritura (que el campo nunca pelee con quien escribe):
   - Se guardan solo dígitos, como mucho dos.
   - Nada se transforma en silencio: «24» o «60» se ven tal cual como borrador,
     pero `value` es null — no llegan a la URL ni a los resultados, y al salir
     del campo vuelve la última hora válida.
   - Dos dígitos válidos se aplican al instante. Un solo dígito («7», «5») se
     aplica al salir del campo, ya con cero a la izquierda: así «6» y luego «0»
     en los minutos nunca deja guardado un 06 de paso.
   - `complete`: ya no admite otro dígito válido (dos dígitos, o uno que por 10
     rebasa: hora «3», minuto «7»). En la hora, el foco pasa solo a los minutos.
   - Vacío no es un valor: la hora válida anterior se conserva. */

export type Segment = "h" | "m";

export const SEGMENT_MAX: Record<Segment, number> = { h: 23, m: 59 };

/** Paso de las flechas en pantalla: hora ±1, minutos ±5. El teclado va de 1 en 1. */
export const BUTTON_STEP: Record<Segment, number> = { h: 1, m: 5 };

export type SegmentInput = {
  /** Lo que se ve mientras se escribe (puede ser inválido: «24»). */
  text: string;
  /** Valor si el texto es válido; null si está vacío o fuera de rango. */
  value: number | null;
  /** No admite otro dígito válido. */
  complete: boolean;
  /** Se puede aplicar ya, sin esperar a salir del campo (dos dígitos válidos). */
  immediate: boolean;
};

export const pad2 = (n: number) => String(n).padStart(2, "0");

/** Lo que queda en un segmento después de escribir `raw` en él. */
export function typeIntoSegment(seg: Segment, raw: string): SegmentInput {
  const max = SEGMENT_MAX[seg];
  const text = raw.replace(/\D/g, "").slice(-2);
  const value = text === "" || Number(text) > max ? null : Number(text);
  const complete = value !== null && (text.length === 2 || value * 10 > max);
  return { text, value, complete, immediate: value !== null && text.length === 2 };
}

/** Texto a interpretar tras una edición, SIN depender de dónde quedó el cursor.
 *
 *  `current` es lo que se lleva escrito en este segmento desde que recibió el
 *  foco ("" si aún nada: entonces la primera tecla REEMPLAZA el valor, como en
 *  el campo de hora nativo). Con un dígito se suma al final — y si ya había dos,
 *  empieza de nuevo con ese dígito. Con retroceso se quita el último. Pegar u
 *  otras ediciones usan el valor completo del campo.
 *  (WebKit deja el cursor donde se hizo clic: leer el valor entero convertía
 *  «0|7» + «2» en «027» → 7.) */
export function nextSegmentText(
  current: string,
  edit: { inputType?: string; data?: string | null; value: string },
): string {
  if (edit.inputType === "insertText" && edit.data) {
    return current.length >= 2 ? edit.data : current + edit.data;
  }
  if (edit.inputType === "deleteContentBackward") return current.slice(0, -1);
  return edit.value;
}

/** Suma `delta` y da la vuelta dentro del segmento (23 → 00, 00 − 5 → 55).
 *  No arrastra a la hora: es un ajuste de un solo segmento. Nunca redondea:
 *  47 + 5 = 52. */
export function stepSegment(seg: Segment, value: number, delta: number): number {
  const size = SEGMENT_MAX[seg] + 1;
  return (((value + delta) % size) + size) % size;
}

/** "07:30" → { h: 7, m: 30 }. Asume una hora ya validada (viene de la URL). */
export function splitTime(hhmm: string): Record<Segment, number> {
  const [h, m] = hhmm.split(":").map(Number);
  return { h, m };
}

/** { h: 7, m: 30 } → "07:30". */
export function joinTime({ h, m }: Record<Segment, number>): string {
  return `${pad2(h)}:${pad2(m)}`;
}

/** Hora completa tras cambiar un segmento. */
export function withSegment(hhmm: string, seg: Segment, value: number): string {
  return joinTime({ ...splitTime(hhmm), [seg]: value });
}
