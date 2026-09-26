"use client";

import { useEffect } from "react";

/** Publica en <html> el área visible real de la pantalla (visualViewport):
 *  --vv-top y --vv-height. Safari en iPhone no encoge el viewport de layout al
 *  abrir el teclado, así que las hojas `fixed` pegadas abajo quedaban más altas
 *  que el hueco visible; con estas variables .overlay-screen ocupa solo lo que
 *  se ve (ver globals.css) y el campo enfocado se acomoda dentro de la hoja. */
export function KeyboardInset() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;

    const campoEnHoja = () => {
      const el = document.activeElement as HTMLElement | null;
      return el?.matches("input, textarea, select, [contenteditable='true']") && el.closest('[role="dialog"]')
        ? el
        : null;
    };

    const update = () => {
      root.style.setProperty("--vv-top", `${Math.round(vv.offsetTop)}px`);
      root.style.setProperty("--vv-height", `${Math.round(vv.height)}px`);
      // Tras encoger la hoja, lleva a la vista el campo que se está escribiendo.
      const el = campoEnHoja();
      if (el) requestAnimationFrame(() => el.scrollIntoView({ block: "nearest" }));
    };
    const onFocus = () => {
      // Safari anima el teclado; espera a que termine antes de acomodar.
      setTimeout(() => campoEnHoja()?.scrollIntoView({ block: "nearest" }), 300);
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    document.addEventListener("focusin", onFocus);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      document.removeEventListener("focusin", onFocus);
      root.style.removeProperty("--vv-top");
      root.style.removeProperty("--vv-height");
    };
  }, []);
  return null;
}
