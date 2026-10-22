import "server-only";
import { eq, inArray, isNotNull } from "drizzle-orm";
import { db, now, schema, today } from "@/lib/db";
import { getSetting, setSetting } from "@/lib/auth";
import { calendarPort, type CalendarKind } from "./gcal";
import {
  DEFAULT_AVISO_TIME,
  avisoEventBody,
  cardRef,
  desiredAviso,
  googleErrorMessage,
  isLegacyReminder,
  normalizeLead,
  reviewAvisos,
  type AvisosReview,
  type CalendarEventLite,
} from "./logic";

/**
 * Sincronización de los avisos con Google (o con el simulador en previews/E2E).
 *
 * Reglas que protegen los datos de Mafer:
 *  - Mientras «avisos_activos» no esté encendido, nada de esto corre y la app
 *    se comporta exactamente como antes del Bloque 3.
 *  - Solo se escribe en el calendario «Mafer OS · Avisos». El calendario
 *    «Mafer OS» (compromisos y recordatorios anteriores) solo se toca al aplicar
 *    una revisión que Mafer aprobó evento por evento.
 *  - Ningún fallo se silencia: queda en `card_reminders.last_error`, se devuelve
 *    a la pantalla y se repara con «Reparar avisos».
 */

export const ACTIVE_KEY = "avisos_activos";
export const TEST_EVENT_KEY = "avisos_prueba";

const appUrl = () => process.env.APP_URL || "https://mafer-os-app.vercel.app";

export type AvisoRow = typeof schema.cardReminders.$inferSelect;
export type SyncResult = { ok: true } | { ok: false; error: string };

/* ── Estado ──────────────────────────────────────────────────────────────── */

let tableReady = false;
/** ¿Existe la tabla card_reminders? Producción la recibe antes del merge; si
 *  aún faltara, los avisos se muestran como no disponibles en vez de romper. */
export async function avisosTableReady(): Promise<boolean> {
  if (tableReady) return true;
  try {
    await db.select({ id: schema.cardReminders.cardId }).from(schema.cardReminders).limit(1);
    tableReady = true;
  } catch {
    tableReady = false;
  }
  return tableReady;
}

export async function avisosActive(): Promise<boolean> {
  return (await getSetting(ACTIVE_KEY)) === "1" && (await avisosTableReady());
}

export async function getAvisoRow(cardId: string): Promise<AvisoRow | null> {
  if (!(await avisosTableReady())) return null;
  const [row] = await db.select().from(schema.cardReminders).where(eq(schema.cardReminders.cardId, cardId)).limit(1);
  return row ?? null;
}

export async function avisoErrorCount(): Promise<number> {
  if (!(await avisosActive())) return 0;
  const rows = await db
    .select({ id: schema.cardReminders.cardId })
    .from(schema.cardReminders)
    .where(isNotNull(schema.cardReminders.lastError));
  return rows.length;
}

/* ── Una tarea ───────────────────────────────────────────────────────────── */

async function loadCard(cardId: string) {
  const [card] = await db.select().from(schema.cards).where(eq(schema.cards.id, cardId)).limit(1);
  return card ?? null;
}

async function saveRow(cardId: string, patch: Partial<AvisoRow>) {
  await db.update(schema.cardReminders).set({ ...patch, updatedAt: now() }).where(eq(schema.cardReminders.cardId, cardId));
}

async function ensureConnected() {
  const port = calendarPort();
  if (!(await port.connected())) throw new Error("Google Calendar no está conectado (Ajustes → Google Calendar).");
  return port;
}

/** Deja Google como dice la tarea: crea, actualiza o quita su aviso. Nunca
 *  crea un segundo evento: antes de insertar busca el que ya tenga su marca. */
export async function syncAviso(cardId: string): Promise<SyncResult> {
  const row = await getAvisoRow(cardId);
  if (!row) return { ok: true };
  const card = await loadCard(cardId);
  let when = desiredAviso(card, row);
  // una fecha ya pasada no estrena evento (no sonaría); si ya lo tenía, se conserva
  if (when && when.date < today() && !row.gcalEventId) when = null;
  try {
    const port = await ensureConnected();
    if (!when || !card) {
      if (row.gcalEventId && row.calendarId) await port.remove(row.calendarId, row.gcalEventId);
      await saveRow(cardId, { gcalEventId: null, lastError: null, lastSyncedAt: now() });
      return { ok: true };
    }
    const cal = await port.ensureAvisosCalendar();
    const body = avisoEventBody(card, when, appUrl());
    if (row.gcalEventId && row.calendarId && row.calendarId !== cal) {
      // el calendario de avisos se volvió a crear: el evento viejo sobra
      await port.remove(row.calendarId, row.gcalEventId);
    }
    let id = row.calendarId === cal ? row.gcalEventId : null;
    if (id && (await port.update(cal, id, body)) === "gone") id = null;
    if (!id) {
      const found = await port.findAvisos(cal, cardRef(cardId));
      if (found.length) {
        id = found[0].id;
        await port.update(cal, id, body);
        for (const extra of found.slice(1)) await port.remove(cal, extra.id);
      } else {
        id = await port.insert(cal, body);
      }
    }
    await saveRow(cardId, { calendarId: cal, gcalEventId: id, lastError: null, lastSyncedAt: now() });
    return { ok: true };
  } catch (e) {
    const error = googleErrorMessage(e);
    await saveRow(cardId, { lastError: error });
    return { ok: false, error };
  }
}

