// Crea (si falta) la base de una URL de pruebas/previews y la cierra a los demás
// usuarios. Desde la consolidación (oct 2026) estas bases viven DENTRO del
// proyecto Supabase de producción, cada una con su propio usuario sin permisos
// sobre los datos reales (mafer_preview_app, mafer_e2e_app). Nunca toca la base
// «postgres» salvo para leer pg_database y ejecutar CREATE DATABASE.
import postgres from "postgres";

/** @param {string} url conexión de SESIÓN (puerto 5432) a la base deseada. */
export async function ensureDatabase(url) {
  const target = new URL(url);
  const name = decodeURIComponent(target.pathname.replace(/^\//, ""));
  if (!name || name === "postgres") throw new Error("ensureDatabase: se esperaba una base propia, no «postgres».");

  // CREATE DATABASE no puede correr dentro de la propia base: se hace desde
  // «postgres» con el MISMO usuario (que tiene CREATEDB y queda como dueño).
  const admin = new URL(url);
  admin.pathname = "/postgres";
  const a = postgres(admin.toString(), { max: 1, prepare: false, connect_timeout: 15 });
  try {
    const [exists] = await a`select 1 from pg_database where datname = ${name}`;
    if (exists) console.log(`La base ${name} ya existe ✓`);
    else {
      await a.unsafe(`CREATE DATABASE "${name}"`);
      console.log(`Base ${name} creada ✓`);
    }
  } finally {
    await a.end();
  }

  // Solo su dueño (y los administradores de Supabase) pueden conectarse a ella.
  const t = postgres(url, { max: 1, prepare: false, connect_timeout: 15 });
  try {
    const [o] = await t`select pg_get_userbyid(datdba) = current_user as owner from pg_database where datname = current_database()`;
    if (o?.owner) {
      await t.unsafe(`REVOKE CONNECT ON DATABASE "${name}" FROM PUBLIC`);
      console.log(`${name}: conexión cerrada a otros usuarios ✓`);
    }
  } finally {
    await t.end();
  }
}
