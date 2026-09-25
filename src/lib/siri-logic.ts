import { createHash, timingSafeEqual } from "node:crypto";

/* Lógica pura de las rutas /api/siri/* (Atajos de iPhone → Mafer OS).
 * Sin base de datos ni Next: se prueba sola en tests/siri-logic.test.ts. */

export const MAX_TEXTO = 2000;

/** Compara el «Authorization: Bearer <clave>» con SIRI_TOKEN en tiempo
 *  constante. Sin SIRI_TOKEN configurado (o con uno corto) la puerta queda
 *  cerrada: nunca se abre por olvido de configuración. */
export function tokenValido(authHeader: string | null, secreto: string | undefined): boolean {
  if (!secreto || secreto.length < 32 || !authHeader) return false;
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!m) return false;
  // Hash de ambos lados → mismo largo siempre, timingSafeEqual no revienta.
  const a = createHash("sha256").update(m[1].trim()).digest();
  const b = createHash("sha256").update(secreto).digest();
  return timingSafeEqual(a, b);
}

type Resultado<T> = { ok: true; datos: T } | { ok: false; error: string };

function texto(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function parseInbox(body: unknown): Resultado<{ content: string }> {
  const content = texto((body as Record<string, unknown> | null)?.texto);
  if (!content) return { ok: false, error: "Falta el texto." };
  if (content.length > MAX_TEXTO) return { ok: false, error: "El texto es demasiado largo." };
  return { ok: true, datos: { content } };
}

const FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;
/** ISO 8601 como lo da Atajos («Formatear fecha → ISO 8601»):
 *  2026-09-26T17:00:00-06:00. Se toma la fecha y hora TAL COMO vienen escritas,
 *  que es la hora local del teléfono (la de Mafer), sin convertir a UTC. */
const ISO = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/;

function fechaReal(f: string): boolean {
  const m = f.match(FECHA);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

function sumarMinutos(hora: string, minutos: number): string {
  const [h, m] = hora.split(":").map(Number);
  // Un evento no cruza la medianoche: se recorta a 23:59.
  const total = Math.min(h * 60 + m + minutos, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export type EventoSiri = { title: string; date: string; startTime: string | null; endTime: string | null };

/** { titulo, fecha, hora?, duracion? }
 *  - fecha: «2026-09-26» o ISO con hora («2026-09-26T17:00:00-06:00»).
 *  - hora: «17:00» (opcional; gana a la hora del ISO). Sin hora = todo el día.
 *  - duracion: minutos (opcional, 60 por defecto si hay hora). */
export function parseEvento(body: unknown): Resultado<EventoSiri> {
  const b = (body ?? {}) as Record<string, unknown>;
  const title = texto(b.titulo);
  if (!title) return { ok: false, error: "Falta el título del evento." };
  if (title.length > 300) return { ok: false, error: "El título es demasiado largo." };

  let date = texto(b.fecha);
  let startTime: string | null = null;
  const iso = date.match(ISO);
  if (iso) {
    date = iso[1];
    startTime = iso[2];
  }
  if (!fechaReal(date)) return { ok: false, error: "No entendí la fecha (usa AAAA-MM-DD)." };

  const hora = texto(b.hora);
  if (hora) {
    if (!HORA.test(hora)) return { ok: false, error: "No entendí la hora (usa HH:MM)." };
    startTime = hora;
  }

  let endTime: string | null = null;
  if (startTime) {
    const dur = b.duracion === undefined || b.duracion === "" ? 60 : Number(b.duracion);
    if (!Number.isFinite(dur) || dur <= 0 || dur > 24 * 60) {
      return { ok: false, error: "La duración debe ser en minutos." };
    }
    endTime = sumarMinutos(startTime, Math.round(dur));
  }
  return { ok: true, datos: { title, date, startTime, endTime } };
}
