/* «La noche»: geometría de la línea de tiempo de Sueño. Módulo puro, solo
   presentación — no calcula horas nuevas: coloca en una línea las opciones que
   ya devuelve `sleep-logic` y la hora elegida.

   La línea va siempre de izquierda a derecha, en orden cronológico:
   - «Despertar a…»: desde la opción más temprana para acostarse hasta la hora
     de despertar (ancla, a la derecha). Justo antes del ancla, el tramo de
     ~15 min para dormirse.
   - «Dormir a…»: desde la hora de acostarse (ancla, a la izquierda), el tramo
     de ~15 min, y luego cada frontera de ciclo hasta la opción más tardía.
   Las posiciones van de 0 a 1 sobre el largo total. Las marcas (`ticks`) son
   todas las fronteras de ciclo; las opciones caen sobre algunas de ellas. */

import { SLEEP_CYCLE_MIN, SLEEP_LATENCY_MIN, wrapMinutes, type SleepMode, type SleepOption } from "./sleep-logic";

export type TimelineNode = { pos: number; time: string; cycles: number; emphasis: SleepOption["emphasis"] };

export type SleepTimeline = {
  anchor: { pos: number; time: string };
  /** Tramo para quedarse dormida, en posiciones 0–1. */
  latency: { from: number; to: number };
  ticks: number[];
  nodes: TimelineNode[];
};

export function sleepTimeline(
  mode: SleepMode,
  anchorMinutes: number,
  anchorTime: string,
  options: SleepOption[],
  cycleMin: number = SLEEP_CYCLE_MIN,
  latencyMin: number = SLEEP_LATENCY_MIN,
): SleepTimeline {
  const maxCycles = Math.max(...options.map((o) => o.cycles));
  const total = maxCycles * cycleMin + latencyMin;
  // Primer minuto de la línea (izquierda).
  const start = mode === "dormir" ? anchorMinutes : anchorMinutes - total;
  const at = (minutes: number) => wrapMinutes(minutes - start) / total;
  // Primera frontera de ciclo: tras dormirse (dormir) o el inicio (despertar).
  const firstBoundary = mode === "dormir" ? latencyMin : 0;

  return {
    anchor: { pos: mode === "dormir" ? 0 : 1, time: anchorTime },
    latency: mode === "dormir" ? { from: 0, to: latencyMin / total } : { from: 1 - latencyMin / total, to: 1 },
    ticks: Array.from({ length: maxCycles + 1 }, (_, k) => (firstBoundary + k * cycleMin) / total),
    nodes: options.map((o) => ({ pos: at(o.minutes), time: o.time, cycles: o.cycles, emphasis: o.emphasis })),
  };
}
