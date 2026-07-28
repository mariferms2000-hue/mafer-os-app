// Acceso Postgres para fixtures/aserciones de E2E — exclusivo de la base de
// pruebas (TEST_DATABASE_URL), nunca de producción. Reemplaza el mecanismo
// antiguo de SQLite (DB_PATH/TEST_DB + better-sqlite3 en subprocesos), que ya
// no reflejaba ninguna base real desde que la app migró a Supabase/Postgres.
import postgres from "postgres";
import { requireTestDatabaseUrl } from "../../scripts/lib/require-test-db.mjs";

let client: ReturnType<typeof postgres> | null = null;

function db() {
  if (!client) {
    client = postgres(requireTestDatabaseUrl(), { max: 1, prepare: false, idle_timeout: 20 });
  }
  return client;
}

/** Ejecuta una o más sentencias SQL (separadas por ';') contra la base de pruebas. */
export async function run(statement: string): Promise<void> {
  const sql = db();
  const statements = statement
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const stmt of statements) {
    await sql.unsafe(stmt);
  }
}

/** Ejecuta una consulta de lectura contra la base de pruebas y devuelve las filas. */
export async function q<T = Record<string, unknown>>(query: string): Promise<T[]> {
  const rows = await db().unsafe(query);
  return rows as unknown as T[];
}
