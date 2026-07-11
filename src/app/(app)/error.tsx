"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw, Home } from "lucide-react";

/** Error boundary de la app: nunca dejar una página muerta. */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[mafer-os] error de página:", error);
  }, [error]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center p-6">
      <div className="card p-8 max-w-md text-center flex flex-col items-center gap-3">
        <span className="text-3xl" aria-hidden>🌿</span>
        <h1 className="text-xl text-forest-deep">Algo se atoró, pero tus datos están a salvo</h1>
        <p className="text-sm text-stone">
          Ocurrió un error en esta pantalla. Puedes reintentarlo o volver a Hoy; nada de lo
          que guardaste se pierde.
        </p>
        <div className="flex gap-2 mt-2">
          <button type="button" className="btn btn-primary" onClick={reset}>
            <RotateCcw size={15} aria-hidden /> Reintentar
          </button>
          <Link href="/" className="btn btn-secondary">
            <Home size={15} aria-hidden /> Ir a Hoy
          </Link>
        </div>
        {error.digest && <p className="text-xs text-stone-soft mt-1">Código: {error.digest}</p>}
      </div>
    </div>
  );
}
