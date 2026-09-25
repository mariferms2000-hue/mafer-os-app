import { TIMEZONE, addDays } from "@/lib/tz";

/**
 * Cómo se traduce un evento de Mafer OS al cuerpo que espera la API de Google
 * Calendar. Aparte de `calendar.ts` y sin `server-only` para poder probarlo.
 */

export type GEvent = {
  title: string;
  date: string; // YYYY-MM-DD
  startTime?: string | null; // HH:MM
  endTime?: string | null;
  notes?: string | null;
  sourceRef: string; // "event:id" | "card:id" — para trazabilidad y anti-duplicados
};

const LAST_MINUTE = "23:59";

/**
 * Hora de fin por defecto: una hora después del inicio, sin desbordar el día.
 * Google rechaza los eventos de duración cero, así que un inicio a las 23:30
 * termina a las 23:59, no a las 23:30.
 */
export function defaultEndTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (h + 1 > 23) return LAST_MINUTE;
  return `${String(h + 1).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function toRequestBody(e: GEvent) {
  const base = {
    summary: e.title,
    description: e.notes || undefined,
    extendedProperties: { private: { maferOsRef: e.sourceRef } },
    reminders: { useDefault: true },
  };

  if (e.startTime) {
    // Un fin anterior o igual al inicio da duración cero o negativa: Google lo
    // rechaza con 400 y la sincronización se perdía en silencio.
    const end = e.endTime && e.endTime > e.startTime ? e.endTime : defaultEndTime(e.startTime);
    return {
      ...base,
      start: { dateTime: `${e.date}T${e.startTime}:00`, timeZone: TIMEZONE },
      end: { dateTime: `${e.date}T${end}:00`, timeZone: TIMEZONE },
    };
  }

  // Día completo: para Google, `end.date` es EXCLUSIVO — el día siguiente.
  // Mandar el mismo día que el inicio es un evento de duración cero.
  return { ...base, start: { date: e.date }, end: { date: addDays(e.date, 1) } };
}
