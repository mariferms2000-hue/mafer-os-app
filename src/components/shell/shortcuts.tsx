"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Atajos globales de teclado: ⌘K / Ctrl+K abre la búsqueda. */
export function GlobalShortcuts() {
  const router = useRouter();
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        router.push("/buscar");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);
  return null;
}
