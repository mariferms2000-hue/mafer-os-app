import Link from "next/link";
import { desc } from "drizzle-orm";
import { Search, History } from "lucide-react";
import { db, schema } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";
export const metadata = { title: "Buscar" };

type Hit = { title: string; sub: string; href: string; category: string };

const CATS = [
  { key: "", label: "Todo" },
  { key: "proyecto", label: "Proyectos" },
  { key: "tarea", label: "Tarjetas" },
  { key: "journal", label: "Journal" },
  { key: "prompt", label: "Prompts" },
  { key: "aprendizaje", label: "Learn Fast" },
  { key: "idea", label: "Ideas" },
  { key: "decision", label: "Decisiones" },
  { key: "recurso", label: "Recursos" },
  { key: "agente", label: "Agentes" },
];

export default async function BuscarPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cat?: string }>;
}) {
  const { q = "", cat = "" } = await searchParams;
  const needle = q.trim().toLowerCase();
  const has = (...fields: (string | null | undefined)[]) =>
    fields.some((f) => (f ?? "").toLowerCase().includes(needle));

  let hits: Hit[] = [];
  if (needle) {
    const [projects, cards, journal, prompts, learning, ideas, decisionsRows, resources, agents] = await Promise.all([
      db.select().from(schema.projects),
      db.select().from(schema.cards),
      db.select().from(schema.journalEntries),
      db.select().from(schema.prompts),
      db.select().from(schema.learningTopics),
      db.select().from(schema.ideas),
      db.select().from(schema.decisions),
      db.select().from(schema.resources),
      db.select().from(schema.agentsSkills),
    ]);
    hits = [
      ...projects.filter((p) => has(p.title, p.description, p.objective, p.notes)).map((p) => ({
        title: p.title, sub: p.objective || p.description || "", href: `/proyectos/${p.id}`, category: "proyecto" })),
      ...cards.filter((c) => has(c.title, c.description, c.nextAction)).map((c) => ({
        title: c.title, sub: c.description || "", href: c.projectId ? `/proyectos/${c.projectId}` : "/tareas", category: "tarea" })),
      ...journal.filter((j) => has(j.title, j.body)).map((j) => ({
        title: j.title, sub: j.date, href: `/explorar/journal/${j.id}`, category: "journal" })),
      ...prompts.filter((p) => has(p.title, p.body, p.purpose)).map((p) => ({
        title: p.title, sub: p.purpose || "", href: "/biblioteca/prompts?q=" + encodeURIComponent(p.title), category: "prompt" })),
      ...learning.filter((l) => has(l.title, l.motivation, l.notes)).map((l) => ({
        title: l.title, sub: l.motivation || "", href: `/explorar/learn-fast/${l.id}`, category: "aprendizaje" })),
      ...ideas.filter((i) => has(i.title, i.description)).map((i) => ({
        title: i.title, sub: i.description || "", href: "/explorar", category: "idea" })),
      ...decisionsRows.filter((d) => has(d.title, d.context, d.decision, d.reason)).map((d) => ({
        title: d.title, sub: d.date, href: "/explorar/decisiones", category: "decision" })),
      ...resources.filter((r) => has(r.title, r.notes, r.topic)).map((r) => ({
        title: r.title, sub: r.notes || r.url || "", href: "/biblioteca/recursos?q=" + encodeURIComponent(r.title), category: "recurso" })),
      ...agents.filter((a) => has(a.name, a.purpose)).map((a) => ({
        title: a.name, sub: a.purpose || "", href: a.kind === "skill" ? "/biblioteca/skills" : "/biblioteca/agentes", category: "agente" })),
    ];
    if (cat) hits = hits.filter((h) => h.category === cat);
  }

  const recents = await db.select().from(schema.recentViews).orderBy(desc(schema.recentViews.viewedAt)).limit(8);

  return (
    <div>
      <PageHeader icon={Search} title="Buscar" intro="Busca en todo tu sistema: proyectos, tarjetas, journal, prompts, ideas y más." />

      <form method="get" className="flex gap-2 mb-4">
        <label className="sr-only" htmlFor="buscar-q">Búsqueda</label>
        <input
          id="buscar-q"
          name="q"
          className="input flex-1 text-base"
          placeholder="¿Qué estás buscando?"
          defaultValue={q}
          autoFocus
          data-testid="search-input"
        />
        {cat && <input type="hidden" name="cat" value={cat} />}
        <button type="submit" className="btn btn-primary" data-testid="search-go">Buscar</button>
      </form>

      {needle && (
        <div className="flex flex-wrap gap-1.5 mb-5">
          {CATS.map((c) => (
            <Link
              key={c.key}
              href={`/buscar?q=${encodeURIComponent(q)}${c.key ? `&cat=${c.key}` : ""}`}
              className={`chip ${cat === c.key ? "!bg-forest !text-cream !border-forest" : "hover:bg-sand"}`}
            >
              {c.label}
            </Link>
          ))}
        </div>
      )}

      {needle ? (
        hits.length === 0 ? (
          <p className="text-sm text-stone">Sin resultados para «{q}». Prueba con otra palabra.</p>
        ) : (
          <ul className="flex flex-col gap-2" data-testid="search-results">
            {hits.slice(0, 40).map((h, i) => (
              <li key={i}>
                <Link href={h.href} className="card p-3.5 flex items-center gap-3 hover:shadow-lift transition-shadow">
                  <span className="chip chip-sage capitalize shrink-0">{h.category}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{h.title}</p>
                    {h.sub && <p className="text-xs text-stone truncate">{h.sub}</p>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : (
        recents.length > 0 && (
          <section>
            <h2 className="text-lg text-forest-deep flex items-center gap-2 mb-3">
              <History size={17} className="text-olive" aria-hidden /> Retomar donde ibas
            </h2>
            <ul className="flex flex-col gap-2">
              {recents.map((r) => (
                <li key={r.id}>
                  <Link href={r.href} className="card p-3.5 flex items-center gap-3 hover:shadow-lift transition-shadow">
                    <span className="chip capitalize shrink-0">{r.entityType}</span>
                    <p className="text-sm font-medium truncate">{r.title}</p>
                    <span className="text-xs text-stone-soft ml-auto shrink-0">{r.viewedAt.slice(0, 10)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )
      )}
    </div>
  );
}
