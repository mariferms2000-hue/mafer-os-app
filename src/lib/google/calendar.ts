import "server-only";
import { google } from "googleapis";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getSetting, setSetting } from "@/lib/auth";

/**
 * Integración con Google Calendar.
 *
 * - Usa un calendario dedicado llamado "Mafer OS" (nunca toca los calendarios personales).
 * - Scope mínimo: `calendar.app.created` — la app solo puede gestionar calendarios
 *   que ella misma creó.
 * - Los tokens viven en la tabla `settings` (solo servidor). Nunca llegan al navegador.
 * - Si no hay credenciales configuradas, todas las funciones se comportan como no-op
 *   y la app sigue funcionando sin Google.
 */

const SCOPE = "https://www.googleapis.com/auth/calendar.app.created";
const TZ = "America/Mexico_City";

export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function oauthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:3000/api/google/callback"
  );
}

export function getGoogleAuthUrl(): string {
  return oauthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [SCOPE],
  });
}

export async function handleGoogleCallback(code: string) {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  await setSetting("google_tokens", JSON.stringify(tokens));
  await ensureMaferCalendar();
}

export async function disconnectGoogle() {
  const raw = await getSetting("google_tokens");
  if (raw) {
    try {
      const tokens = JSON.parse(raw);
      if (tokens.access_token) await oauthClient().revokeToken(tokens.access_token);
    } catch {
      /* el token ya podía estar revocado */
    }
  }
  await setSetting("google_tokens", "");
  await setSetting("google_calendar_id", "");
}

export async function isGoogleConnected(): Promise<boolean> {
  const raw = await getSetting("google_tokens");
  return Boolean(raw && raw !== "");
}

async function getAuthedClient() {
  const raw = await getSetting("google_tokens");
  if (!raw || !isGoogleConfigured()) return null;
  const client = oauthClient();
  client.setCredentials(JSON.parse(raw));
  // Persiste tokens refrescados para no pedir login otra vez.
  client.on("tokens", async (tokens) => {
    const prev = JSON.parse((await getSetting("google_tokens")) ?? "{}");
    await setSetting("google_tokens", JSON.stringify({ ...prev, ...tokens }));
  });
  return client;
}

/** Encuentra o crea el calendario dedicado "Mafer OS" y guarda su id. */
export async function ensureMaferCalendar(): Promise<string | null> {
  const auth = await getAuthedClient();
  if (!auth) return null;
  const saved = await getSetting("google_calendar_id");
  const cal = google.calendar({ version: "v3", auth });
  if (saved) {
    try {
      await cal.calendars.get({ calendarId: saved });
      return saved;
    } catch {
      /* fue borrado: crear de nuevo */
    }
  }
  const created = await cal.calendars.insert({
    requestBody: { summary: "Mafer OS", timeZone: TZ },
  });
  const id = created.data.id!;
  await setSetting("google_calendar_id", id);
  return id;
}

type GEvent = {
  title: string;
  date: string; // YYYY-MM-DD
  startTime?: string | null; // HH:MM
  endTime?: string | null;
  notes?: string | null;
  sourceRef: string; // "event:id" | "card:id" — para trazabilidad y anti-duplicados
};

function toRequestBody(e: GEvent) {
  const base = {
    summary: e.title,
    description: e.notes || undefined,
    extendedProperties: { private: { maferOsRef: e.sourceRef } },
    reminders: { useDefault: true },
  };
  if (e.startTime) {
    const start = `${e.date}T${e.startTime}:00`;
    const endTime = e.endTime ?? addHour(e.startTime);
    const end = `${e.date}T${endTime}:00`;
    return { ...base, start: { dateTime: start, timeZone: TZ }, end: { dateTime: end, timeZone: TZ } };
  }
  return { ...base, start: { date: e.date }, end: { date: e.date } };
}

function addHour(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return `${String(Math.min(h + 1, 23)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Crea o actualiza en Google el evento con id local `eventId`. Devuelve el id de Google. */
export async function syncEventToGoogle(eventId: string): Promise<string | null> {
  const auth = await getAuthedClient();
  if (!auth) return null;
  const calendarId = await ensureMaferCalendar();
  if (!calendarId) return null;
  const [e] = await db.select().from(schema.events).where(eq(schema.events.id, eventId)).limit(1);
  if (!e) return null;

  const cal = google.calendar({ version: "v3", auth });
  const body = toRequestBody({
    title: e.title,
    date: e.date,
    startTime: e.startTime,
    endTime: e.endTime,
    notes: e.notes,
    sourceRef: `event:${e.id}`,
  });

  if (e.gcalEventId) {
    // Actualiza el existente; si fue borrado en Google, crea uno nuevo.
    try {
      await cal.events.update({ calendarId, eventId: e.gcalEventId, requestBody: body });
      return e.gcalEventId;
    } catch {
      /* sigue al insert */
    }
  }
  const created = await cal.events.insert({ calendarId, requestBody: body });
  const gid = created.data.id!;
  await db.update(schema.events).set({ gcalEventId: gid }).where(eq(schema.events.id, e.id));
  return gid;
}

/** Sincroniza una tarjeta con recordatorio gcal-* como evento de Google. */
export async function syncCardToGoogle(cardId: string): Promise<string | null> {
  const auth = await getAuthedClient();
  if (!auth) return null;
  const [card] = await db.select().from(schema.cards).where(eq(schema.cards.id, cardId)).limit(1);
  if (!card) return null;

  // Sin recordatorio o sin fecha → si había evento en Google, se elimina.
  const wants = card.reminder?.startsWith("gcal") && card.dueDate;
  if (!wants) {
    if (card.gcalEventId) {
      await deleteGoogleEvent(card.gcalEventId).catch(() => {});
      await db.update(schema.cards).set({ gcalEventId: null }).where(eq(schema.cards.id, card.id));
    }
    return null;
  }

  const calendarId = await ensureMaferCalendar();
  if (!calendarId) return null;
  const cal = google.calendar({ version: "v3", auth });
  const timed = card.reminder === "gcal-timed" && card.startTime;
  const body = toRequestBody({
    title: card.title,
    date: card.dueDate!,
    startTime: timed ? card.startTime : null,
    notes: card.description,
    sourceRef: `card:${card.id}`,
  });

  if (card.gcalEventId) {
    try {
      await cal.events.update({ calendarId, eventId: card.gcalEventId, requestBody: body });
      return card.gcalEventId;
    } catch {
      /* sigue al insert */
    }
  }
  const created = await cal.events.insert({ calendarId, requestBody: body });
  const gid = created.data.id!;
  await db.update(schema.cards).set({ gcalEventId: gid }).where(eq(schema.cards.id, card.id));
  return gid;
}

export async function deleteGoogleEvent(gcalEventId: string) {
  const auth = await getAuthedClient();
  if (!auth) return;
  const calendarId = await getSetting("google_calendar_id");
  if (!calendarId) return;
  const cal = google.calendar({ version: "v3", auth });
  await cal.events.delete({ calendarId, eventId: gcalEventId });
}

export async function googleStatus() {
  return {
    configured: isGoogleConfigured(),
    connected: await isGoogleConnected(),
    calendarId: (await getSetting("google_calendar_id")) || null,
  };
}
