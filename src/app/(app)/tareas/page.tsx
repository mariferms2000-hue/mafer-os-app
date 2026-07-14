import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { CircleCheckBig, Search } from "lucide-react";
import { db, schema } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { TaskLine, DURATION_LABEL } from "@/components/hoy/task-line";
import { NewTaskButton } from "@/components/tasks/new-task";
import { ArchivedLine } from "@/components/tasks/archived-line";
import { OpenTaskFromQuery } from "@/components/tasks/task-detail";
import type { CardRow } from "@/lib/queries/today";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tareas" };

const FILTROS = [
  { key: "abiertas", label: "Abiertas" },
  { key: "rapidas", label: "≤ 30 min" },
  { key: "bloqueadas", label: "Bloqueadas" },
  { key: "esperando", label: "Esperando" },
  { key: "confecha", label: "Con fecha" },
  { key: "terminadas", label: "Terminadas" },
  { key: "archivadas", label: "Archivadas" },
];

const GRUPOS = [
  { key: "proyecto", label: "Proyecto" },
  { key: "estado", label: "Estado" },
  { key: "fecha", label: "Fecha" },
  { key: "duracion", label: "Duración" },
  { key: "prioridad", label: "Prioridad" },
  { key: "energia", label: "Energía" },
];

const KIND_LABEL: Record<string, string> = {
  backlog: "Backlog",
  proximo: "Próximo",
  proceso: "En proceso",
  esperando: "Esperando",
  bloqueado: "Bloqueado",
  despues: "Después",
  terminado: "Terminado",
};

