// Aplica las migraciones de drizzle/ contra la base de Supabase DE PRUEBAS
// (mafer-os-testing). Nunca toca producción: usa exclusivamente
// TEST_MIGRATE_DATABASE_URL (o TEST_DATABASE_URL como respaldo), validada por
// la misma guardia que usan E2E/seeds (scripts/lib/require-test-db.mjs).
// Correr manualmente cuando haya una migración nueva: npm run db:migrate:test
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { requireTestMigrateDatabaseUrl } from "./lib/require-test-db.mjs";

const url = requireTestMigrateDatabaseUrl();
const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 15 });
try {
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  console.log("Migraciones aplicadas a la base de pruebas ✓");
} finally {
  await sql.end();
}
