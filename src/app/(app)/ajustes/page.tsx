import fs from "node:fs";
import path from "node:path";
import {
  Settings,
  CalendarDays,
  Smartphone,
  HardDriveDownload,
  Palette,
  FlaskConical,
} from "lucide-react";
import { getUserName, getSetting } from "@/lib/auth";
import { googleStatus } from "@/lib/google/calendar";
import { PageHeader } from "@/components/ui/page-header";
import { updateNameAction } from "@/lib/actions/settings";
import { PasswordForm } from "@/components/settings/password-form";
import { disconnectGoogleAction } from "@/lib/actions/google";
import { ThemeSelector } from "@/components/shell/theme";
import { BackupButtons, DemoDataControls } from "@/components/settings/maintenance";
import { WeeklyReviewDay } from "@/components/settings/weekly-review-day";
import { AlertQaPanel } from "@/components/settings/alert-qa";
import { getDemoCounts, qaToolsEnabled, alertQaCount } from "@/lib/actions/maintenance";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ajustes" };

/** Info generada al compilar (scripts/build-info.mjs) para saber qué versión corre. */
function buildInfo(): { commit: string; dirty?: boolean; builtAt: string } | null {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), "src", "generated", "build-info.json"), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default async function AjustesPage() {
  const name = await getUserName();
  const g = await googleStatus();
  const build = buildInfo();
  const entorno = process.env.NODE_ENV === "production" ? "producción" : "desarrollo";
  const demoCounts = await getDemoCounts();
  const qaTools = await qaToolsEnabled();
  const qaCount = qaTools ? await alertQaCount() : 0;
  const weeklyDay = (await getSetting("review:weekly-day")) || "";
  const lastBackup = (await getSetting("last_backup_at")) || null;
  const lastSync = (await getSetting("last_obsidian_sync_at")) || null;

  return (
    <div className="max-w-2xl">
      <PageHeader icon={Settings} title="Ajustes" intro="Tu perfil, apariencia, conexiones, respaldos y datos de ejemplo." />

      {/* Perfil */}
      <section className="card p-5 mb-5">
        <h2 className="text-lg text-forest-deep mb-3">Perfil</h2>
        <form action={updateNameAction} className="flex gap-2 items-end mb-5">
          <div className="flex-1">
            <label className="label" htmlFor="set-name">Tu nombre (para el saludo)</label>
            <input id="set-name" name="name" className="input" defaultValue={name} />
          </div>
          <button type="submit" className="btn btn-secondary">Guardar</button>
        </form>
        <h3 className="text-sm font-semibold text-ink-green mb-2">Cambiar contraseña</h3>
        <PasswordForm />
      </section>

      {/* Revisiones */}
      <section className="card p-5 mb-5">
        <h2 className="text-lg text-forest-deep mb-2">Revisiones</h2>
        <WeeklyReviewDay current={weeklyDay} />
      </section>

      {/* Apariencia */}
      <section className="card p-5 mb-5">
        <h2 className="text-lg text-forest-deep mb-1 flex items-center gap-2">
          <Palette size={18} className="text-olive" aria-hidden /> Apariencia
        </h2>
        <p className="text-sm text-stone mb-3">
          «Automático» sigue la preferencia de tu Mac o iPhone: claro de día, oscuro de noche.
        </p>
        <ThemeSelector />
      </section>

      {/* Google Calendar */}
      <section className="card p-5 mb-5">
        <h2 className="text-lg text-forest-deep mb-2 flex items-center gap-2">
          <CalendarDays size={18} className="text-olive" aria-hidden /> Google Calendar
        </h2>
        {!g.configured ? (
          <div className="text-sm text-stone flex flex-col gap-2">
            <p>
              Estado: <span className="chip chip-waiting">Falta configuración única</span>
            </p>
            <p>Para activar recordatorios en tu teléfono se necesita, una sola vez:</p>
            <ol className="list-decimal ml-5 flex flex-col gap-1">
              <li>Crear credenciales gratuitas en Google Cloud (guía paso a paso en el manual <strong>«Calendario y recordatorios»</strong> del vault).</li>
              <li>Pegar las dos claves en el archivo <code className="bg-beige px-1 rounded">.env.local</code> de la app.</li>
              <li>Volver aquí y presionar «Conectar».</li>
            </ol>
            <p className="text-xs text-stone-soft">
              La integración ya está construida y probada con simulaciones; solo faltan tus llaves personales de Google.
            </p>
          </div>
        ) : !g.connected ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-stone">Credenciales listas. Conecta tu cuenta:</p>
            <a href="/api/google/connect" className="btn btn-primary">Conectar Google Calendar</a>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-done">Conectado ✓ — calendario dedicado «Mafer OS» activo.</p>
            <form action={disconnectGoogleAction}>
              <button type="submit" className="btn btn-ghost text-xs">Desconectar</button>
            </form>
          </div>
        )}
      </section>

      {/* Respaldos y exportación */}
      <section className="card p-5 mb-5">
        <h2 className="text-lg text-forest-deep mb-2 flex items-center gap-2">
          <HardDriveDownload size={18} className="text-olive" aria-hidden /> Respaldos y exportación
        </h2>
        <ul className="text-sm text-stone mb-4 flex flex-col gap-1">
          <li><strong className="text-charcoal">Descargar JSON:</strong> copia completa para restauración técnica.</li>
          <li><strong className="text-charcoal">Descargar Markdown:</strong> copia legible de todo tu sistema.</li>
          <li><strong className="text-charcoal">Crear respaldo completo:</strong> guarda una carpeta con fecha en <code className="bg-beige px-1 rounded">backups-and-exports</code> (JSON + Markdown + base de datos).</li>
          <li><strong className="text-charcoal">Actualizar Obsidian:</strong> lleva la información actual a tu vault local.</li>
        </ul>
        <BackupButtons lastBackup={lastBackup} lastSync={lastSync} />
        <details className="mt-4">
          <summary className="text-sm text-forest cursor-pointer underline underline-offset-4">¿Cómo restaurar un respaldo?</summary>
          <ol className="list-decimal ml-5 text-sm text-stone mt-2 flex flex-col gap-1">
            <li>Cierra la app (la ventanita negra).</li>
            <li>Abre <code className="bg-beige px-1 rounded">backups-and-exports</code> → la carpeta con la fecha que quieras.</li>
            <li>Copia <code className="bg-beige px-1 rounded">mafer-os.db</code> a <code className="bg-beige px-1 rounded">mafer-os-app/data/</code>, reemplazando.</li>
            <li>Vuelve a abrir la app. Guía completa: manual «Recuperación» del vault.</li>
          </ol>
        </details>
        <p className="text-xs text-stone-soft mt-3">
          Vault: <code className="bg-beige px-1 rounded">Escritorio → Mafer OS → mafer-os-vault</code> · Respaldos:{" "}
          <code className="bg-beige px-1 rounded">Escritorio → Mafer OS → backups-and-exports</code>
        </p>
      </section>

      {/* Datos de demostración */}
      <section className="card p-5 mb-5">
        <h2 className="text-lg text-forest-deep mb-2 flex items-center gap-2">
          <FlaskConical size={18} className="text-olive" aria-hidden /> Datos de demostración
        </h2>
        <DemoDataControls counts={demoCounts} />
      </section>

      {/* Instalación */}
      <section className="card p-5">
        <h2 className="text-lg text-forest-deep mb-2 flex items-center gap-2">
          <Smartphone size={18} className="text-olive" aria-hidden /> Instalación en dispositivos
        </h2>
        <ol className="list-decimal ml-5 text-sm text-stone flex flex-col gap-1">
          <li>Abre Mafer OS en <strong>Safari</strong> en tu iPhone (misma red Wi-Fi que tu Mac).</li>
          <li>Toca el botón de <strong>Compartir</strong> (el cuadrito con flecha).</li>
          <li>Elige <strong>«Agregar a inicio»</strong>.</li>
        </ol>
        <p className="text-xs text-stone-soft mt-2">
          iPad: mismos pasos. Mac: Safari → Archivo → Agregar a Dock. Guía completa: manual «Instalar en iPhone».
        </p>
      </section>

      {/* Herramientas QA — solo existen fuera de producción */}
      {qaTools && <div className="mt-5"><AlertQaPanel initialCount={qaCount} /></div>}

      {/* Versión en ejecución — para comprobar de un vistazo que ves lo más reciente */}
      <p className="text-xs text-stone-soft mt-6 text-center" data-testid="version-info">
        {build ? (
          <>
            Versión <code className="bg-beige px-1 rounded">{build.commit}</code>
            {build.dirty && " (con cambios sin commit)"} · compilada el{" "}
            {new Date(build.builtAt).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })} ·{" "}
            entorno: {entorno}
          </>
        ) : (
          <>Versión desconocida (falta build-info) · entorno: {entorno}</>
        )}
      </p>
    </div>
  );
}
