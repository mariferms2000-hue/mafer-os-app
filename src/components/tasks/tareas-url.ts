/* Estado de la página Tareas ↔ URL. Módulo compartido (servidor y cliente):
   la URL es la única fuente de verdad de vista, búsqueda, filtros y agrupación,
   así todo persiste al refrescar, al navegar y en la memoria de la barra lateral. */

export type TaskFilters = {
  proy: string; // id de proyecto | "ninguno" | ""
  estado: string; // kind de columna | ""
  fecha: string; // hoy | vencidas | semana | con | sin | ""
  dur: string; // under_10|ten_to_30|thirty_to_60|over_60|sin | ""
  en: string; // low|medium|high|sin | ""
  prio: string; // baja|media|alta | ""
  x: string[]; // bloqueadas | sin-estimar | terminadas | archivadas
};

export type ToolbarState = { v: string; q: string; agrupar: string } & TaskFilters;

export function countActiveFilters(f: TaskFilters): number {
  return (
    (f.proy ? 1 : 0) + (f.estado ? 1 : 0) + (f.fecha ? 1 : 0) + (f.dur ? 1 : 0) +
    (f.en ? 1 : 0) + (f.prio ? 1 : 0) + f.x.length
  );
}

/** Construye la URL de /tareas conservando todo el estado. Los valores por
 *  defecto (vista «ahora», sin agrupar) no ensucian la URL. */
export function tareasUrl(s: Partial<ToolbarState> & { base: ToolbarState }): string {
  const m = { ...s.base, ...s };
  const p = new URLSearchParams();
  if (m.v && m.v !== "ahora") p.set("v", m.v);
  if (m.q) p.set("q", m.q);
  if (m.agrupar && m.agrupar !== "ninguno") p.set("agrupar", m.agrupar);
  if (m.proy) p.set("proy", m.proy);
  if (m.estado) p.set("estado", m.estado);
  if (m.fecha) p.set("fecha", m.fecha);
  if (m.dur) p.set("dur", m.dur);
  if (m.en) p.set("en", m.en);
  if (m.prio) p.set("prio", m.prio);
  if (m.x.length) p.set("x", m.x.join(","));
  const qs = p.toString();
  return `/tareas${qs ? `?${qs}` : ""}`;
}
