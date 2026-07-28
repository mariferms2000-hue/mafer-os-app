// Deja la base de pruebas (mafer-os-testing) completamente vacía antes de
// cada corrida de E2E — equivalente al viejo `rm -rf e2e/.test-db` de la era
// SQLite, ahora para Postgres. Nunca toca producción: usa la misma guardia
// que el resto del aislamiento (scripts/lib/require-test-db.mjs).
import postgres from "postgres";
import { requireTestDatabaseUrl } from "./lib/require-test-db.mjs";

const TABLES = [
  "settings",
  "projects",
  "boards",
  "columns",
  "cards",
  "today_priorities",
  "inbox_items",
  "journal_entries",
  "learning_topics",
  "ideas",
  "prompts",
  "ai_tools",
  "agents_skills",
  "decisions",
  "resources",
  "events",
  "reviews",
  "focus_sessions",
  "focus_plants",
  "focus_session_plant_allocations",
  "recent_views",
];

const url = requireTestDatabaseUrl();
const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 10 });
try {
  await sql.unsafe(`TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE;`);
  console.log("Base de pruebas (mafer-os-testing) vaciada ✓");
} finally {
  await sql.end();
}
