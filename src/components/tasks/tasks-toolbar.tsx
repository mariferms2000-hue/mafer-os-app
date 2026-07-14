"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, SlidersHorizontal, Rows3, X, ChevronDown } from "lucide-react";
import { DURATION_LABEL, ENERGY_LABEL } from "@/lib/estimates";
import { tareasUrl, countActiveFilters, type TaskFilters, type ToolbarState } from "./tareas-url";

const KIND_LABEL: Record<string, string> = {
  backlog: "Backlog",
  proximo: "Próximo",
  proceso: "En proceso",
  esperando: "Esperando",
  bloqueado: "Bloqueado",
  despues: "Después",
  terminado: "Terminado",
};

const FECHA_LABEL: Record<string, string> = {
  hoy: "Vence hoy",
  vencidas: "Vencidas",
  semana: "Próximos 7 días",
  con: "Con fecha",
  sin: "Sin fecha",
};

const X_LABEL: Record<string, string> = {
  bloqueadas: "Bloqueadas",
  "sin-estimar": "Sin estimar",
  terminadas: "Terminadas",
  archivadas: "Archivadas",
};

const GRUPOS = [
  { key: "ninguno", label: "Sin agrupar" },
  { key: "proyecto", label: "Por proyecto" },
  { key: "estado", label: "Por estado" },
  { key: "fecha", label: "Por fecha" },
  { key: "duracion", label: "Por duración" },
  { key: "prioridad", label: "Por prioridad" },
  { key: "energia", label: "Por energía" },
];

/** Encabezado de dos niveles: buscador + Filtrar + Agrupar siempre; todo lo
 *  demás vive en paneles bajo demanda. Con filtros activos solo se ve un
 *  resumen compacto y «Limpiar». */
