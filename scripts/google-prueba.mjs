// Prueba local de los avisos con la cuenta REAL de Google de Mafer (autorizada
// para el Bloque 3), siempre sobre la base de pruebas mafer_e2e.
//
//   node scripts/google-prueba.mjs verificar   → muestra los avisos de los
//        calendarios de PRUEBA con su alerta (sin datos sensibles)
//   node scripts/google-prueba.mjs limpiar     → borra los calendarios de
//        PRUEBA que creó la app y olvida los tokens de la base de pruebas
//
// Candados: usa solo TEST_DATABASE_URL (misma guardia que E2E) y únicamente
// toca calendarios cuyo id está guardado en esa base Y cuyo nombre termina en
// « (PRUEBA)». Nunca lista ni modifica otros calendarios. Nunca revoca el
// permiso de Google (eso desconectaría también producción).
import postgres from "postgres";
import { google } from "googleapis";
import { requireTestDatabaseUrl } from "./lib/require-test-db.mjs";

const cmd = process.argv[2];
if (!["verificar", "limpiar"].includes(cmd)) {
  console.error("Uso: node scripts/google-prueba.mjs verificar|limpiar");
  process.exit(1);
}

const sql = postgres(requireTestDatabaseUrl(), { max: 1, prepare: false, connect_timeout: 15 });
const setting = async (k) => (await sql`select value from settings where key = ${k}`)[0]?.value || null;

try {
  const raw = await setting("google_tokens");
  if (!raw) throw new Error("La base de pruebas no tiene Google conectado.");
  const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
  auth.setCredentials(JSON.parse(raw));
  const cal = google.calendar({ version: "v3", auth });

  const ids = [await setting("google_calendar_id"), await setting("google_avisos_calendar_id")].filter(Boolean);
  const prueba = [];
  for (const id of ids) {
    const c = await cal.calendars.get({ calendarId: id }).catch(() => null);
    if (c?.data.summary?.endsWith(" (PRUEBA)")) prueba.push({ id, summary: c.data.summary });
    else if (c) console.log(`Se ignora un calendario que no es de PRUEBA («${c.data.summary}»).`);
  }

  if (cmd === "verificar") {
    for (const c of prueba) {
      const r = await cal.events.list({ calendarId: c.id, maxResults: 250 });
      console.log(`\n${c.summary}: ${r.data.items?.length ?? 0} eventos`);
      for (const e of r.data.items ?? []) {
        const p = e.extendedProperties?.private ?? {};
        const alerta = e.reminders?.useDefault ? "predeterminada" : JSON.stringify(e.reminders?.overrides ?? []);
        console.log(`  · ${e.summary} | ${e.start?.dateTime ?? e.start?.date} → ${e.end?.dateTime ?? e.end?.date} | alerta ${alerta} | ${p.maferOsRef ?? "sin marca"}${p.maferOsAviso ? " (aviso)" : ""}`);
      }
    }
  } else {
    for (const c of prueba) {
      await cal.calendars.delete({ calendarId: c.id });
      console.log(`Borrado: ${c.summary}`);
    }
    await sql`delete from settings where key in ('google_tokens', 'google_calendar_id', 'google_avisos_calendar_id')`;
    console.log("Tokens de la base de pruebas olvidados ✓");
  }
} catch (e) {
  console.error("Error:", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
