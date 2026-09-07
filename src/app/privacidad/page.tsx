/* Aviso de privacidad — página PÚBLICA (ver la lista PUBLIC en src/proxy.ts).
 *
 * Existe porque Google exige una URL de política de privacidad accesible sin
 * iniciar sesión para pasar la app de OAuth a «En producción». Sin ese paso, los
 * tokens de actualización caducan cada 7 días y hay que reconectar Google Calendar
 * cada semana.
 *
 * Debe describir lo que la app REALMENTE hace. Si cambian los permisos que se le
 * piden a Google (ver SCOPE en src/lib/google/calendar.ts), actualiza esta página. */

export const metadata = {
  title: "Aviso de privacidad",
  description: "Cómo trata Mafer OS tu información.",
};

const ACTUALIZADO = "7 de septiembre de 2026";

export default function PrivacidadPage() {
  return (
    <main className="min-h-dvh px-6 py-12">
      <article className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl text-forest-deep">Aviso de privacidad</h1>
          <p className="text-sm text-stone">
            Mafer OS · Última actualización: {ACTUALIZADO}
          </p>
        </header>

        <Seccion titulo="Qué es Mafer OS">
          <p>
            Mafer OS es una herramienta personal de organización, de uso privado. No es un
            producto comercial, no tiene otros usuarios y no se ofrece al público.
          </p>
        </Seccion>

        <Seccion titulo="Qué información se guarda">
          <p>
            Lo que la propia usuaria escribe dentro de la aplicación: tareas, proyectos,
            notas, entradas de diario, eventos y las preferencias de la interfaz. Todo eso
            se guarda en una base de datos privada, protegida con contraseña.
          </p>
          <p>
            No se recopilan datos de navegación, no se usan cookies de publicidad y no hay
            herramientas de seguimiento ni de analítica de terceros.
          </p>
        </Seccion>

        <Seccion titulo="Acceso a Google Calendar">
          <p>
            Conectar Google Calendar es <strong>opcional</strong>. Si se activa, Mafer OS
            pide a Google un permiso deliberadamente restringido:{" "}
            <code className="rounded bg-beige px-1.5 py-0.5 text-[0.85em]">
              calendar.app.created
            </code>
            .
          </p>
          <p>
            Ese permiso solo deja gestionar los calendarios que la propia aplicación crea.
            En la práctica significa que Mafer OS crea un calendario llamado «Mafer OS» y
            únicamente puede escribir ahí.
          </p>
          <p>
            <strong>
              No puede leer, modificar ni borrar los calendarios personales ni sus eventos.
            </strong>{" "}
            No es una promesa de buena voluntad: Google no le concede esa capacidad.
          </p>
          <p>
            Lo único que viaja hacia Google son los eventos que la usuaria decide crear en
            Mafer OS: su título, su fecha, su hora y sus notas.
          </p>
        </Seccion>

        <Seccion titulo="Con quién se comparte">
          <p>
            Con nadie. La información no se vende, no se renta, no se comparte con terceros
            y no se usa para entrenar modelos de inteligencia artificial.
          </p>
          <p>
            Los únicos servicios que intervienen son los que hacen funcionar la aplicación:
            Vercel, que la aloja; Supabase, que guarda la base de datos; y Google, solo si
            se activa la conexión con el calendario.
          </p>
        </Seccion>

        <Seccion titulo="Cómo se revoca el acceso">
          <p>
            Desde Ajustes, dentro de la aplicación, con la opción de desconectar Google
            Calendar. También desde{" "}
            <a
              href="https://myaccount.google.com/permissions"
              className="text-ink-green underline underline-offset-2"
              target="_blank"
              rel="noreferrer"
            >
              la página de permisos de la cuenta de Google
            </a>
            .
          </p>
          <p>
            Al desconectar, Mafer OS deja de tener acceso. El calendario «Mafer OS» y sus
            eventos permanecen en Google hasta que la usuaria decida borrarlos.
          </p>
        </Seccion>

        <Seccion titulo="Contacto">
          <p>
            Esta aplicación la desarrolla y opera una sola persona, para su propio uso. Para
            cualquier duda sobre este aviso, el contacto es la dirección de correo
            registrada como responsable en Google Cloud.
          </p>
        </Seccion>
      </article>
    </main>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl text-forest-deep">{titulo}</h2>
      <div className="flex flex-col gap-3 text-sm leading-relaxed text-stone">{children}</div>
    </section>
  );
}