/** Enciende, ajusta o apaga «Avisarme» de una tarea y sincroniza. */
export async function setAviso(cardId: string, enabled: boolean, lead?: unknown): Promise<SyncResult> {
  const row = await getAvisoRow(cardId);
  if (!enabled) {
    if (!row) return { ok: true };
    if (row.gcalEventId && row.calendarId) {
      try {
        const port = await ensureConnected();
        await port.remove(row.calendarId, row.gcalEventId);
      } catch (e) {
        // la fila se queda (con el error) para poder reintentar el borrado
        const error = googleErrorMessage(e);
        await saveRow(cardId, { lastError: `No se pudo quitar el aviso de Google: ${error}` });
        return { ok: false, error };
      }
    }
    await db.delete(schema.cardReminders).where(eq(schema.cardReminders.cardId, cardId));
    return { ok: true };
  }
  const leadMinutes = normalizeLead(lead);
  if (row) await saveRow(cardId, { leadMinutes });
  else {
    const t = now();
    await db.insert(schema.cardReminders).values({ cardId, leadMinutes, createdAt: t, updatedAt: t });
  }
  return syncAviso(cardId);
}

/** Antes de eliminar una tarea: quita su aviso. Si Google falla, la tarea se
 *  elimina igual y el evento queda identificable para la limpieza. */
export async function removeAvisoBeforeDelete(cardIds: string[]): Promise<SyncResult> {
  if (!cardIds.length || !(await avisosActive())) return { ok: true };
  const rows = await db.select().from(schema.cardReminders).where(inArray(schema.cardReminders.cardId, cardIds));
  let error: string | null = null;
  for (const row of rows) {
    if (row.gcalEventId && row.calendarId) {
      try {
        const port = await ensureConnected();
        await port.remove(row.calendarId, row.gcalEventId);
      } catch (e) {
        error = googleErrorMessage(e);
      }
    }
    await db.delete(schema.cardReminders).where(eq(schema.cardReminders.cardId, row.cardId));
  }
  return error ? { ok: false, error: `${error} El aviso quedó en Google; aparecerá en Ajustes → Avisos para limpiarlo.` } : { ok: true };
}

/** Lo que llaman las acciones de tareas tras cada cambio. Devuelve el mensaje
 *  de error para mostrarlo, o undefined si todo quedó bien (o no aplica). */
export async function afterCardChange(cardId: string): Promise<string | undefined> {
  if (!(await avisosActive())) return undefined;
  const r = await syncAviso(cardId);
  return r.ok ? undefined : r.error;
}

/* ── Todas ───────────────────────────────────────────────────────────────── */

/** «Reparar avisos»: vuelve a dejar cada aviso como dice su tarea. */
export async function repairAvisos(): Promise<{ total: number; fallidos: number; error?: string }> {
  const rows = await db.select({ id: schema.cardReminders.cardId }).from(schema.cardReminders);
  let fallidos = 0;
  let error: string | undefined;
  for (const r of rows) {
    const res = await syncAviso(r.id);
    if (!res.ok) {
      fallidos++;
      error ??= res.error;
    }
  }
  return { total: rows.length, fallidos, error };
}

/** Desactivar: quita de Google todos los avisos (las filas se conservan para
 *  reactivar) y vuelve al comportamiento anterior. */
export async function deactivateAvisos(): Promise<SyncResult> {
  const rows = await db.select().from(schema.cardReminders);
  let error: string | null = null;
  for (const row of rows) {
    if (!row.gcalEventId || !row.calendarId) continue;
    try {
      await (await ensureConnected()).remove(row.calendarId, row.gcalEventId);
      await saveRow(row.cardId, { gcalEventId: null, lastError: null });
    } catch (e) {
      error = googleErrorMessage(e);
      await saveRow(row.cardId, { lastError: error });
    }
  }
  if (error) return { ok: false, error };
  await setSetting(ACTIVE_KEY, "0");
  return { ok: true };
}

/* ── Aviso de prueba (para comprobar el iPhone y Alexa) ──────────────────── */

