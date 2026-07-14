"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Star } from "lucide-react";
import { tareasUrl, type ToolbarState } from "./tareas-url";

/** Las 5 vistas principales — nunca más de cinco a la vista, para no saturar. */
export const MAIN_VIEWS = [
  { key: "ahora", label: "Haz ahora" },
  { key: "hoy", label: "Hoy" },
  { key: "rapidas", label: "≤ 30 min" },
  { key: "esperando", label: "Esperando" },
  { key: "todas", label: "Todas" },
] as const;

/** Vistas secundarias, dentro de «Más vistas». */
export const MORE_VIEWS = [
  { key: "baja-energia", label: "Baja energía" },
  { key: "profundo", label: "Trabajo profundo" },
  { key: "bloqueadas", label: "Bloqueadas" },
  { key: "sin-clasificar", label: "Sin clasificar" },
  { key: "sin-proyecto", label: "Sin proyecto" },
  { key: "terminadas", label: "Terminadas" },
  { key: "archivadas", label: "Archivadas" },
] as const;

export const VIEW_LABEL: Record<string, string> = Object.fromEntries(
  [...MAIN_VIEWS, ...MORE_VIEWS].map((v) => [v.key, v.label])
);

const FAV_KEY = "tareas:vistas-favoritas";

/** Selector de vista rápida: 5 principales + hasta 2 favoritas de «Más vistas».
 *  Cambiar de vista conserva búsqueda, filtros y agrupación (van en la URL). */
export function QuickViews({ base }: { base: ToolbarState }) {
  const current = base.v;
  const buildHref = (v: string) => tareasUrl({ base, v });
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [favs, setFavs] = useState<string[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(FAV_KEY) ?? "[]");
      if (Array.isArray(raw)) setFavs(raw.filter((k) => MORE_VIEWS.some((v) => v.key === k)).slice(0, 2));
    } catch {}
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function toggleFav(key: string) {
    setFavs((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key].slice(-2);
      try {
        localStorage.setItem(FAV_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  const chip = (key: string, label: string) => (
    <button
      key={key}
      type="button"
      onClick={() => router.push(buildHref(key))}
      className={`chip transition-colors ${current === key ? "!bg-forest !text-cream !border-forest" : "hover:bg-sand"}`}
      aria-pressed={current === key}
      data-testid={`view-${key}`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-4">
      {MAIN_VIEWS.map((v) => chip(v.key, v.label))}
      {favs.map((k) => chip(k, VIEW_LABEL[k] ?? k))}

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          className={`chip transition-colors ${
            MORE_VIEWS.some((v) => v.key === current && !favs.includes(v.key))
              ? "!bg-forest !text-cream !border-forest"
              : "hover:bg-sand"
          }`}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          data-testid="more-views"
        >
          Más vistas <ChevronDown size={12} aria-hidden className="inline" />
        </button>
        {open && (
          <div className="absolute left-0 z-30 mt-1 card p-1.5 flex flex-col min-w-52 text-sm" role="menu">
            {MORE_VIEWS.map((v) => (
              <div key={v.key} className="flex items-center gap-1">
                <button
                  type="button"
                  role="menuitem"
                  className={`flex-1 text-left rounded-lg px-2.5 py-1.5 hover:bg-beige ${current === v.key ? "font-semibold text-forest" : ""}`}
                  data-testid={`moreview-${v.key}`}
                  onClick={() => {
                    setOpen(false);
                    router.push(buildHref(v.key));
                  }}
                >
                  {v.label}
                </button>
                <button
                  type="button"
                  aria-label={favs.includes(v.key) ? `Quitar «${v.label}» de favoritas` : `Fijar «${v.label}» junto a las vistas principales`}
                  aria-pressed={favs.includes(v.key)}
                  className={`p-1.5 rounded-lg hover:bg-beige ${favs.includes(v.key) ? "text-olive" : "text-stone-soft"}`}
                  onClick={() => toggleFav(v.key)}
                  data-testid={`fav-${v.key}`}
                >
                  <Star size={14} aria-hidden fill={favs.includes(v.key) ? "currentColor" : "none"} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
