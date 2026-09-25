/**
 * Zona horaria única de Mafer OS.
 *
 * Todo el sistema vive en la hora de México, siempre — incluso si Mafer está
 * viajando. Un pendiente del martes es del martes en Ciudad de México; no
 * cambia de día al cruzar un huso horario.
 *
 * Esto NO se puede dejar en manos de la zona horaria del proceso: en local es
 * México, pero en Vercel las funciones corren en UTC. Con `new Date()` y los
 * getters locales, a partir de las 18:00 hora de México el servidor ya cree que
 * es el día siguiente y la app muestra los pendientes de mañana como de hoy.
 *
 * Regla: ninguna fecha de calendario (YYYY-MM-DD) se calcula con
 * `toISOString()` ni con `getFullYear()/getMonth()/getDate()`. Siempre con los
 * helpers de este archivo.
 */

/** Se puede sobrescribir con MAFER_TZ (mismo nombre que ya usan los scripts de export). */
export const TIMEZONE = process.env.MAFER_TZ ?? "America/Mexico_City";

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Fecha de calendario (YYYY-MM-DD) que corresponde a un instante, en la zona de
 * la app. Acepta un Date o un timestamp ISO guardado en la base.
 */
export function toLocalDate(instant: Date | string, timeZone: string = TIMEZONE): string {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  const parts = formatter(timeZone).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Hoy (YYYY-MM-DD) en hora de México, sin importar dónde corra el servidor. */
export function today(timeZone: string = TIMEZONE): string {
  return toLocalDate(new Date(), timeZone);
}

/**
 * Suma (o resta) días a una fecha de calendario. Opera sobre el string, no
 * sobre un instante, así que no depende de ninguna zona horaria ni se rompe en
 * los cambios de horario de verano.
 */
export function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() + n);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
