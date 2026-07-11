import { Settings, Download, CalendarDays, Smartphone, HardDriveDownload } from "lucide-react";
import { getUserName } from "@/lib/auth";
import { googleStatus } from "@/lib/google/calendar";
import { PageHeader } from "@/components/ui/page-header";
import { updateNameAction } from "@/lib/actions/settings";
import { PasswordForm } from "@/components/settings/password-form";
import { disconnectGoogleAction } from "@/lib/actions/google";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ajustes" };

export default async function AjustesPage() {
  const name = await getUserName();
  const g = await googleStatus();

  return (
    <div className="max-w-2xl">
      <PageHeader icon={Settings} title="Ajustes" intro="Tu cuenta, tus respaldos y las conexiones externas." />

      <section className="card p-5 mb-5">
        <h2 className="text-lg text-forest-deep mb-3">Tu perfil</h2>
        <form action={updateNameAction} className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="label" htmlFor="set-name">Tu nombre (para el saludo)</label>
            <input id="set-name" name="name" className="input" defaultValue={name} />
          </div>
          <button type="submit" className="btn btn-secondary">Guardar</button>
        </form>
      </section>

      <section className="card p-5 mb-5">
        <h2 className="text-lg text-forest-deep mb-3">Cambiar contraseña</h2>
        <PasswordForm />
      </section>

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

      <section className="card p-5 mb-5">
        <h2 className="text-lg text-forest-deep mb-2 flex items-center gap-2">
          <HardDriveDownload size={18} className="text-olive" aria-hidden /> Tus datos, tuyos
        </h2>
        <p className="text-sm text-stone mb-3">
          Descarga todo tu sistema en formatos abiertos. También puedes correr <code className="bg-beige px-1 rounded">npm run backup</code>{" "}
          para un respaldo completo con carpetas por fecha, o <code className="bg-beige px-1 rounded">npm run sync:obsidian</code> para
          actualizar tu vault de Obsidian.
        </p>
        <div className="flex flex-wrap gap-2">
          <a href="/api/export/json" className="btn btn-secondary" download>
            <Download size={15} aria-hidden /> Exportar JSON
          </a>
          <a href="/api/export/markdown" className="btn btn-secondary" download>
            <Download size={15} aria-hidden /> Exportar Markdown
          </a>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-lg text-forest-deep mb-2 flex items-center gap-2">
          <Smartphone size={18} className="text-olive" aria-hidden /> Instalar en tu iPhone
        </h2>
        <ol className="list-decimal ml-5 text-sm text-stone flex flex-col gap-1">
          <li>Abre Mafer OS en <strong>Safari</strong> en tu iPhone (misma red Wi-Fi que tu Mac).</li>
          <li>Toca el botón de <strong>Compartir</strong> (el cuadrito con flecha).</li>
          <li>Elige <strong>«Agregar a inicio»</strong>.</li>
          <li>Listo: tendrás Mafer OS como app con su propio ícono. 🌿</li>
        </ol>
        <p className="text-xs text-stone-soft mt-2">La guía completa (con la dirección exacta) está en el manual «Instalar en iPhone».</p>
      </section>
    </div>
  );
}
