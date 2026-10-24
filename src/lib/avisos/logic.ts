import { TIMEZONE, addDays } from "@/lib/tz";

/**
 * Avisos de tareas en Google Calendar (Bloque 3) — reglas puras, sin Google ni
 * base de datos, para poder probarlas una por una.
 *
 * Un aviso es un evento CORTO (15 min) en el calendario «Mafer OS · Avisos» a la
 * fecha y hora de la tarea, con una alerta explícita (`reminders.overrides`). No
 * se apoya en las alertas predeterminadas del calendario: en un calendario
 * creado por la app suelen ser ninguna, y el aviso no sonaría.
 *
 * Cada evento lleva dos marcas privadas que lo identifican de forma verificable:
 *   maferOsRef   = "card:<id>"   (la misma que usaba el sistema anterior)
 *   maferOsAviso = "1"           (solo los avisos nuevos)
 * La limpieza solo puede proponer eventos con `maferOsRef` de tarea; los
 * eventos de compromisos ("event:<id>") o sin marca jamás entran en una lista.
 */

export const LEAD_OPTIONS = [
  { minutes: 0, label: "A la hora" },
  { minutes: 10, label: "10 min antes" },
  { minutes: 30, label: "30 min antes" },
  { minutes: 60, label: "1 hora antes" },
  { minutes: 1440, label: "1 día antes" },
] as const;

export const DEFAULT_LEAD = 0;
export const DEFAULT_AVISO_TIME = "09:00";
export const AVISO_DURATION_MIN = 15;
export const AVISOS_CALENDAR_NAME = "Mafer OS · Avisos";

export function normalizeLead(v: unknown): number {
  const n = Number(v);
  return LEAD_OPTIONS.some((o) => o.minutes === n) ? n : DEFAULT_LEAD;
}

export function leadLabel(minutes: number): string {
  return LEAD_OPTIONS.find((o) => o.minutes === minutes)?.label ?? `${minutes} min antes`;
}

export const cardRef = (cardId: string) => `card:${cardId}`;

/** id de la tarea de una marca `card:<id>`, o null si la marca es de otra cosa. */
export function cardIdFromRef(ref: string | null | undefined): string | null {
  return ref && ref.startsWith("card:") && ref.length > 5 ? ref.slice(5) : null;
}

/** Los recordatorios del sistema anterior (calendario «Mafer OS»). */
export function isLegacyReminder(reminder: string | null | undefined): boolean {
  return Boolean(reminder && reminder.startsWith("gcal"));
}

export type AvisoCard = {
  id: string;
  title: string;
  dueDate: string | null;
  startTime: string | null;
  completedAt: string | null;
  archived: boolean | null;
};

export type AvisoWhen = { date: string; time: string; lead: number };

/** ¿Debe existir el evento en Google ahora mismo? Sin fila no hay aviso; con
 *  fila, solo si la tarea está abierta y tiene fecha y hora. */
export function desiredAviso(card: AvisoCard | null, row: { leadMinutes: number } | null): AvisoWhen | null {
  if (!card || !row) return null;
  if (card.completedAt || card.archived) return null;
  if (!card.dueDate || !card.startTime) return null;
  return { date: card.dueDate, time: card.startTime, lead: normalizeLead(row.leadMinutes) };
}

/** Por qué una tarea con «Avisarme» no tiene evento ahora (para mostrarlo). */
export function avisoPausedReason(card: AvisoCard): string | null {
  if (card.completedAt) return "La tarea está completada: el aviso se quitó de Google.";
  if (card.archived) return "La tarea está archivada: el aviso se quitó de Google.";
  if (!card.dueDate) return "Sin fecha: el aviso vuelve cuando le pongas una.";
  if (!card.startTime) return "Sin hora: el aviso vuelve cuando le pongas una.";
  return null;
}

function addMinutes(date: string, time: string, minutes: number): { date: string; time: string } {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const days = Math.floor(total / 1440);
  const rest = ((total % 1440) + 1440) % 1440;
  return {
    date: addDays(date, days),
    time: `${String(Math.floor(rest / 60)).padStart(2, "0")}:${String(rest % 60).padStart(2, "0")}`,
  };
}

