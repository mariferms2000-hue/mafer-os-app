"use client";

import { useEffect, useState } from "react";
import { HelpCircle, ChevronDown } from "lucide-react";

const STEPS = [
  { label: "Capturar", desc: "El botón +, sin pensar" },
  { label: "Inbox", desc: "Se guarda al instante" },
  { label: "Procesar", desc: "¿Qué es esto en realidad?" },
  { label: "Destino", desc: "Tarea · Proyecto · Idea · Learn Fast · Journal · Recurso" },
  { label: "Siguiente acción", desc: "…o archivo, y a otra cosa" },
];

/** Ayuda plegable: abierta solo la primera visita, después cerrada por defecto. */
export function LifecycleHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem("inbox-help-seen")) {
        localStorage.setItem("inbox-help-seen", "1");
        const raf = requestAnimationFrame(() => setOpen(true));
        return () => cancelAnimationFrame(raf);
      }
    } catch {}
  }, []);

  return (
    <section className="mt-8">
      <button
        type="button"
        className="flex items-center gap-2 text-sm text-stone hover:text-charcoal transition-colors"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <HelpCircle size={15} aria-hidden />
        ¿Cómo funciona el Inbox?
        <ChevronDown size={14} aria-hidden className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ol className="card p-4 mt-2 flex flex-col md:flex-row md:items-stretch gap-2" aria-label="El viaje de una captura">
          {STEPS.map((s, i) => (
            <li key={s.label} className="flex md:flex-1 items-center gap-3 md:flex-col md:text-center md:gap-1.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sage-soft text-forest text-sm font-display">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-semibold text-ink-green">{s.label}</p>
                <p className="text-xs text-stone">{s.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
