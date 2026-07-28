// Guardia de aislamiento de datos: ningún seed, reset, cleanup, fixture o
// suite E2E puede correr sin una TEST_DATABASE_URL explícita y distinta de
// producción. Si falta, o si coincide con DATABASE_URL/MIGRATE_DATABASE_URL,
// se detiene con un error claro ANTES de tocar cualquier base de datos.
import { readFileSync, existsSync } from "node:fs";

function loadEnvLocalIfNeeded() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

function assertNotSameAsProduction(label, url) {
  for (const prodVar of ["DATABASE_URL", "MIGRATE_DATABASE_URL"]) {
    if (process.env[prodVar] && url === process.env[prodVar]) {
      throw new Error(
        `${label} es idéntica a ${prodVar} — eso conectaría pruebas/seeds/fixtures a producción. ` +
          `Corrige el valor antes de continuar.`
      );
    }
  }
}

/** Conexión Postgres (pooler, modo transacción) exclusiva para E2E, seeds,
 *  resets, cleanup y fixtures. Nunca usar DATABASE_URL para esto.
 *  @returns {string} */
export function requireTestDatabaseUrl() {
  loadEnvLocalIfNeeded();
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      "Falta TEST_DATABASE_URL. Debe apuntar al proyecto Supabase de pruebas (mafer-os-testing), nunca a " +
        "producción. Ponla en .env.local — ver docs/arquitectura.md."
    );
  }
  assertNotSameAsProduction("TEST_DATABASE_URL", url);
  return url;
}

/** Conexión de sesión (DDL, modo transacción NO sirve aquí) exclusiva para
 *  migrar el esquema de la base de pruebas.
 *  @returns {string} */
export function requireTestMigrateDatabaseUrl() {
  loadEnvLocalIfNeeded();
  const url = process.env.TEST_MIGRATE_DATABASE_URL ?? process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      "Falta TEST_MIGRATE_DATABASE_URL (o TEST_DATABASE_URL como respaldo). Debe apuntar al proyecto Supabase " +
        "de pruebas (mafer-os-testing), nunca a producción. Ponla en .env.local — ver docs/arquitectura.md."
    );
  }
  assertNotSameAsProduction("TEST_MIGRATE_DATABASE_URL", url);
  return url;
}