export type AvisoEventBody = {
  summary: string;
  description: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  transparency: "transparent";
  reminders: { useDefault: false; overrides: { method: "popup"; minutes: number }[] };
  extendedProperties: { private: { maferOsRef: string; maferOsAviso: "1" } };
};

/** Cuerpo del evento de Google para el aviso de una tarea. */
export function avisoEventBody(card: { id: string; title: string }, when: AvisoWhen, appUrl: string): AvisoEventBody {
  const end = addMinutes(when.date, when.time, AVISO_DURATION_MIN);
  return {
    summary: `🔔 ${card.title}`,
    description: `Aviso de Mafer OS. Abrir la tarea: ${appUrl.replace(/\/$/, "")}/?abrir=${card.id}`,
    start: { dateTime: `${when.date}T${when.time}:00`, timeZone: TIMEZONE },
    end: { dateTime: `${end.date}T${end.time}:00`, timeZone: TIMEZONE },
    // un aviso no ocupa tiempo: no marca «ocupada» en la agenda
    transparency: "transparent",
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: when.lead }] },
    extendedProperties: { private: { maferOsRef: cardRef(card.id), maferOsAviso: "1" } },
  };
}

/* ── Revisión de lo existente (migración y limpieza) ─────────────────────── */

export type ReviewCard = AvisoCard & { reminder: string | null; gcalEventId: string | null };

export type CalendarEventLite = {
  id: string;
  summary: string;
  start: string | null; // YYYY-MM-DD o ISO
  ref: string | null; // extendedProperties.private.maferOsRef
  aviso: boolean; // extendedProperties.private.maferOsAviso === "1"
};

export type MoveItem = {
  cardId: string;
  title: string;
  dueDate: string | null;
  startTime: string | null;
  /** la tarea no tiene hora: se le pondrá 9:00 para que el aviso pueda sonar */
  setsTime: boolean;
  /** sin fecha o con fecha pasada: no se crea evento nuevo, el aviso queda en pausa */
  paused: boolean;
  /** evento actual en «Mafer OS» que se borrará al moverlo (si existe en Google) */
  oldEvent: CalendarEventLite | null;
};

export type GhostItem = {
  calendar: "mafer-os" | "avisos";
  event: CalendarEventLite;
  cardId: string;
  cardTitle: string | null;
  reason: string;
};

export type AvisosReview = {
  moves: MoveItem[];
  ghosts: GhostItem[];
  /** cuántos eventos de cada calendario se revisaron y se dejaron intactos */
  untouched: { maferOs: number; avisos: number };
  stats: { legacyTimed: number; legacyAllDay: number; legacyWithGoogleId: number; avisos: number };
};

/**
 * Qué propondría la revisión. Pura: recibe lo que hay en la base y en los dos
 * calendarios y no cambia nada.
 *
 * Mover: tareas ABIERTAS con recordatorio anterior (gcal-*). Su evento actual
 * en «Mafer OS» (si existe) se borrará solo cuando el aviso nuevo quede creado.
 *
 * Fantasma (solo eventos con marca `card:<id>`):
 *  - en «Mafer OS»: la tarea ya no existe, está completada o archivada, ya no
 *    tiene recordatorio, o el evento no es el que la tarea tiene vinculado
 *    (duplicado). Las tareas que se van a mover no cuentan como fantasma.
 *  - en «Mafer OS · Avisos»: avisos sin fila que los respalde o duplicados.
 */
