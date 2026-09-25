"use client";

import { useEffect } from "react";

/** Publica en --keyboard-inset (en <html>) cuánto tapa el teclado en pantalla.
 *  Safari en iPhone no encoge el viewport de layout al abrir el teclado, así
 *  que las hojas `fixed` pegadas abajo quedaban detrás de él; con esta
 *  variable, .overlay-screen termina justo encima (ver globals.css). */
export function KeyboardInset() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const update = () => {
      const inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      // < 80px no es teclado: barras del navegador que aparecen y desaparecen
      root.style.setProperty("--keyboard-inset", inset > 80 ? `${inset}px` : "0px");
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      root.style.removeProperty("--keyboard-inset");
    };
  }, []);
  return null;
}
