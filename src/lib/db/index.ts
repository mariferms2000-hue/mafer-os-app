import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import path from "path";
import * as schema from "./schema";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("Falta DATABASE_URL en .env.local — copia el connection string de Supabase (Project Settings > Database).");
}

declare global {
  var __maferDb: ReturnType<typeof createDb> | undefined;
}

function createDb() {
  // max: 1 — cada instancia serverless mantiene una sola conexión, para no agotar
  // el límite si Vercel escala a varias instancias concurrentes.
  // prepare: false — DATABASE_URL apunta al Transaction pooler de Supabase
  // (puerto 6543, aws-0-us-east-1.pooler.supabase.com), que rota la conexión
  // física entre transacciones y no soporta prepared statements (default de
  // postgres.js) — sin esto, las queries se cuelgan bajo uso real aunque una
  // consulta suelta de prueba funcione (se cierra antes de que el pool rote).
  const sql = postgres(DATABASE_URL!, { max: 1, prepare: false });
  const db = drizzle(sql, { schema });
  // Fire-and-forget: la tabla de tracking de Drizzle hace que correr esto en cada
  // cold start sea idempotente (no-op tras la primera vez). No se bloquea el
  // arranque en ello — para una app de un solo usuario, el riesgo de que la
  // primera petición justo después de un deploy nuevo choque con una migración
  // en curso es aceptable.
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") }).catch((e) => {
    console.error("[db] migración falló", e);
  });
  return db;
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
