"use client";

import { useState } from "react";
import { PlantDetailModal, type PlantDetailData } from "./plant-detail-modal";

/** Hace clickeable cualquier tarjeta de planta (la actual o una completada) y
 *  monta el popup de detalle al abrirse. `as` deja renderizar como `li` para
 *  no romper la semántica de lista del grid de completadas. Si la tarjeta
 *  tiene otro elemento interactivo adentro (p. ej. un botón), ese elemento
 *  debe detener la propagación del clic para no abrir el popup por error. */
export function PlantCardTrigger({
  plant,
  label,
  className,
  testid,
  as: As = "div",
  children,
}: {
  plant: PlantDetailData;
  label: string;
  className?: string;
  testid?: string;
  as?: "div" | "li";
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <As
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        aria-label={label}
        className={className}
        data-testid={testid}
      >
        {children}
      </As>
      {open && <PlantDetailModal plant={plant} onClose={() => setOpen(false)} />}
    </>
  );
}