export async function createTestAviso(minutesFromNow = 5): Promise<SyncResult & { at?: string }> {
  try {
    const port = await ensureConnected();
    const cal = await port.ensureAvisosCalendar();
    await deleteTestAviso();
    const start = new Date(Date.now() + minutesFromNow * 60_000);
    start.setSeconds(0, 0);
    const end = new Date(start.getTime() + 15 * 60_000);
    const id = await port.insertTest(cal, start.toISOString(), end.toISOString(), `test:${start.getTime()}`);
    await setSetting(TEST_EVENT_KEY, JSON.stringify({ calendarId: cal, id, at: start.toISOString() }));
    return { ok: true, at: start.toISOString() };
  } catch (e) {
    return { ok: false, error: googleErrorMessage(e) };
  }
}

export async function getTestAviso(): Promise<{ calendarId: string; id: string; at: string } | null> {
  const raw = await getSetting(TEST_EVENT_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function deleteTestAviso(): Promise<SyncResult> {
  const t = await getTestAviso();
  if (!t) return { ok: true };
  try {
    await (await ensureConnected()).remove(t.calendarId, t.id);
    await setSetting(TEST_EVENT_KEY, "");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: googleErrorMessage(e) };
  }
}

/* ── Revisión de lo existente (solo lectura) y su aplicación aprobada ────── */

async function reviewInputs() {
  const port = await ensureConnected();
  const [maferId, avisosId] = await Promise.all([port.calendarId("mafer-os"), port.calendarId("avisos")]);
  const [maferOsEvents, avisosEvents] = await Promise.all([
    maferId ? port.listAll(maferId) : Promise.resolve([] as CalendarEventLite[]),
    avisosId ? port.listAll(avisosId) : Promise.resolve([] as CalendarEventLite[]),
  ]);
  const cards = await db
    .select({
      id: schema.cards.id,
      title: schema.cards.title,
      dueDate: schema.cards.dueDate,
      startTime: schema.cards.startTime,
      completedAt: schema.cards.completedAt,
      archived: schema.cards.archived,
      reminder: schema.cards.reminder,
      gcalEventId: schema.cards.gcalEventId,
    })
    .from(schema.cards);
  const reminders = (await avisosTableReady())
    ? await db.select({ cardId: schema.cardReminders.cardId, gcalEventId: schema.cardReminders.gcalEventId }).from(schema.cardReminders)
    : [];
  return { port, maferId, avisosId, cards, reminders, maferOsEvents, avisosEvents };
}

export type ReviewResult =
  | ({ ok: true; calendars: { maferOs: boolean; avisos: boolean } } & AvisosReview)
  | { ok: false; error: string };

/** Solo lee: no cambia nada ni en la base ni en Google. */
export async function reviewExistingAvisos(): Promise<ReviewResult> {
  try {
    const i = await reviewInputs();
    return {
      ok: true,
      calendars: { maferOs: Boolean(i.maferId), avisos: Boolean(i.avisosId) },
      ...reviewAvisos({ today: today(), ...i }),
    };
  } catch (e) {
    return { ok: false, error: googleErrorMessage(e) };
  }
}

export type ApplyOutcome = { moved: number; deleted: number; skipped: string[]; errors: string[] };

/**
 * Aplica SOLO lo que Mafer marcó. Antes de tocar nada vuelve a calcular la
 * revisión con los datos de este momento: un elemento que ya no figura en ella
 * (porque cambió algo) se salta y se informa, nunca se borra «a ciegas».
 *  - Mover: crea el aviso nuevo y, solo si quedó bien, borra el evento anterior
 *    de «Mafer OS» y desvincula la tarea. Si falla, la tarea vuelve a estar
 *    exactamente como antes.
 *  - Fantasma: borra ese evento concreto (comprobado por id y por su marca).
 */
export async function applyAvisosReview(input: { moveCardIds: string[]; ghostEventIds: string[] }): Promise<ApplyOutcome> {
  const out: ApplyOutcome = { moved: 0, deleted: 0, skipped: [], errors: [] };
  let i: Awaited<ReturnType<typeof reviewInputs>>;
  try {
    i = await reviewInputs();
  } catch (e) {
    out.errors.push(googleErrorMessage(e));
    return out;
  }
  const review = reviewAvisos({ today: today(), ...i });
  const { port } = i;

  for (const cardId of input.moveCardIds) {
    const m = review.moves.find((x) => x.cardId === cardId);
    if (!m) {
      out.skipped.push(`Tarea ${cardId}: ya no está en la lista para mover.`);
      continue;
    }
    const before = await loadCard(cardId);
    if (!before || !isLegacyReminder(before.reminder)) {
      out.skipped.push(`«${m.title}»: cambió desde la revisión.`);
      continue;
    }
    const t = now();
    await db
      .update(schema.cards)
      .set({ reminder: null, startTime: m.setsTime ? DEFAULT_AVISO_TIME : before.startTime })
      .where(eq(schema.cards.id, cardId));
    await db.insert(schema.cardReminders).values({ cardId, leadMinutes: 0, createdAt: t, updatedAt: t }).onConflictDoNothing();
    const r = await syncAviso(cardId);
    if (!r.ok) {
      await db.delete(schema.cardReminders).where(eq(schema.cardReminders.cardId, cardId));
      await db.update(schema.cards).set({ reminder: before.reminder, startTime: before.startTime }).where(eq(schema.cards.id, cardId));
      out.errors.push(`«${m.title}»: ${r.error} No se cambió nada.`);
      continue;
    }
    if (m.oldEvent && i.maferId) {
      try {
        await port.remove(i.maferId, m.oldEvent.id);
      } catch (e) {
        out.errors.push(`«${m.title}»: el aviso nuevo quedó, pero no se pudo borrar el anterior (${googleErrorMessage(e)}). Aparecerá como fantasma.`);
        out.moved++;
        continue;
      }
    }
    await db.update(schema.cards).set({ gcalEventId: null }).where(eq(schema.cards.id, cardId));
    out.moved++;
  }

  for (const eventId of input.ghostEventIds) {
    const g = review.ghosts.find((x) => x.event.id === eventId);
    if (!g) {
      out.skipped.push(`Evento ${eventId}: ya no está en la lista de fantasmas.`);
      continue;
    }
    const calId = g.calendar === "mafer-os" ? i.maferId : i.avisosId;
    if (!calId) continue;
    try {
      // comprobación final contra Google: mismo evento y misma marca de tarea
      const fresh = await port.get(calId, eventId);
      if (!fresh) {
        out.skipped.push(`«${g.event.summary}»: ya no existía en Google.`);
      } else if (fresh.ref !== g.event.ref) {
        out.skipped.push(`«${g.event.summary}»: su marca cambió; no se tocó.`);
        continue;
      } else {
        await port.remove(calId, eventId);
        out.deleted++;
      }
      if (g.calendar === "mafer-os") {
        const [c] = await db.select().from(schema.cards).where(eq(schema.cards.id, g.cardId)).limit(1);
        if (c?.gcalEventId === eventId) await db.update(schema.cards).set({ gcalEventId: null }).where(eq(schema.cards.id, c.id));
      }
    } catch (e) {
      out.errors.push(`«${g.event.summary}»: ${googleErrorMessage(e)}`);
    }
  }
  return out;
}

/* ── Para Ajustes ────────────────────────────────────────────────────────── */

export async function avisosOverview() {
  const port = calendarPort();
  const ready = await avisosTableReady();
  const rows = ready ? await db.select().from(schema.cardReminders) : [];
  const failing = rows.filter((r) => r.lastError);
  const titles = failing.length
    ? await db
        .select({ id: schema.cards.id, title: schema.cards.title })
        .from(schema.cards)
        .where(inArray(schema.cards.id, failing.map((r) => r.cardId)))
    : [];
  const titleOf = new Map(titles.map((t) => [t.id, t.title]));
  let connected = false;
  let avisosCalendar = false;
  try {
    connected = await port.connected();
    avisosCalendar = connected && Boolean(await port.calendarId("avisos"));
  } catch {
    /* sin conexión: se muestra como no conectado */
  }
  return {
    mode: port.mode,
    tableReady: ready,
    active: (await getSetting(ACTIVE_KEY)) === "1",
    connected,
    avisosCalendar,
    total: rows.length,
    synced: rows.filter((r) => r.gcalEventId && !r.lastError).length,
    failing: failing.map((r) => ({ cardId: r.cardId, title: titleOf.get(r.cardId) ?? "(tarea eliminada)", error: r.lastError! })),
    test: await getTestAviso(),
    simulatedFailure: port.mode === "simulado" && (await getSetting("sim_gcal_falla")) === "1",
  };
}

export type AvisosOverview = Awaited<ReturnType<typeof avisosOverview>>;

/** Se usa en la vista de la tarea. */
export async function avisoStateFor(cardId: string) {
  const row = await getAvisoRow(cardId);
  if (!row) return null;
  return {
    leadMinutes: row.leadMinutes,
    synced: Boolean(row.gcalEventId) && !row.lastError,
    error: row.lastError,
    lastSyncedAt: row.lastSyncedAt,
  };
}

export type AvisoState = Awaited<ReturnType<typeof avisoStateFor>>;

/** Para el simulador: qué calendario es cuál, al listar sus eventos. */
export async function calendarIds(): Promise<Record<CalendarKind, string | null>> {
  return {
    "mafer-os": (await getSetting("google_calendar_id")) || null,
    avisos: (await getSetting("google_avisos_calendar_id")) || null,
  };
}