export function TasksToolbar({
  state,
  projects,
}: {
  state: ToolbarState;
  projects: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [panelOpen, setPanelOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [draft, setDraft] = useState<TaskFilters>(state);
  const groupRef = useRef<HTMLDivElement>(null);

  const activos = countActiveFilters(state);
  const projectTitle = (id: string) =>
    id === "ninguno" ? "Sin proyecto" : projects.find((p) => p.id === id)?.title ?? "Proyecto";

  useEffect(() => {
    if (!groupOpen) return;
    function onDown(e: MouseEvent) {
      if (groupRef.current && !groupRef.current.contains(e.target as Node)) setGroupOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [groupOpen]);

  function go(next: Partial<ToolbarState>) {
    router.push(tareasUrl({ base: state, ...next }));
  }

  const resumen: string[] = [];
  if (state.proy) resumen.push(projectTitle(state.proy));
  if (state.estado) resumen.push(KIND_LABEL[state.estado] ?? state.estado);
  if (state.fecha) resumen.push(FECHA_LABEL[state.fecha] ?? state.fecha);
  if (state.dur) resumen.push(state.dur === "sin" ? "Sin duración" : DURATION_LABEL[state.dur] ?? state.dur);
  if (state.en) resumen.push(state.en === "sin" ? "Sin energía" : `Energía ${ENERGY_LABEL[state.en]?.toLowerCase() ?? state.en}`);
  if (state.prio) resumen.push(`Prioridad ${state.prio}`);
  for (const x of state.x) resumen.push(X_LABEL[x] ?? x);

  const grupoActual = GRUPOS.find((g) => g.key === (state.agrupar || "ninguno"))!;

  const select = (
    label: string,
    key: keyof TaskFilters,
    options: { value: string; label: string }[],
    testid: string
  ) => (
    <div>
      <label className="label" htmlFor={testid}>{label}</label>
      <select
        id={testid}
        data-testid={testid}
        className="select"
        value={draft[key] as string}
        onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
      >
        <option value="">Cualquiera</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="mb-3">
      <div className="flex flex-wrap items-center gap-2">
        <form
          className="relative flex-1 min-w-44 max-w-72"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            go({ q: String(fd.get("q") ?? "").trim() });
          }}
        >
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-soft" aria-hidden />
          <label className="sr-only" htmlFor="t-q">Buscar tareas</label>
          <input id="t-q" name="q" className="input !min-h-9 !pl-9 text-sm w-full" placeholder="Buscar tareas…" defaultValue={state.q} />
        </form>

        <button
          type="button"
          className="btn btn-secondary !min-h-9 text-sm"
          onClick={() => {
            setDraft(state);
            setPanelOpen(true);
          }}
          data-testid="open-filters"
        >
          <SlidersHorizontal size={14} aria-hidden /> Filtrar{activos > 0 ? ` (${activos})` : ""}
        </button>

        <div className="relative" ref={groupRef}>
          <button
            type="button"
            className="btn btn-secondary !min-h-9 text-sm"
            onClick={() => setGroupOpen((o) => !o)}
            aria-expanded={groupOpen}
            data-testid="open-group"
          >
            <Rows3 size={14} aria-hidden /> {grupoActual.key === "ninguno" ? "Agrupar" : grupoActual.label}
            <ChevronDown size={12} aria-hidden />
          </button>
          {groupOpen && (
            <div className="absolute right-0 z-30 mt-1 card p-1.5 flex flex-col min-w-44 text-sm" role="menu">
              {GRUPOS.map((g) => (
                <button
                  key={g.key}
                  type="button"
                  role="menuitemradio"
                  aria-checked={grupoActual.key === g.key}
                  className={`text-left rounded-lg px-2.5 py-1.5 hover:bg-beige ${grupoActual.key === g.key ? "font-semibold text-forest" : ""}`}
                  data-testid={`group-${g.key}`}
                  onClick={() => {
                    setGroupOpen(false);
                    go({ agrupar: g.key });
                  }}
                >
                  {g.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Resumen compacto — lo único visible cuando hay filtros activos */}
      {activos > 0 && (
        <p className="text-sm text-stone mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1" data-testid="filters-summary">
          <span className="text-xs">Filtros activos:</span>
          <span className="font-medium text-ink-green">{resumen.join(" · ")}</span>
          <button
            type="button"
            className="underline underline-offset-4 text-xs hover:text-forest"
            onClick={() => go({ proy: "", estado: "", fecha: "", dur: "", en: "", prio: "", x: [] })}
            data-testid="clear-filters-inline"
          >
            Limpiar
          </button>
        </p>
      )}

      {/* Panel Filtrar: lateral en desktop, bottom sheet en móvil */}
      {panelOpen && (
        <div
          className="fixed inset-0 z-[55] bg-charcoal/30 backdrop-blur-sm flex items-end md:items-stretch md:justify-end"
          onClick={(e) => e.target === e.currentTarget && setPanelOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Filtrar tareas"
            className="card w-full md:w-[380px] md:h-full max-h-[92dvh] md:max-h-none overflow-y-auto rounded-b-none md:rounded-none md:rounded-l-[18px] p-5 pb-safe"
            data-testid="filters-panel"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg text-forest-deep">Filtrar</h2>
              <button type="button" onClick={() => setPanelOpen(false)} aria-label="Cerrar" className="btn btn-ghost !p-2">
                <X size={18} aria-hidden />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {select("Proyecto", "proy", [
                { value: "ninguno", label: "Sin proyecto" },
                ...projects.map((p) => ({ value: p.id, label: p.title })),
              ], "flt-proy")}
              {select("Estado", "estado", Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label })), "flt-estado")}
              {select("Fecha", "fecha", Object.entries(FECHA_LABEL).map(([value, label]) => ({ value, label })), "flt-fecha")}
              {select("Duración", "dur", [
                ...Object.entries(DURATION_LABEL).map(([value, label]) => ({ value, label })),
                { value: "sin", label: "Sin duración" },
              ], "flt-dur")}
              {select("Energía", "en", [
                ...Object.entries(ENERGY_LABEL).map(([value, label]) => ({ value, label })),
                { value: "sin", label: "Sin energía" },
              ], "flt-en")}
              {select("Prioridad", "prio", [
                { value: "baja", label: "Baja" },
                { value: "media", label: "Media" },
                { value: "alta", label: "Alta" },
              ], "flt-prio")}

              <div>
                <p className="label">También</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(X_LABEL).map(([value, label]) => {
                    const active = draft.x.includes(value);
                    return (
                      <button
                        key={value}
                        type="button"
                        role="checkbox"
                        aria-checked={active}
                        data-testid={`flt-x-${value}`}
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            x: active ? d.x.filter((v) => v !== value) : [...d.x, value],
                          }))
                        }
                        className={`chip !min-h-8 transition-colors ${active ? "!bg-forest !text-cream !border-forest" : "hover:bg-sand"}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-stone-soft mt-1.5">
                  «Terminadas» y «Archivadas» aplican en la vista Todas.
                </p>
              </div>
            </div>

            <div className="flex gap-2 border-t border-beige pt-4 mt-4">
              <button
                type="button"
                className="btn btn-primary flex-1"
                data-testid="apply-filters"
                onClick={() => {
                  setPanelOpen(false);
                  go(draft);
                }}
              >
                Aplicar filtros
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                data-testid="clear-filters"
                onClick={() => {
                  setPanelOpen(false);
                  go({ proy: "", estado: "", fecha: "", dur: "", en: "", prio: "", x: [] });
                }}
              >
                Limpiar
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setPanelOpen(false)} data-testid="cancel-filters">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
