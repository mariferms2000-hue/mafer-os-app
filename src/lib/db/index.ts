import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("Falta DATABASE_URL en .env.local — copia el connection string de Supabase (Project Settings > Database).");
}

declare global {
  var __maferDb: ReturnType<typeof createDb> | undefined;
}

function createDb() {
  // DATABASE_URL apunta al pooler de Supabase en modo transacción (puerto 6543):
  // - prepare: false es obligatorio ahí (Supavisor no soporta prepared statements).
  // - max: 1 — una conexión por instancia serverless para no agotar el pool.
  // - Timeouts acotados: sin ellos una conexión colgada retiene la única conexión
  //   y la función entera espera hasta el límite de 300s de Vercel (504).
  // Las migraciones NO corren aquí: DDL sobre el pooler de transacción se bloquea
  // y encolaba todas las queries detrás. Corre `npm run db:migrate` (usa la
  // conexión de sesión) cuando haya una migración nueva.
  const sql = postgres(DATABASE_URL!, {
    max: 1,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 20,
    max_lifetime: 60 * 5,
  });
  return drizzle(sql, { schema });
}

// Reutiliza la conexión entre recargas de Next.js en desarrollo.
export const db = globalThis.__maferDb ?? (globalThis.__maferDb = createDb());
export { schema };

export const now = () => new Date().toISOString();
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const uid = () => crypto.randomUUID();