export function reviewAvisos(input: {
  today: string;
  cards: ReviewCard[];
  reminders: { cardId: string; gcalEventId: string | null }[];
  maferOsEvents: CalendarEventLite[];
  avisosEvents: CalendarEventLite[];
}): AvisosReview {
  const { today, cards, reminders, maferOsEvents, avisosEvents } = input;
  const byId = new Map(cards.map((c) => [c.id, c]));
  const rowByCard = new Map(reminders.map((r) => [r.cardId, r]));
  const open = (c: ReviewCard) => !c.completedAt && !c.archived;

  const legacyOpen = cards.filter((c) => open(c) && isLegacyReminder(c.reminder) && !rowByCard.has(c.id));
  const eventById = new Map(maferOsEvents.map((e) => [e.id, e]));

  const moves: MoveItem[] = legacyOpen.map((c) => {
    const time = c.startTime || null;
    return {
      cardId: c.id,
      title: c.title,
      dueDate: c.dueDate,
      startTime: time,
      setsTime: Boolean(c.dueDate) && !time,
      paused: !c.dueDate || c.dueDate < today,
      oldEvent: c.gcalEventId ? (eventById.get(c.gcalEventId) ?? null) : null,
    };
  });
  const moving = new Set(moves.map((m) => m.oldEvent?.id).filter(Boolean));

  const ghosts: GhostItem[] = [];
  let untouchedMafer = 0;
  for (const e of maferOsEvents) {
    const cardId = cardIdFromRef(e.ref);
    if (!cardId || moving.has(e.id)) {
      untouchedMafer++;
      continue;
    }
    const c = byId.get(cardId);
    const reason = !c
      ? "La tarea ya no existe."
      : c.completedAt
        ? "La tarea está completada."
        : c.archived
          ? "La tarea está archivada."
          : !isLegacyReminder(c.reminder)
            ? "La tarea ya no tiene recordatorio."
            : c.gcalEventId !== e.id
              ? "Evento repetido: la tarea está vinculada a otro evento."
              : null;
    if (reason) ghosts.push({ calendar: "mafer-os", event: e, cardId, cardTitle: c?.title ?? null, reason });
    else untouchedMafer++;
  }

  let untouchedAvisos = 0;
  for (const e of avisosEvents) {
    const cardId = cardIdFromRef(e.ref);
    if (!cardId || !e.aviso) {
      untouchedAvisos++;
      continue;
    }
    const row = rowByCard.get(cardId);
    const reason = !row
      ? byId.has(cardId)
        ? "La tarea ya no tiene «Avisarme»."
        : "La tarea ya no existe."
      : row.gcalEventId !== e.id
        ? "Aviso repetido: la tarea está vinculada a otro evento."
        : null;
    if (reason) ghosts.push({ calendar: "avisos", event: e, cardId, cardTitle: byId.get(cardId)?.title ?? null, reason });
    else untouchedAvisos++;
  }

  return {
    moves,
    ghosts,
    untouched: { maferOs: untouchedMafer, avisos: untouchedAvisos },
    stats: {
      legacyTimed: cards.filter((c) => c.reminder === "gcal-timed").length,
      legacyAllDay: cards.filter((c) => c.reminder === "gcal-allday").length,
      legacyWithGoogleId: cards.filter((c) => isLegacyReminder(c.reminder) && c.gcalEventId).length,
      avisos: reminders.length,
    },
  };
}

/** Mensaje entendible para un fallo de Google (nunca incluye datos sensibles). */
export function googleErrorMessage(e: unknown): string {
  const err = e as { code?: number | string; status?: number; response?: { status?: number }; message?: string };
  const status = Number(err?.response?.status ?? err?.status ?? err?.code);
  const msg = String(err?.message ?? "");
  if (/invalid_grant|unauthorized|invalid_token/i.test(msg) || status === 401) {
    return "Google pidió volver a conectar la cuenta (Ajustes → Google Calendar).";
  }
  if (status === 403 || status === 429) return "Google limitó las peticiones por un momento. Inténtalo de nuevo.";
  if (/ENOTFOUND|ECONNRESET|ETIMEDOUT|fetch failed|network/i.test(msg)) return "No hubo conexión con Google.";
  if (/no está conectado|no está configurado|simulad/i.test(msg)) return msg;
  return Number.isFinite(status) && status > 0
    ? `Google respondió con un error (código ${status}).`
    : "No se pudo hablar con Google Calendar.";
}