export default async function TareasPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string; agrupar?: string; q?: string; abrir?: string }>;
}) {
  const { f = "abiertas", agrupar = "proyecto", q = "", abrir = "" } = await searchParams;

  const rows = await db
    .select({ card: schema.cards, projectTitle: schema.projects.title, columnKind: schema.columns.kind })
    .from(schema.cards)
    .leftJoin(schema.projects, eq(schema.cards.projectId, schema.projects.id))
    .leftJoin(schema.columns, eq(schema.cards.columnId, schema.columns.id))
    .orderBy(asc(schema.cards.dueDate));

  let cards: CardRow[] = rows.map((r) => ({ ...r.card, projectTitle: r.projectTitle, columnKind: r.columnKind }));

  if (q.trim()) {
    const needle = q.trim().toLowerCase();
    cards = cards.filter(
      (c) =>
        c.title.toLowerCase().includes(needle) ||
        (c.description ?? "").toLowerCase().includes(needle) ||
        (c.tags ?? []).some((t) => t.toLowerCase().includes(needle))
    );
  }

  const abiertas = (c: CardRow) => !c.completedAt && !c.archived;
  if (f === "abiertas") cards = cards.filter(abiertas);
  else if (f === "rapidas") cards = cards.filter((c) => abiertas(c) && ["5m", "15m", "30m"].includes(c.duration ?? ""));
  else if (f === "bloqueadas") cards = cards.filter((c) => abiertas(c) && (c.blockedReason || c.columnKind === "bloqueado"));
  else if (f === "esperando") cards = cards.filter((c) => abiertas(c) && (c.waitingFor || c.columnKind === "esperando"));
  else if (f === "confecha") cards = cards.filter((c) => abiertas(c) && c.dueDate);
  else if (f === "terminadas")
    cards = cards
      .filter((c) => c.completedAt && !c.archived)
      .sort((a, b) => ((b.completedAt ?? "") < (a.completedAt ?? "") ? -1 : 1))
      .slice(0, 100);
  else if (f === "archivadas") cards = cards.filter((c) => c.archived);

  // Agrupación
  const keyOf = (c: CardRow): string => {
    if (agrupar === "estado") return KIND_LABEL[c.columnKind ?? ""] ?? "Sin lista";
    if (agrupar === "fecha") return c.dueDate ?? "Sin fecha";
    if (agrupar === "duracion") return c.duration ? DURATION_LABEL[c.duration] ?? c.duration : "Sin estimar";
    if (agrupar === "prioridad") return c.priority ? `Prioridad ${c.priority}` : "Sin prioridad";
    if (agrupar === "energia") return c.energy ? `Energía ${c.energy}` : "Sin energía";
    return c.projectTitle ?? "Sin proyecto";
  };
  const grouped = new Map<string, CardRow[]>();
  for (const c of cards) grouped.set(keyOf(c), [...(grouped.get(keyOf(c)) ?? []), c]);

  const projects = await db
    .select({ id: schema.projects.id, title: schema.projects.title })
    .from(schema.projects)
    .where(eq(schema.projects.archived, false))
    .orderBy(asc(schema.projects.title));

  const qs = (params: Record<string, string>) => {
    const merged = { f, agrupar, q, ...params };
    const parts = Object.entries(merged)
      .filter(([k, v]) => v && !(k === "agrupar" && v === "proyecto") && !(k === "f" && v === "abiertas"))
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`);
    return `/tareas${parts.length ? "?" + parts.join("&") : ""}`;
  };

  return (
    <div>
      {abrir && <OpenTaskFromQuery cardId={abrir} />}
      <PageHeader
        icon={CircleCheckBig}
        title="Tareas"
        intro="Todas tus tareas en un solo lugar: abiertas, terminadas y archivadas. Nada se pierde."
      >
        <NewTaskButton projects={projects} />
      </PageHeader>

      <form method="get" className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-soft" aria-hidden />
          <label className="sr-only" htmlFor="t-q">Buscar tareas</label>
          <input id="t-q" name="q" className="input !w-64 !min-h-9 !pl-9 text-sm" placeholder="Buscar tareas…" defaultValue={q} />
        </div>
        {f !== "abiertas" && <input type="hidden" name="f" value={f} />}
        {agrupar !== "proyecto" && <input type="hidden" name="agrupar" value={agrupar} />}
        <button type="submit" className="btn btn-secondary !min-h-9 text-sm">Buscar</button>
      </form>

      <div className="flex flex-wrap items-center gap-1.5 mb-5">
        {FILTROS.map((fl) => (
          <Link
            key={fl.key}
            href={qs({ f: fl.key })}
            className={`chip transition-colors ${f === fl.key ? "!bg-forest !text-cream !border-forest" : "hover:bg-sand"}`}
            data-testid={`filter-${fl.key}`}
          >
            {fl.label}
          </Link>
        ))}
        <span className="mx-1 text-sand-deep" aria-hidden>·</span>
        <span className="text-xs text-stone">Agrupar por:</span>
        {GRUPOS.map((g) => (
          <Link
            key={g.key}
            href={qs({ agrupar: g.key })}
            className={`chip transition-colors ${agrupar === g.key ? "!bg-olive !text-cream !border-olive" : "hover:bg-sand"}`}
          >
            {g.label}
          </Link>
        ))}
      </div>

      {cards.length === 0 ? (
        <EmptyState
          icon={CircleCheckBig}
          title={q ? `Nada encontrado para «${q}»` : "Nada aquí con este filtro"}
          hint={
            f === "terminadas"
              ? "Cuando completes tareas aparecerán aquí, con su fecha, listas para consultar o reabrir."
              : "Crea tu primera tarea con el botón «Nueva tarea»."
          }
        />
      ) : (
        <div className="flex flex-col gap-5" data-testid="task-groups">
          {[...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([groupTitle, list]) => (
            <section key={groupTitle} className="card p-5">
              <h2 className="text-base font-body font-semibold text-ink-green mb-1 flex items-center gap-2">
                {groupTitle}
                <span className="text-xs font-normal text-stone-soft">{list.length}</span>
              </h2>
              <ul className="divide-y divide-beige">
                {list.map((c) => (
                  <li key={c.id}>
                    {f === "archivadas" ? (
                      <ArchivedLine card={c} />
                    ) : (
                      <TaskLine card={c} showProject={agrupar !== "proyecto"} />
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
