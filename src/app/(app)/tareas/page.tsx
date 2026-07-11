import Link from "next/link";
import { and, asc, eq, isNull } from "drizzle-orm";
import { ListTodo } from "lucide-react";
import { db, schema } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { TaskLine } from "@/components/hoy/task-line";
import type { CardRow } from "@/lib/queries/today";

export const dynamic = "force-dynamic";
export const metadata = { title: "Todas mis tareas" };

const FILTROS = [
  { key: "abiertas", label: "Abiertas" },
  { key: "rapidas", label: "≤ 30 min" },
  { key: "bloqueadas", label: "Bloqueadas" },
  { key: "esperando", label: "Esperando" },
  { key: "confecha", label: "Con fecha" },
  { key: "terminadas", label: "Terminadas" },
];

export default async function TareasPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string; proyecto?: string }>;
}) {
  const { f = "abiertas", proyecto = "" } = await searchParams;

  const rows = await db
    .select({ card: schema.cards, projectTitle: schema.projects.title, columnKind: schema.columns.kind })
    .from(schema.cards)
    .leftJoin(schema.projects, eq(schema.cards.projectId, schema.projects.id))
    .leftJoin(schema.columns, eq(schema.cards.columnId, schema.columns.id))
    .where(and(eq(schema.cards.archived, false)))
    .orderBy(asc(schema.cards.dueDate));

  let cards: CardRow[] = rows.map((r) => ({ ...r.card, projectTitle: r.projectTitle, columnKind: r.columnKind }));
  if (proyecto) cards = cards.filter((c) => c.projectId === proyecto);

  if (f === "abiertas") cards = cards.filter((c) => !c.completedAt);
  else if (f === "rapidas") cards = cards.filter((c) => !c.completedAt && ["5m", "15m", "30m"].includes(c.duration ?? ""));
  else if (f === "bloqueadas") cards = cards.filter((c) => !c.completedAt && (c.blockedReason || c.columnKind === "bloqueado"));
  else if (f === "esperando") cards = cards.filter((c) => !c.completedAt && (c.waitingFor || c.columnKind === "esperando"));
  else if (f === "confecha") cards = cards.filter((c) => !c.completedAt && c.dueDate);
  else if (f === "terminadas") cards = cards.filter((c) => c.completedAt).slice(0, 50);

  const grouped = new Map<string, CardRow[]>();
  for (const c of cards) {
    const key = c.projectTitle ?? "Sin proyecto";
    grouped.set(key, [...(grouped.get(key) ?? []), c]);
  }

  return (
    <div>
      <PageHeader
        icon={ListTodo}
        title="Todas mis tareas"
        intro="La vista consolidada de todos tus proyectos. Útil para planear el día o encontrar huecos."
      />
      <div className="flex flex-wrap gap-1.5 mb-5">
        {FILTROS.map((fl) => (
          <Link
            key={fl.key}
            href={`/tareas?f=${fl.key}`}
            className={`chip transition-colors ${f === fl.key ? "!bg-forest !text-cream !border-forest" : "hover:bg-sand"}`}
          >
            {fl.label}
          </Link>
        ))}
      </div>

      {cards.length === 0 ? (
        <EmptyState icon={ListTodo} title="Nada aquí con este filtro" hint="Prueba otro filtro o crea tarjetas desde un proyecto." />
      ) : (
        <div className="flex flex-col gap-5">
          {[...grouped.entries()].map(([projectTitle, list]) => (
            <section key={projectTitle} className="card p-5">
              <h2 className="text-base font-body font-semibold text-ink-green mb-1">{projectTitle}</h2>
              <ul className="divide-y divide-beige">
                {list.map((c) => (
                  <li key={c.id}>
                    <TaskLine card={c} showProject={false} />
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
