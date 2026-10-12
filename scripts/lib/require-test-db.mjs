// Guardia de aislamiento de datos: ningún seed, reset, cleanup, fixture o
// suite E2E puede correr sin una TEST_DATABASE_URL explícita y distinta de
// producción. Si falta, o si coincide con DATABASE_URL/MIGRATE_DATABASE_URL,
// se detiene con un error claro ANTES de tocar cualquier base de datos.
//
// Desde la consolidación (oct 2026) hay tres bases en el proyecto Supabase de
// producción, cada una con su usuario:
// - «postgres» (usuario postgres): tus datos reales. Nada de aquí la toca.
// - «mafer_e2e» (usuario mafer_e2e_app): solo E2E. Se vacía antes de cada corrida.
// - «mafer_preview» (usuario mafer_preview_app): solo Vercel Preview, datos ficticios.
// Los usuarios de pruebas no tienen permisos sobre los datos reales; además,
// estas guardias se niegan a apuntar las E2E o las previews a la base real o con
// el usuario administrador. (Las reglas aceptan también el antiguo proyecto
// mafer-os-testing, que queda como reversión.) Ver docs/previews.md.
import { readFileSync, existsSync } from "node:fs";

export const PREVIEW_DB_NAME = "mafer_preview";
export const E2E_DB_NAME = "mafer_e2e";

function loadEnvLocalIfNeeded() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

/** Nombre de la base en una URL de Postgres («postgres», «mafer_preview»…). */
export function databaseNameOf(url) {
  try {
    return decodeURIComponent(new URL(url).pathname.replace(/^\//, "")) || "postgres";
  } catch {
    return null;
  }
}

/** Proyecto Supabase de una URL del pooler: el usuario es «<rol>.<ref>». */
export function supabaseProjectOf(url) {
  try {
    return decodeURIComponent(new URL(url).username).split(".")[1] ?? null;
  } catch {
    return null;
  }
}

/** Rol de Postgres de una URL del pooler («postgres», «mafer_e2e_app»…). */
export function databaseRoleOf(url) {
  try {
    return decodeURIComponent(new URL(url).username).split(".")[0] || null;
  } catch {
    return null;
  }
}

/** Dentro del proyecto de producción, una URL de pruebas solo vale para SU base
 *  y nunca con el administrador. Fuera de él (mafer-os-testing) no aplica. */
function assertSafeInsideProductionProject(label, url, expectedDb) {
  const prodProject = supabaseProjectOf(process.env.DATABASE_URL ?? "");
  if (!prodProject || supabaseProjectOf(url) !== prodProject) return;
  if (databaseNameOf(url) !== expectedDb) {
    throw new Error(`${label} apunta a la base «${databaseNameOf(url)}» del proyecto de producción. Solo puede usar «${expectedDb}».`);
  }
  if (databaseRoleOf(url) === "postgres") {
    throw new Error(`${label} usa el usuario administrador «postgres» en el proyecto de producción. Debe usar su usuario propio.`);
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

function assertNotPreviewDatabase(label, url) {
  const samePreviewUrl = ["PREVIEW_DATABASE_URL", "PREVIEW_MIGRATE_DATABASE_URL"].some(
    (v) => process.env[v] && process.env[v] === url
  );
  if (samePreviewUrl || databaseNameOf(url) === PREVIEW_DB_NAME) {
    throw new Error(
      `${label} apunta a la base de previews (${PREVIEW_DB_NAME}). Las E2E vacían su base entera: ` +
        `deben usar la base «postgres» de mafer-os-testing, nunca la de previews.`
    );
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
  assertNotPreviewDatabase("TEST_DATABASE_URL", url);
  assertSafeInsideProductionProject("TEST_DATABASE_URL", url, E2E_DB_NAME);
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
  assertNotPreviewDatabase("TEST_MIGRATE_DATABASE_URL", url);
  assertSafeInsideProductionProject("TEST_MIGRATE_DATABASE_URL", url, E2E_DB_NAME);
  return url;
}

/** Base de las previews (mafer_preview). `migrate: true` devuelve la conexión
 *  de sesión para DDL. Exige: el nombre exacto de la base, que no sea la URL de
 *  producción ni la de E2E y, dentro del proyecto de producción, un usuario que
 *  no sea el administrador.
 *  @param {{ migrate?: boolean }} [opts]
 *  @returns {string} */
export function requirePreviewDatabaseUrl({ migrate = false } = {}) {
  loadEnvLocalIfNeeded();
  const name = migrate ? "PREVIEW_MIGRATE_DATABASE_URL" : "PREVIEW_DATABASE_URL";
  const url = process.env[name];
  if (!url) {
    throw new Error(`Falta ${name} en .env.local — ver docs/previews.md.`);
  }
  assertNotSameAsProduction(name, url);
  for (const testVar of ["TEST_DATABASE_URL", "TEST_MIGRATE_DATABASE_URL"]) {
    if (process.env[testVar] && process.env[testVar] === url) {
      throw new Error(`${name} es idéntica a ${testVar}: la base de E2E se vacía en cada corrida.`);
    }
  }
  if (databaseNameOf(url) !== PREVIEW_DB_NAME) {
    throw new Error(`${name} debe apuntar a la base «${PREVIEW_DB_NAME}», no a «${databaseNameOf(url)}».`);
  }
  assertSafeInsideProductionProject(name, url, PREVIEW_DB_NAME);
  return url;
}
