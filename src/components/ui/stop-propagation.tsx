"use client";

/** Envuelve un elemento interactivo (botón, checklist, menú) que vive dentro de
 *  una tarjeta clickeable más grande, para que su clic/teclado no también
 *  dispare el onClick de la tarjeta contenedora. Debe ser un Client Component
 *  — un Server Component no puede pasar manejadores de evento como props a
 *  elementos de DOM (ver board.tsx para el mismo patrón ya en un archivo
 *  "use client"). */
export function StopPropagation({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={className}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}
