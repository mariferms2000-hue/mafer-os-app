/** Etiqueta fija que solo aparece en las previews de Vercel: deja claro, en
 *  todas las pantallas, que lo que se ve son datos ficticios y no la app real.
 *  Color propio (ámbar) a propósito: no debe confundirse con la paleta de la app
 *  y se lee igual en claro y oscuro. No intercepta toques. */
export function PreviewBanner() {
  return (
    <div
      role="status"
      data-testid="preview-banner"
      className="pointer-events-none fixed left-1/2 -translate-x-1/2 z-[80] top-[calc(env(safe-area-inset-top)+0.25rem)] rounded-full bg-[#9a3412] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white shadow-lift"
    >
      Preview<span className="hidden sm:inline normal-case font-medium"> · datos ficticios</span>
    </div>
  );
}

/** Lo que muestra una preview conectada a una base que no es la de pruebas. */
export function PreviewBlocked() {
  return (
    <main className="min-h-dvh flex items-center justify-center p-6">
      <div className="card max-w-md p-6 text-center" data-testid="preview-blocked">
        <h1 className="text-2xl text-forest-deep mb-2">Preview bloqueada</h1>
        <p className="text-sm text-stone">
          Esta preview no está conectada a la base de pruebas (<code>mafer_preview</code>), así que no se permite
          entrar. Ningún dato se ha leído ni modificado. Revisa la variable <code>DATABASE_URL</code> del entorno
          Preview en Vercel (ver <code>docs/previews.md</code>).
        </p>
      </div>
    </main>
  );
}
