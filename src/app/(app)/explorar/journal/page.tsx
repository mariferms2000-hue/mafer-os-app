import Link from "next/link";
import { desc } from "drizzle-orm";
import { NotebookPen, Star, Plus } from "lucide-react";
import { db, today, schema } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ExplorarTabs } from "@/components/explore/tabs";
import { createJournalAction } from "@/lib/actions/explore";

export const dynamic = "force-dynamic";
export const metadata = { title: "Journal" };

import { TEMPLATE_LABEL } from "@/components/explore/journal-labels";

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tipo?: string; fav?: string }>;
}) {
  const { q = "", tipo = "", fav } = await searchParams;
  let entries = await db.select().from(schema.journalEntries).orderBy(desc(schema.journalEntries.date));
  if (q) {
    const needle = q.toLowerCase();
    entries = entries.filter(
      (e) => e.title.toLowerCase().includes(needle) || (e.body ?? "").toLowerCase().includes(needle) || (e.tags ?? []).some((t) => t.toLowerCase().includes(needle))
    );
  }
  if (tipo) entries = entries.filter((e) => e.templateType === tipo);
  if (fav) entries = entries.filter((e) => e.favorite);

  return (
    <div>
      <PageHeader
        icon={NotebookPen}
        title="Journal"
        intro="Tu espacio privado para pensar por escrito. Nadie lo analiza, nadie lo interpreta: es solo tuyo."
      />
      <ExplorarTabs />

      <form action={createJournalAction} className="card p-4 mb-6 flex flex-col md:flex-row gap-2.5">
        <input type="hidden" name="date" value={today()} />
        <label className="sr-only" htmlFor="j-title">Título</label>
        <input id="j-title" name="title" className="input flex-1" placeholder="¿Sobre qué quieres escribir hoy?" data-testid="new-journal-input" />
        <select name="templateType" className="select md:!w-56" aria-label="Tipo de entrada">
          {Object.entries(TEMPLATE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <button type="submit" className="btn btn-primary" data-testid="new-journal-save">
          <Plus size={15} aria-hidden /> Escribir
        </button>
      </form>

      <form method="get" className="flex flex-wrap gap-2 mb-5">
        <label className="sr-only" htmlFor="j-q">Buscar</label>
        <input id="j-q" name="q" className="input !w-56 !min-h-9 text-sm" placeholder="Buscar en el journal…" defaultValue={q} />
        <select name="tipo" className="select !w-auto !min-h-9 text-sm" defaultValue={tipo} aria-label="Filtrar por tipo">
          <option value="">Todos los tipos</option>
          {Object.entries(TEMPLATE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <button type="submit" className="btn btn-secondary !min-h-9 text-sm">Filtrar</button>
        <Link href="/explorar/journal?fav=1" className={`chip self-center ${fav ? "!bg-forest !text-cream" : "hover:bg-sand"}`}>
          <Star size={11} aria-hidden /> Favoritas
        </Link>
      </form>

      {entries.length === 0 ? (
        <EmptyState
          icon={NotebookPen}
          title="Sin entradas todavía"
          hint="Escribe la primera: puede ser una línea. «Hoy me di cuenta de que…» es un gran comienzo."
        />
      ) : (
        <ul className="flex flex-col gap-3" data-testid="journal-list">
          {entries.map((e) => (
            <li key={e.id}>
              <Link href={`/explorar/journal/${e.id}`} className="card p-4 flex flex-col gap-1.5 hover:shadow-lift transition-shadow">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold flex-1">{e.title}</p>
                  {e.favorite && <Star size={14} className="text-waiting fill-current" aria-label="Favorita" />}
                </div>
                {e.body && <p className="text-sm text-stone line-clamp-2 whitespace-pre-wrap">{e.body}</p>}
                <div className="flex flex-wrap gap-1.5 mt-1">
                  <span className="chip">{e.date}</span>
                  <span className="chip chip-sage">{TEMPLATE_LABEL[e.templateType ?? "libre"]}</span>
                  {(e.tags ?? []).map((t) => (
                    <span key={t} className="chip">#{t}</span>
                  ))}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
