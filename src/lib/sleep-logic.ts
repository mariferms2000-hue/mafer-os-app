/* Calculadora de ciclos de sueño — lógica pura (sin React, sin base, sin DOM).

   ES ORIENTATIVA, NO MÉDICA. Usa la heurística de calculadoras tipo Sleepytime:
   ciclos de ~90 min y ~15 min para quedarse dormida. En la realidad los ciclos
   duran ~70–120 min, se alargan durante la noche y varían entre personas; la
   evidencia de que despertar «entre ciclos» mejore cómo te sientes es limitada.

   Todo se calcula en MINUTOS DEL DÍA (0–1439) con módulo 1440, sin objetos
   Date: así no hay husos horarios ni medianoches de por medio.

   EXCEPCIÓN AL MANEJO DE ZONA HORARIA DE MAFER OS
   El resto del sistema vive siempre en hora de México (ver `tz.ts`). Aquí no:
   «Me voy a dormir ahora» usa la hora LOCAL DEL DISPOSITIVO
   (`minutesFromDeviceClock`), porque lo que importa es dónde está Mafer al
   acostarse — si está de viaje, su noche es la de ese lugar. Solo debe
   llamarse en el cliente: en el servidor (Vercel, UTC) daría otra hora. */

export const MINUTES_PER_DAY = 1440;

/** Duración aproximada de un ciclo de sueño. */
export const SLEEP_CYCLE_MIN = 90;

/** Tiempo aproximado para quedarse dormida. */
export const SLEEP_LATENCY_MIN = 15;

/** Ciclos que se ofrecen: 9 h, 7 h 30 min y 6 h. 4.5 h (3 ciclos) se omite a propósito. */
export const CYCLE_OPTIONS = [6, 5, 4] as const;

/** Desde cuántos ciclos una opción es «principal» (≥ 7 h 30 min de sueño). */
export const PRIMARY_MIN_CYCLES = 5;

export type SleepParams = {
  cycleMinutes?: number;
  latencyMinutes?: number;
};

export type SleepOption = {
  /** Minuto del día del resultado (0–1439). */
  minutes: number;
  /** El mismo resultado como "HH:MM" (24 h). */
  time: string;
  cycles: number;
  /** Tiempo dormida (ciclos × duración del ciclo), no tiempo en la cama. */
  sleepMinutes: number;
  /** "9 h", "7 h 30 min", "6 h". */
  durationLabel: string;
  /** Jerarquía visual: 9 h y 7 h 30 min son principales; 6 h, secundaria. */
  emphasis: "primary" | "secondary";
};

