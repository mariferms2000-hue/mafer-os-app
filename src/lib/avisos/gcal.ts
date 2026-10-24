import "server-only";
import { google, type calendar_v3 } from "googleapis";
import { eq, like } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getSetting, setSetting } from "@/lib/auth";
import { TIMEZONE } from "@/lib/tz";
import { isPreviewDeployment } from "@/lib/data-environment";
import { calendarSuffix, getAuthedClient, isGoogleConfigured, isGoogleConnected } from "@/lib/google/calendar";
import { AVISOS_CALENDAR_NAME, type AvisoEventBody, type CalendarEventLite } from "./logic";

/**
 * Acceso a los calendarios para los avisos. Dos implementaciones con la misma
 * forma:
 *  - «google»: la API real, solo en producción y en la prueba local autorizada.
 *  - «simulado»: guarda los eventos en la propia base (tabla settings). Lo usan
 *    SIEMPRE las previews de Vercel y las pruebas E2E: nunca llegan a Google.
 * Una preview no puede elegir la API real aunque tenga credenciales.
 */

export type CalendarKind = "mafer-os" | "avisos";

const CAL_KEY: Record<CalendarKind, string> = {
  "mafer-os": "google_calendar_id",
  avisos: "google_avisos_calendar_id",
};

export interface CalendarPort {
  mode: "google" | "simulado";
  /** ¿hay cuenta conectada con la que trabajar? */
  connected(): Promise<boolean>;
  /** id del calendario si ya existe (no crea nada). */
  calendarId(kind: CalendarKind): Promise<string | null>;
  /** id del calendario de avisos, creándolo si falta. */
  ensureAvisosCalendar(): Promise<string>;
  insert(calendarId: string, body: AvisoEventBody): Promise<string>;
  /** «gone» si el evento ya no existe en Google. */
  update(calendarId: string, eventId: string, body: AvisoEventBody): Promise<"ok" | "gone">;
  remove(calendarId: string, eventId: string): Promise<"ok" | "gone">;
  get(calendarId: string, eventId: string): Promise<CalendarEventLite | null>;
  /** avisos (marca maferOsAviso) de una tarea concreta. */
  findAvisos(calendarId: string, ref: string): Promise<CalendarEventLite[]>;
  listAll(calendarId: string): Promise<CalendarEventLite[]>;
  /** evento de prueba con una alerta «a la hora». */
  insertTest(calendarId: string, startIso: string, endIso: string, ref: string): Promise<string>;
}

export function isSimulatedGoogle(): boolean {
  return isPreviewDeployment() || process.env.GOOGLE_SIMULATED === "1";
}

export function calendarPort(): CalendarPort {
  return isSimulatedGoogle() ? simulatedPort : googlePort;
}

/* ── Google real ─────────────────────────────────────────────────────────── */

const statusOf = (e: unknown) => Number((e as { code?: unknown; response?: { status?: unknown } })?.response?.status ?? (e as { code?: unknown })?.code);
const isGone = (e: unknown) => [404, 410].includes(statusOf(e));

function lite(e: calendar_v3.Schema$Event): CalendarEventLite {
  const p = e.extendedProperties?.private ?? {};
  return {
    id: e.id!,
    summary: e.summary ?? "(sin título)",
    start: e.start?.dateTime ?? e.start?.date ?? null,
    ref: p.maferOsRef ?? null,
    aviso: p.maferOsAviso === "1",
  };
}

async function api() {
  const auth = await getAuthedClient();
  if (!auth) {
    throw new Error(
      isGoogleConfigured()
        ? "Google Calendar no está conectado (Ajustes → Google Calendar)."
        : "Google Calendar no está configurado en este entorno."
    );
  }
  return google.calendar({ version: "v3", auth });
}

