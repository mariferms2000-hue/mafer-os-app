// Crea (si falta) la base «mafer_preview» dentro del proyecto Supabase de
// pruebas y le aplica las migraciones de drizzle/. Es la base de Vercel Preview.
// Nunca toca producción ni la base de E2E: usa exclusivamente
// PREVIEW_MIGRATE_DATABASE_URL, validada por scripts/lib/require-test-db.mjs.
//
//   npm run db:migrate:preview
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { PREVIEW_DB_NAME, requirePreviewDatabaseUrl } from "./lib/require-test-db.mjs";

const url = requirePreviewDatabaseUrl({ migrate: true });

// CREATE DATABASE no puede correr dentro de la propia base: se hace desde la
// base «postgres» del MISMO proyecto de pruebas (mismo usuario, otra ruta).
const admin = new URL(url);
admin.pathname = "/postgres";
const adminSql = postgres(admin.toString(), { max: 1, prepare: false, connect_timeout: 15 });
try {
  const [exists] = await adminSql`select 1 from pg_database where datname = ${PREVIEW_DB_NAME}`;
  if (exists) {
    console.log(`La base ${PREVIEW_DB_NAME} ya existe ✓`);
  } else {
    await adminSql.unsafe(`CREATE DATABASE "${PREVIEW_DB_NAME}"`);
    console.log(`Base ${PREVIEW_DB_NAME} creada ✓`);
  }
} finally {
  await adminSql.end();
}

const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 15 });
try {
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  console.log(`Migraciones aplicadas a ${PREVIEW_DB_NAME} ✓`);
} finally {
  await sql.end();
}
