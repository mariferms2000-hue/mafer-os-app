"use client";

/** Último recurso: error en el layout raíz. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body style={{ fontFamily: "system-ui", background: "#f7f4ee", color: "#2e2b25", display: "grid", placeItems: "center", minHeight: "100dvh", margin: 0, textAlign: "center", padding: 24 }}>
        <div>
          <h1 style={{ color: "#324230" }}>🌿 Algo salió mal</h1>
          <p style={{ color: "#7c766a", maxWidth: "38ch" }}>
            Tus datos están a salvo. Reintenta o recarga la página.
          </p>
          <button
            onClick={reset}
            style={{ background: "#45573f", color: "#faf7f1", border: 0, borderRadius: 12, padding: "10px 18px", fontSize: 15, cursor: "pointer" }}
          >
            Reintentar
          </button>
          {error.digest && <p style={{ color: "#a39d90", fontSize: 12 }}>Código: {error.digest}</p>}
        </div>
      </body>
    </html>
  );
}