const googlePort: CalendarPort = {
  mode: "google",
  async connected() {
    return isGoogleConfigured() && (await isGoogleConnected());
  },
  async calendarId(kind) {
    const saved = await getSetting(CAL_KEY[kind]);
    if (!saved) return null;
    try {
      await (await api()).calendars.get({ calendarId: saved });
      return saved;
    } catch (e) {
      if (isGone(e)) return null;
      throw e;
    }
  },
  async ensureAvisosCalendar() {
    const existing = await this.calendarId("avisos");
    if (existing) return existing;
    const created = await (await api()).calendars.insert({
      requestBody: {
        summary: `${AVISOS_CALENDAR_NAME}${calendarSuffix()}`,
        description: "Avisos de tareas de Mafer OS. Lo gestiona la app: no hace falta editarlo a mano.",
        timeZone: TIMEZONE,
      },
    });
    const id = created.data.id!;
    await setSetting(CAL_KEY.avisos, id);
    return id;
  },
  async insert(calendarId, body) {
    const r = await (await api()).events.insert({ calendarId, requestBody: body });
    return r.data.id!;
  },
  async update(calendarId, eventId, body) {
    try {
      await (await api()).events.update({ calendarId, eventId, requestBody: body });
      return "ok";
    } catch (e) {
      if (isGone(e)) return "gone";
      throw e;
    }
  },
  async remove(calendarId, eventId) {
    try {
      await (await api()).events.delete({ calendarId, eventId });
      return "ok";
    } catch (e) {
      if (isGone(e)) return "gone";
      throw e;
    }
  },
  async get(calendarId, eventId) {
    try {
      const r = await (await api()).events.get({ calendarId, eventId });
      return r.data.status === "cancelled" ? null : lite(r.data);
    } catch (e) {
      if (isGone(e)) return null;
      throw e;
    }
  },
  async findAvisos(calendarId, ref) {
    const r = await (await api()).events.list({
      calendarId,
      privateExtendedProperty: [`maferOsRef=${ref}`, "maferOsAviso=1"],
      maxResults: 50,
    });
    return (r.data.items ?? []).filter((e) => e.status !== "cancelled").map(lite);
  },
  async listAll(calendarId) {
    const cal = await api();
    const out: CalendarEventLite[] = [];
    let pageToken: string | undefined;
    do {
      const r = await cal.events.list({ calendarId, maxResults: 2500, pageToken, showDeleted: false });
      for (const e of r.data.items ?? []) if (e.status !== "cancelled") out.push(lite(e));
      pageToken = r.data.nextPageToken ?? undefined;
    } while (pageToken);
    return out;
  },
  async insertTest(calendarId, startIso, endIso, ref) {
    const r = await (await api()).events.insert({
      calendarId,
      requestBody: {
        summary: "🔔 Prueba de avisos de Mafer OS",
        description: "Evento de prueba. Si te llegó la notificación, los avisos funcionan. Se puede borrar desde Ajustes.",
        start: { dateTime: startIso, timeZone: TIMEZONE },
        end: { dateTime: endIso, timeZone: TIMEZONE },
        transparency: "transparent",
        reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 0 }] },
        extendedProperties: { private: { maferOsRef: ref, maferOsAviso: "1" } },
      },
    });
    return r.data.id!;
  },
};

/* ── Simulado (previews y E2E) ───────────────────────────────────────────── */

const SIM_PREFIX = "sim_gcal_ev:";
export const SIM_FAIL_KEY = "sim_gcal_falla";
const SIM_AVISOS_ID = "sim-avisos";

type SimEvent = CalendarEventLite & { calendarId: string; end: string | null; lead: number | null };

async function simFailIfAsked() {
  if ((await getSetting(SIM_FAIL_KEY)) === "1") throw new Error("Fallo simulado de Google (modo de prueba).");
}

async function simAll(): Promise<SimEvent[]> {
  const rows = await db.select().from(schema.settings).where(like(schema.settings.key, `${SIM_PREFIX}%`));
  return rows.map((r) => JSON.parse(r.value) as SimEvent);
}

async function simPut(e: SimEvent) {
  await setSetting(`${SIM_PREFIX}${e.calendarId}:${e.id}`, JSON.stringify(e));
}

function simFrom(calendarId: string, id: string, body: AvisoEventBody): SimEvent {
  return {
    id,
    calendarId,
    summary: body.summary,
    start: body.start.dateTime,
    end: body.end.dateTime,
    lead: body.reminders.overrides[0]?.minutes ?? null,
    ref: body.extendedProperties.private.maferOsRef,
    aviso: true,
  };
}

const simulatedPort: CalendarPort = {
  mode: "simulado",
  async connected() {
    return true;
  },
  async calendarId(kind) {
    return (await getSetting(CAL_KEY[kind])) || null;
  },
  async ensureAvisosCalendar() {
    const existing = await this.calendarId("avisos");
    if (existing) return existing;
    await simFailIfAsked();
    await setSetting(CAL_KEY.avisos, SIM_AVISOS_ID);
    return SIM_AVISOS_ID;
  },
  async insert(calendarId, body) {
    await simFailIfAsked();
    const id = `sim${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
    await simPut(simFrom(calendarId, id, body));
    return id;
  },
  async update(calendarId, eventId, body) {
    await simFailIfAsked();
    if (!(await getSetting(`${SIM_PREFIX}${calendarId}:${eventId}`))) return "gone";
    await simPut(simFrom(calendarId, eventId, body));
    return "ok";
  },
  async remove(calendarId, eventId) {
    await simFailIfAsked();
    const key = `${SIM_PREFIX}${calendarId}:${eventId}`;
    if (!(await getSetting(key))) return "gone";
    await db.delete(schema.settings).where(eq(schema.settings.key, key));
    return "ok";
  },
  async get(calendarId, eventId) {
    const raw = await getSetting(`${SIM_PREFIX}${calendarId}:${eventId}`);
    return raw ? (JSON.parse(raw) as SimEvent) : null;
  },
  async findAvisos(calendarId, ref) {
    return (await simAll()).filter((e) => e.calendarId === calendarId && e.ref === ref && e.aviso);
  },
  async listAll(calendarId) {
    return (await simAll()).filter((e) => e.calendarId === calendarId);
  },
  async insertTest(calendarId, startIso, endIso, ref) {
    await simFailIfAsked();
    const id = `simtest${Date.now()}`;
    await simPut({ id, calendarId, summary: "🔔 Prueba de avisos de Mafer OS", start: startIso, end: endIso, lead: 0, ref, aviso: true });
    return id;
  },
};

/** Para mostrar en Ajustes qué «enviaría» la app en modo simulado. */
export async function simulatedEvents(): Promise<(CalendarEventLite & { calendarId: string; lead: number | null })[]> {
  if (!isSimulatedGoogle()) return [];
  return (await simAll()).sort((a, b) => String(a.start).localeCompare(String(b.start)));
}
