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
  "trips",
  "reviews",
  "focus_sessions",
  "focus_plants",
  "focus_session_plant_allocations",
  "recent_views",
  "card_reminders",
  "progress_credits",
  "garden_rewards",
  "garden_plant_care",
];

const url = requireTestDatabaseUrl();
const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 10 });
try {
  await sql.unsafe(`TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE;`);
  console.log("Base de pruebas (E2E) vaciada ✓");
} finally {
  await sql.end();
}
