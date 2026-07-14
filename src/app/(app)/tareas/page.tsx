import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { CircleCheckBig } from "lucide-react";
import { db, schema, today } from "@/lib/db";
import { getSetting } from "@/lib/auth";
import { recommendNow } from "@/lib/recommend";
import { QUICK_DURATIONS, durationLabel, energyLabel, normalizeDuration, normalizeEnergy } from "@/lib/estimates";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { TaskLine } from "@/components/hoy/task-line";
import { NewTaskButton } from "@/components/tasks/new-task";
import { ArchivedLine } from "@/components/tasks/archived-line";
import { QuickViews } from "@/components/tasks/quick-views";
import { TasksToolbar } from "@/components/tasks/tasks-toolbar";
import { tareasUrl, type ToolbarState } from "@/components/tasks/tareas-url";
import type { CardRow } from "@/lib/queries/today";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tareas" };

const KIND_LABEL: Record<string, string> = {
  backlog: "Backlog",
  proximo: "Próximo",
  proceso: "En proceso",
  esperando: "Esperando",
  bloqueado: "Bloqueado",
  despues: "Después",
  terminado: "Terminado",
};

/** Los enlaces antiguos (?f=…) siguen funcionando: se interpretan como la
 *  vista o el filtro equivalente sin redirigir. */
function legacy(f: string | undefined): Partial<{ v: string; fecha: string; dur: string; en: string }> {
  switch (f) {
    case "rapidas": return { v: "rapidas" };
    case "terminadas": return { v: "terminadas" };
    case "archivadas": return { v: "archivadas" };
    case "bloqueadas": return { v: "bloqueadas" };
    case "esperando": return { v: "esperando" };
    case "abiertas": return { v: "todas" };
    case "confecha": return { v: "todas", fecha: "con" };
    case "sin-duracion": return { v: "todas", dur: "sin" };
    case "sin-energia": return { v: "todas", en: "sin" };
    case "sin-estimar": return { v: "sin-clasificar" };
    default: return {};
  }
}

const VISTA_INTRO: Record<string, string> = {
  ahora: "Lo más accionable primero, según tus prioridades, fechas y energía de hoy.",
  hoy: "Tus prioridades, lo vencido y lo que vence hoy.",
  rapidas: "Cosas que puedes terminar en un hueco corto (menos de 10 y 10–30 min).",
  esperando: "Lo que depende de alguien más.",
  todas: "Todas tus tareas abiertas.",
  "baja-energia": "Tareas ligeras para días con poca pila.",
  profundo: "Trabajo profundo: más de una hora o energía alta.",
  bloqueadas: "Detenidas por algo. Revisa si ya se destrabó.",
  "sin-clasificar": "Sin duración o energía — clasifícalas cuando puedas.",
  "sin-proyecto": "Sueltas, sin proyecto asignado.",
  terminadas: "Lo que ya lograste. Se puede reabrir.",
  archivadas: "Fuera del camino, sin borrarse.",
};

