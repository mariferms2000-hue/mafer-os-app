import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "./db";

/**
 * Candado de las previews de Vercel.
 *
 * Una preview SOLO puede usar la base «mafer_preview» de mafer-os-testing, que
 * lleva la marca `settings.data_environment = preview` (la pone
 * scripts/seed-preview.mjs). Si una preview se despliega apuntando a cualquier
 * otra base —producción incluida, por un error de configuración— no deja
 * iniciar sesión ni crear contraseña, y muestra un aviso en lugar de la app.
 *
 * En producción y en local (VERCEL_ENV distinto de «preview») no hace nada:
 * no consulta la base ni cambia ningún comportamiento.
 */

export function isPreviewDeployment(): boolean {
  return process.env.VERCEL_ENV === "preview";
}

/** Regla pura (se prueba sin base): ¿puede funcionar la app con esta marca? */
export function dataEnvironmentAllowed(isPreview: boolean, marker: string | null): boolean {
  return !isPreview || marker === "preview";
}

// Una vez confirmada, la marca no cambia durante la vida de la instancia.
let confirmed = false;

export async function previewDataReady(): Promise<boolean> {
  if (!isPreviewDeployment() || confirmed) return true;
  try {
    const [row] = await db
      .select({ value: schema.settings.value })
      .from(schema.settings)
      .where(eq(schema.settings.key, "data_environment"))
      .limit(1);
    confirmed = dataEnvironmentAllowed(true, row?.value ?? null);
  } catch {
    confirmed = false; // sin base alcanzable tampoco se deja pasar
  }
  return confirmed;
}

export async function assertDataEnvironment(): Promise<void> {
  if (!(await previewDataReady())) {
    throw new Error("Esta preview no está conectada a la base de pruebas (mafer_preview). No se permite el acceso.");
  }
}
