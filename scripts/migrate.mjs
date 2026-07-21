// Aplica las migraciones de drizzle/ contra la base de Supabase.
// Correr manualmente tras crear una migración nueva: npm run db:migrate
//
// Usa MIGRATE_DATABASE_URL si existe (conexión de sesión, puerto 5432 del pooler
// de Supabase — recomendada para DDL); si no, cae a DATABASE_URL.
// Nunca corre en producción/cold start: el pooler en modo transacción se bloquea
// con DDL y eso tumbaba la app entera (timeouts de 300s en Vercel).
import { readFileSync, existsSync } from "node:fs";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

// Carga .env.local si las variables no vienen del entorno (node no lo lee solo).
if (!process.env.DATABASE_URL && existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const url = process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL (o MIGRATE_DATABASE_URL) — ponla en .env.local o pásala inline.");
  process.exit(1);
}

const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 15 });
try {
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  console.log("Migraciones aplicadas ✓");
} finally {
  await sql.end();
}