export default async function TareasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const leg = legacy(sp.f);
  const state: ToolbarState = {
    v: sp.v ?? leg.v ?? "ahora",
    q: sp.q ?? "",
    agrupar: sp.agrupar ?? "ninguno",
    proy: sp.proy ?? "",
    estado: sp.estado ?? "",
    fecha: sp.fecha ?? leg.fecha ?? "",
    dur: sp.dur ?? leg.dur ?? "",
    en: sp.en ?? leg.en ?? "",
    prio: sp.prio ?? "",
    x: (sp.x ?? "").split(",").filter(Boolean),
  };
  const d = today();

  const rows = await db
    .select({ card: schema.cards, projectTitle: schema.projects.title, columnKind: schema.columns.kind })
    .from(schema.cards)
    .leftJoin(schema.projects, eq(schema.cards.projectId, schema.projects.id))
    .leftJoin(schema.columns, eq(schema.cards.columnId, schema.columns.id))
    .orderBy(asc(schema.cards.dueDate));
  let cards: CardRow[] = rows.map((r) => ({ ...r.card, projectTitle: r.projectTitle, columnKind: r.columnKind }));

  const abierta = (c: CardRow) => !c.completedAt && !c.archived;
  const bloqueada = (c: CardRow) => Boolean(c.blockedReason) || c.columnKind === "bloqueado";
  const enEspera = (c: CardRow) => Boolean(c.waitingFor) || c.columnKind === "esperando";
  const accionable = (c: CardRow) => abierta(c) && !bloqueada(c) && !enEspera(c) && c.columnKind !== "despues";

  const priorityRows = await db
    .select()
    .from(schema.todayPriorities)
    .where(eq(schema.todayPriorities.date, d))
    .orderBy(asc(schema.todayPriorities.position));
  const priorityIds = priorityRows.map((p) => p.cardId);

  // 1) Conjunto base según la vista rápida
  let recomendadas: string[] = [];
  switch (state.v) {
    case "ahora": {
      const energia = (await getSetting(`energy:${d}`)) ?? "";
      const abiertas = cards.filter(abierta);
      recomendadas = recommendNow({ tasks: abiertas, dayEnergy: energia, priorityIds, today: d, limit: 15 }).map((r) => r.id);
      const orden = new Map(recomendadas.map((id, i) => [id, i]));
      cards = abiertas.filter((c) => orden.has(c.id)).sort((a, b) => orden.get(a.id)! - orden.get(b.id)!);
      break;
    }
    case "hoy": {
      cards = cards.filter(
        (c) => abierta(c) && (priorityIds.includes(c.id) || (c.dueDate !== null && c.dueDate <= d))
      );
      const peso = (c: CardRow) => {
        const p = priorityIds.indexOf(c.id);
        if (p >= 0) return p; // prioridades primero, en su orden
        if (c.dueDate && c.dueDate < d) return 10; // luego lo vencido
        return 20; // luego lo de hoy
      };
      cards.sort((a, b) => peso(a) - peso(b));
      break;
    }
    case "rapidas":
      cards = cards.filter((c) => accionable(c) && QUICK_DURATIONS.includes(c.duration ?? ""));
      cards.sort((a, b) => (a.duration === b.duration ? 0 : a.duration === "under_10" ? -1 : 1));
      break;
    case "esperando":
      cards = cards.filter((c) => abierta(c) && enEspera(c));
      break;
    case "baja-energia":
      cards = cards.filter((c) => accionable(c) && normalizeEnergy(c.energy) === "low");
      break;
    case "profundo":
      cards = cards.filter(
        (c) => accionable(c) && (normalizeDuration(c.duration) === "over_60" || normalizeEnergy(c.energy) === "high")
      );
      break;
    case "bloqueadas":
      cards = cards.filter((c) => abierta(c) && bloqueada(c));
      break;
    case "sin-clasificar":
      cards = cards.filter((c) => abierta(c) && (!c.duration || !c.energy));
      break;
    case "sin-proyecto":
      cards = cards.filter((c) => abierta(c) && !c.projectId);
      break;
    case "terminadas":
      cards = cards
        .filter((c) => c.completedAt && !c.archived)
        .sort((a, b) => ((b.completedAt ?? "") < (a.completedAt ?? "") ? -1 : 1))
        .slice(0, 100);
      break;
    case "archivadas":
      cards = cards.filter((c) => c.archived);
      break;
    default: // todas
      if (state.x.includes("archivadas")) cards = cards.filter((c) => c.archived);
      else if (state.x.includes("terminadas")) cards = cards.filter((c) => c.completedAt && !c.archived);
      else cards = cards.filter(abierta);
  }

  // 2) Filtros combinables (se suman a la vista actual)
  if (state.proy === "ninguno") cards = cards.filter((c) => !c.projectId);
  else if (state.proy) cards = cards.filter((c) => c.projectId === state.proy);
  if (state.estado) cards = cards.filter((c) => c.columnKind === state.estado);
  if (state.fecha === "hoy") cards = cards.filter((c) => c.dueDate === d);
  else if (state.fecha === "vencidas") cards = cards.filter((c) => c.dueDate && c.dueDate < d);
  else if (state.fecha === "semana") {
    const in7 = new Date();
    in7.setDate(in7.getDate() + 7);
    const d7 = in7.toISOString().slice(0, 10);
    cards = cards.filter((c) => c.dueDate && c.dueDate >= d && c.dueDate <= d7);
  } else if (state.fecha === "con") cards = cards.filter((c) => c.dueDate);
  else if (state.fecha === "sin") cards = cards.filter((c) => !c.dueDate);
  if (state.dur === "sin") cards = cards.filter((c) => !c.duration);
  else if (state.dur) cards = cards.filter((c) => normalizeDuration(c.duration) === state.dur);
  if (state.en === "sin") cards = cards.filter((c) => !c.energy);
  else if (state.en) cards = cards.filter((c) => normalizeEnergy(c.energy) === state.en);
  if (state.prio) cards = cards.filter((c) => (c.priority ?? "media") === state.prio);
  if (state.x.includes("bloqueadas")) cards = cards.filter(bloqueada);
  if (state.x.includes("sin-estimar")) cards = cards.filter((c) => !c.duration && !c.energy);

  // 3) Búsqueda
  if (state.q.trim()) {
    const needle = state.q.trim().toLowerCase();
    cards = cards.filter(
      (c) =>
        c.title.toLowerCase().includes(needle) ||
        (c.description ?? "").toLowerCase().includes(needle) ||
        (c.tags ?? []).some((t) => t.toLowerCase().includes(needle))
    );
  }

  // 4) Agrupación (solo una, y solo si Mafer la eligió)
  const keyOf = (c: CardRow): string => {
    if (state.agrupar === "estado") return KIND_LABEL[c.columnKind ?? ""] ?? "Sin lista";
    if (state.agrupar === "fecha") return c.dueDate ?? "Sin fecha";
    if (state.agrupar === "duracion") return durationLabel(c.duration) ?? "Sin estimar";
    if (state.agrupar === "prioridad") return c.priority ? `Prioridad ${c.priority}` : "Sin prioridad";
    if (state.agrupar === "energia") {
      const e = energyLabel(c.energy);
      return e ? `Energía ${e.toLowerCase()}` : "Sin energía";
    }
    return c.projectTitle ?? "Sin proyecto";
  };
  const agrupado = state.agrupar !== "ninguno";
  const grouped = new Map<string, CardRow[]>();
  if (agrupado) for (const c of cards) grouped.set(keyOf(c), [...(grouped.get(keyOf(c)) ?? []), c]);

  const projects = await db
    .select({ id: schema.projects.id, title: schema.projects.title })
    .from(schema.projects)
    .where(eq(schema.projects.archived, false))
    .orderBy(asc(schema.projects.title));

  const esArchivadas = state.v === "archivadas" || (state.v === "todas" && state.x.includes("archivadas"));
  const Row = ({ c }: { c: CardRow }) =>
    esArchivadas ? <ArchivedLine card={c} /> : <TaskLine card={c} showProject={state.agrupar !== "proyecto"} />;

  return (
    <div>
      <PageHeader
        icon={CircleCheckBig}
        title="Tareas"
        intro="¿Qué puedes hacer ahora? Empieza por arriba; los filtros aparecen solo cuando los pides."
      >
        <NewTaskButton projects={projects} />
      </PageHeader>

      <TasksToolbar state={state} projects={projects} />
      <QuickViews base={state} />

      <p className="text-xs text-stone mb-3">{VISTA_INTRO[state.v] ?? ""}</p>

      {cards.length === 0 ? (
        <EmptyState
          icon={CircleCheckBig}
          title={state.q ? `Nada encontrado para «${state.q}»` : "Nada aquí"}
          hint={
            state.v === "ahora"
              ? "Sin pendientes accionables. Revisa Esperando o crea una tarea nueva."
              : state.v === "terminadas"
                ? "Cuando completes tareas aparecerán aquí, listas para consultar o reabrir."
                : "Prueba otra vista o limpia los filtros."
          }
        />
      ) : agrupado ? (
        <div className="flex flex-col gap-5" data-testid="task-groups">
          {[...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([groupTitle, list]) => (
            <section key={groupTitle} className="card p-5">
              <h2 className="text-base font-body font-semibold text-ink-green mb-1 flex items-center gap-2">
                {groupTitle}
                <span className="text-xs font-normal text-stone-soft">{list.length}</span>
              </h2>
              <ul className="divide-y divide-beige">
                {list.map((c) => (
                  <li key={c.id}><Row c={c} /></li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <div className="card p-5" data-testid="task-groups">
          <ul className="divide-y divide-beige">
            {cards.map((c) => (
              <li key={c.id}><Row c={c} /></li>
            ))}
          </ul>
          {state.v === "ahora" && recomendadas.length === 15 && (
            <p className="text-xs text-stone mt-3">
              Mostrando lo más accionable.{" "}
              <Link href={tareasUrl({ base: state, v: "todas" })} className="underline underline-offset-4 hover:text-forest">
                Ver todas
              </Link>
            </p>
          )}
        </div>
      )}

      <p className="text-xs text-stone-soft mt-4">
        ¿Buscas lo ya hecho?{" "}
        <Link href={tareasUrl({ base: state, v: "terminadas" })} className="underline underline-offset-4 hover:text-forest">
          Terminadas
        </Link>
        {" · "}
        <Link href={tareasUrl({ base: state, v: "archivadas" })} className="underline underline-offset-4 hover:text-forest">
          Archivadas
        </Link>
        {" — también viven en «Más vistas»."}
      </p>
    </div>
  );
}
