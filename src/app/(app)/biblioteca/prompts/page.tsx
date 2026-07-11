import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { ScrollText, Star, Plus } from "lucide-react";
import { db, schema } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { BibliotecaTabs } from "@/components/library/tabs";
import { PromptCard } from "@/components/library/prompt-card";
import { createPromptAction } from "@/lib/actions/library";

export const dynamic = "force-dynamic";
export const metadata = { title: "Prompts maestros" };

export default async function PromptsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; herramienta?: string; fav?: string; proyecto?: string }>;
}) {
  const { q = "", herramienta = "", fav, proyecto = "" } = await searchParams;
  let prompts = await db.select().from(schema.prompts).orderBy(desc(schema.prompts.updatedAt));
  if (q) {
    const needle = q.toLowerCase();
    prompts = prompts.filter(
      (p) => p.title.toLowerCase().includes(needle) || p.body.toLowerCase().includes(needle) || (p.category ?? "").toLowerCase().includes(needle)
    );
  }
  if (herramienta) prompts = prompts.filter((p) => p.tool === herramienta);
  if (fav) prompts = prompts.filter((p) => p.favorite);
  if (proyecto) prompts = prompts.filter((p) => p.projectId === proyecto);

  const toolOptions = [...new Set(prompts.map((p) => p.tool).filter(Boolean))] as string[];
  const projects = await db
    .select({ id: schema.projects.id, title: schema.projects.title })
    .from(schema.projects)
    .where(eq(schema.projects.archived, false));

  return (
    <div>
      <PageHeader
        icon={ScrollText}
        title="Prompts maestros"
        intro="Tu biblioteca de prompts probados: copia, versiona, duplica y exporta."
      />
      <BibliotecaTabs />

      <details className="card mb-6">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-forest flex items-center gap-2">
          <Plus size={15} aria-hidden /> Nuevo prompt
        </summary>
        <form action={createPromptAction} className="px-4 pb-4 flex flex-col gap-2.5">
          <input name="title" className="input" placeholder="Título" required data-testid="new-prompt-title" />
          <textarea name="body" className="textarea font-mono text-xs" rows={6} placeholder="El prompt completo…" required data-testid="new-prompt-body" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <select name="tool" className="select !min-h-9 text-sm" aria-label="Herramienta">
              <option value="claude-code">Claude Code</option>
              <option value="claude-chat">Claude Chat</option>
              <option value="chatgpt">ChatGPT</option>
              <option value="manus">Manus</option>
              <option value="canva">Canva</option>
              <option value="imagen">Generador de imagen</option>
            </select>
            <input name="category" className="input !min-h-9 text-sm" placeholder="Categoría" />
            <input name="requiredFiles" className="input !min-h-9 text-sm" placeholder="Archivos necesarios" />
            <select name="projectId" className="select !min-h-9 text-sm" aria-label="Proyecto">
              <option value="">Sin proyecto</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>
          <input name="purpose" className="input !min-h-9 text-sm" placeholder="¿Para qué sirve?" />
          <input name="expectedOutput" className="input !min-h-9 text-sm" placeholder="Resultado esperado" />
          <button type="submit" className="btn btn-primary self-start" data-testid="new-prompt-save">Guardar prompt</button>
        </form>
      </details>

      <form method="get" className="flex flex-wrap gap-2 mb-5">
        <label className="sr-only" htmlFor="p-q">Buscar</label>
        <input id="p-q" name="q" className="input !w-56 !min-h-9 text-sm" placeholder="Buscar prompts…" defaultValue={q} />
        <select name="herramienta" className="select !w-auto !min-h-9 text-sm" defaultValue={herramienta} aria-label="Filtrar por herramienta">
          <option value="">Todas las herramientas</option>
          {toolOptions.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <button type="submit" className="btn btn-secondary !min-h-9 text-sm">Filtrar</button>
        <Link href="/biblioteca/prompts?fav=1" className={`chip self-center ${fav ? "!bg-forest !text-cream" : "hover:bg-sand"}`}>
          <Star size={11} aria-hidden /> Favoritos
        </Link>
      </form>

      {prompts.length === 0 ? (
        <EmptyState icon={ScrollText} title="Sin prompts con este filtro" hint="Crea tu primer prompt maestro o limpia los filtros." />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2" data-testid="prompt-list">
          {prompts.map((p) => (
            <PromptCard key={p.id} prompt={p} />
          ))}
        </ul>
      )}
    </div>
  );
}
