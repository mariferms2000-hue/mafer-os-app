"use client";

import { Play } from "lucide-react";
import { openFocusUrl } from "@/components/focus/focus-overlay";

/** «Enfocarme» desde Mi jardín: abre el overlay existente por URL (?focus=1,
 *  pushState — sin recargar la app). Si hay una sesión activa, el overlay la
 *  muestra tal cual: nada se interrumpe ni se sustituye. */
export function GardenFocusButton({
  variant = "primary",
  testid = "garden-focus",
}: {
  variant?: "primary" | "secondary";
  testid?: string;
}) {
  return (
    <button
      type="button"
      className={`btn ${variant === "primary" ? "btn-primary" : "btn-secondary"}`}
      onClick={() => openFocusUrl()}
      data-testid={testid}
    >
      <Play size={15} aria-hidden /> Enfocarme
    </button>
  );
}