/** Lleva cualquier cantidad de minutos (negativa o > 1 día) al rango 0–1439. */
export function wrapMinutes(min: number): number {
  return ((min % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

/** "07:30" → 450. Devuelve null si no es una hora válida de 24 h. */
export function parseTime(hhmm: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** 450 → "07:30" (24 h, como el resto de Mafer OS). */
export function formatTime(min: number): string {
  const w = wrapMinutes(Math.round(min));
  return `${String(Math.floor(w / 60)).padStart(2, "0")}:${String(w % 60).padStart(2, "0")}`;
}

/** 540 → "9 h", 450 → "7 h 30 min", 45 → "45 min". */
export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

function option(minutes: number, cycles: number, cycleMinutes: number): SleepOption {
  const sleepMinutes = cycles * cycleMinutes;
  const w = wrapMinutes(minutes);
  return {
    minutes: w,
    time: formatTime(w),
    cycles,
    sleepMinutes,
    durationLabel: formatDuration(sleepMinutes),
    emphasis: cycles >= PRIMARY_MIN_CYCLES ? "primary" : "secondary",
  };
}

/** «Quiero despertar a…»: horas para acostarse, de la más temprana a la más tarde
 *  (22:15 · 23:45 · 01:15 para despertar a las 07:30). */
export function bedtimesFor(wakeMinutes: number, params: SleepParams = {}): SleepOption[] {
  const cycle = params.cycleMinutes ?? SLEEP_CYCLE_MIN;
  const latency = params.latencyMinutes ?? SLEEP_LATENCY_MIN;
  return CYCLE_OPTIONS.map((n) => option(wakeMinutes - latency - n * cycle, n, cycle));
}

/** «Quiero dormir a…» / «Me voy a dormir ahora»: horas para despertar, en orden
 *  cronológico (05:15 · 06:45 · 08:15 si te acuestas a las 23:00). */
export function wakeTimesFor(bedMinutes: number, params: SleepParams = {}): SleepOption[] {
  const cycle = params.cycleMinutes ?? SLEEP_CYCLE_MIN;
  const latency = params.latencyMinutes ?? SLEEP_LATENCY_MIN;
  return [...CYCLE_OPTIONS].reverse().map((n) => option(bedMinutes + latency + n * cycle, n, cycle));
}

/* ── Estado de la página (/sueno?modo=…&h=…) ──────────────────────────────
   La URL es la fuente de verdad. Estos helpers la leen y la escriben; nunca
   lanzan: cualquier valor desconocido cae en un valor por defecto. */

export type SleepMode = "despertar" | "dormir";

export const DEFAULT_TIMES: Record<SleepMode, string> = { despertar: "07:30", dormir: "23:00" };

export type SleepState = { mode: SleepMode; time: string };

export function parseSleepMode(v: string | null | undefined): SleepMode {
  return v === "dormir" ? "dormir" : "despertar";
}

/** Lee `modo` y `h`. Hora inválida o ausente → la de por defecto del modo.
 *  La hora sale normalizada ("7:30" → "07:30"). `canonical` es false cuando la
 *  URL recibida no coincide con el estado resultante (para reescribirla). */
export function readSleepState(params: { get(key: string): string | null }): SleepState & { canonical: boolean } {
  const rawMode = params.get("modo");
  const rawTime = params.get("h");
  const mode = parseSleepMode(rawMode);
  const minutes = parseTime(rawTime);
  const time = minutes === null ? DEFAULT_TIMES[mode] : formatTime(minutes);
  return { mode, time, canonical: rawMode === mode && rawTime === time };
}

/** "modo=dormir&h=23:00" — siempre en este orden. */
export function sleepStateQuery({ mode, time }: SleepState): string {
  return `modo=${mode}&h=${time}`;
}

/** ¿La URL trae estado propio? Sin `modo` ni `h` se usa lo guardado en el
 *  dispositivo (o los valores por defecto). */
export function hasSleepParams(params: { get(key: string): string | null }): boolean {
  return params.get("modo") !== null || params.get("h") !== null;
}

export const DEFAULT_SLEEP_STATE: SleepState = { mode: "despertar", time: DEFAULT_TIMES.despertar };

/* ── Última selección en este dispositivo (localStorage) ──────────────────
   Prioridad: URL > lo guardado aquí > valores por defecto. Solo se guardan el
   modo y la hora; todo lo demás se recalcula. */

export const SLEEP_STORAGE_KEY = "mafer-sueno";

export function serializeSleepState({ mode, time }: SleepState): string {
  return JSON.stringify({ modo: mode, hora: time });
}

/** Lee lo guardado con las mismas reglas que la URL, pero sin rellenar: si el
 *  modo o la hora no son válidos, o el JSON está roto, devuelve null y se usan
 *  los valores por defecto. Nunca lanza. */
export function parseStoredSleepState(raw: string | null | undefined): SleepState | null {
  if (!raw) return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;
    const { modo, hora } = data as { modo?: unknown; hora?: unknown };
    if (modo !== "despertar" && modo !== "dormir") return null;
    const minutes = typeof hora === "string" ? parseTime(hora) : null;
    if (minutes === null) return null;
    return { mode: modo, time: formatTime(minutes) };
  } catch {
    return null;
  }
}

/** Opciones según el modo: horas para acostarse o para despertar. */
export function optionsFor(mode: SleepMode, minutes: number, params: SleepParams = {}): SleepOption[] {
  return mode === "despertar" ? bedtimesFor(minutes, params) : wakeTimesFor(minutes, params);
}

/** Minuto del día según el reloj DEL DISPOSITIVO (excepción documentada arriba).
 *  Solo para el cliente. */
export function minutesFromDeviceClock(now: Date = new Date()): number {
  return now.getHours() * 60 + now.getMinutes();
}
