// Crea (si falta) la base «mafer_preview» y le aplica las migraciones de
// drizzle/. Es la base de Vercel Preview. Desde la consolidación vive en el
// proyecto de producción, con su propio usuario (mafer_preview_app).
// Nunca toca producción ni la base de E2E: usa exclusivamente
// PREVIEW_MIGRATE_DATABASE_URL, validada por scripts/lib/require-test-db.mjs.
//
//   npm run db:migrate:preview
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { PREVIEW_DB_NAME, requirePreviewDatabaseUrl } from "./lib/require-test-db.mjs";
import { ensureDatabase } from "./lib/ensure-database.mjs";

const url = requirePreviewDatabaseUrl({ migrate: true });

await ensureDatabase(url);

const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 15 });
try {
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  console.log(`Migraciones aplicadas a ${PREVIEW_DB_NAME} ✓`);
} finally {
  await sql.end();
}
