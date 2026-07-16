"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";

const PRINCIPALES = [
  { key: "activos", label: "Activos" },
  { key: "atencion", label: "Necesitan atención" },
  { key: "todos", label: "Todos" },
];
const MAS_ESTADOS = [
  { key: "pausados", label: "Pausados" },
  { key: "esperando", label: "Esperando" },
  { key: "terminados", label: "Terminados" },
  { key: "archivados", label: "Archivados" },
];
const AREAS = [
  { key: "", label: "Todas las áreas" },
  { key: "personal", label: "Personal" },
  { key: "profesional", label: "Profesional" },
  { key: "aprendizaje", label: "Aprendizaje" },
  { key: "familia", label: "Familia" },
];

/** Filtros de Proyectos sin saturar: 3 chips + «Más estados» + área. Todo en la URL. */
export function ProjectsFilter({ f, area, atencion }: { f: string; area: string; atencion: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const url = (nf: string, na: string) =>
    `/proyectos${nf !== "activos" || na ? `?${new URLSearchParams({ ...(nf !== "activos" ? { f: nf } : {}), ...(na ? { area: na } : {}) })}` : ""}`;

  const enMas = MAS_ESTADOS.some((m) => m.key === f);

  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-5">
      {PRINCIPALES.map((fl) => (
        <button
          key={fl.key}
          type="button"
          onClick={() => router.push(url(fl.key, area))}
          className={`chip transition-colors ${f === fl.key ? "chip-on" : "hover:bg-sand"}`}
          aria-pressed={f === fl.key}
          data-testid={`pf-${fl.key}`}
        >
          {fl.label}
          {fl.key === "atencion" && atencion > 0 && <span className="ml-1 tabular-nums">({atencion})</span>}
        </button>
      ))}

      <div className="relative" ref={ref}>
        <button
          type="button"
          className={`chip transition-colors ${enMas ? "chip-on" : "hover:bg-sand"}`}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          data-testid="pf-more"
        >
          {enMas ? MAS_ESTADOS.find((m) => m.key === f)!.label : "Más estados"} <ChevronDown size={12} aria-hidden className="inline" />
        </button>
        {open && (
          <div className="absolute left-0 z-30 mt-1 card p-1.5 flex flex-col min-w-44 text-sm" role="menu">
            {MAS_ESTADOS.map((m) => (
              <button
                key={m.key}
                type="button"
                role="menuitem"
                className={`text-left rounded-lg px-2.5 py-1.5 hover:bg-beige ${f === m.key ? "font-semibold text-forest" : ""}`}
                data-testid={`pf-estado-${m.key}`}
                onClick={() => {
                  setOpen(false);
                  router.push(url(m.key, area));
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <label className="sr-only" htmlFor="pf-area">Área</label>
      <select
        id="pf-area"
        className="select !min-h-8 !py-1 !w-auto text-xs ml-1"
        value={area}
        onChange={(e) => router.push(url(f, e.target.value))}
        data-testid="pf-area"
      >
        {AREAS.map((a) => (
          <option key={a.key} value={a.key}>{a.label}</option>
        ))}
      </select>
    </div>
  );
}
