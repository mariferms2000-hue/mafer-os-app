// Crea (si falta) la base de E2E y le aplica las migraciones de drizzle/.
// Desde la consolidación vive en el proyecto de producción como «mafer_e2e»,
// con su propio usuario (mafer_e2e_app). Nunca toca tus datos: usa exclusivamente
// TEST_MIGRATE_DATABASE_URL (o TEST_DATABASE_URL como respaldo), validada por
// la misma guardia que usan E2E/seeds (scripts/lib/require-test-db.mjs).
// Correr manualmente cuando haya una migración nueva: npm run db:migrate:test
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { requireTestMigrateDatabaseUrl } from "./lib/require-test-db.mjs";
import { ensureDatabase } from "./lib/ensure-database.mjs";

const url = requireTestMigrateDatabaseUrl();
await ensureDatabase(url);
const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 15 });
try {
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  console.log("Migraciones aplicadas a la base de pruebas ✓");
} finally {
  await sql.end();
}
