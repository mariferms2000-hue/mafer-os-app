import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { FolderOpen, Star, Plus } from "lucide-react";
import { db, schema } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { BibliotecaTabs } from "@/components/library/tabs";
import { ResourceItem } from "@/components/library/resource-item";
import { createResourceAction } from "@/lib/actions/library";

export const dynamic = "force-dynamic";
export const metadata = { title: "Recursos" };

const TYPES = ["video", "articulo", "sitio", "libro", "documento", "curso", "archivo", "herramienta"];

export default async function RecursosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tipo?: string; fav?: string; estado?: string }>;
}) {
  const { q = "", tipo = "", fav, estado = "" } = await searchParams;
  let resources = await db.select().from(schema.resources).orderBy(desc(schema.resources.createdAt));
  if (q) {
    const needle = q.toLowerCase();
    resources = resources.filter(
      (r) => r.title.toLowerCase().includes(needle) || (r.topic ?? "").toLowerCase().includes(needle) || (r.notes ?? "").toLowerCase().includes(needle)
    );
  }
  if (tipo) resources = resources.filter((r) => r.type === tipo);
  if (fav) resources = resources.filter((r) => r.favorite);
  if (estado) resources = resources.filter((r) => r.status === estado);

  const projects = await db
    .select({ id: schema.projects.id, title: schema.projects.title })
    .from(schema.projects)
    .where(eq(schema.projects.archived, false));
  const projectName = new Map(projects.map((p) => [p.id, p.title]));

  return (
    <div>
      <PageHeader
        icon={FolderOpen}
        title="Recursos"
        intro="Videos, artículos, libros y herramientas que quieres conservar, con notas y estado de lectura."
      />
      <BibliotecaTabs />

      <details className="card mb-6">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-forest flex items-center gap-2">
          <Plus size={15} aria-hidden /> Guardar un recurso
        </summary>
        <form action={createResourceAction} className="px-4 pb-4 flex flex-col gap-2.5">
          <div className="grid md:grid-cols-2 gap-2.5">
            <input name="title" className="input" placeholder="Título" required data-testid="new-resource-title" />
            <input name="url" className="input" placeholder="https:// (opcional)" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <select name="type" className="select !min-h-9 text-sm" aria-label="Tipo">
              {TYPES.map((t) => (
                <option key={t} value={t} className="capitalize">{t}</option>
              ))}
            </select>
            <input name="topic" className="input !min-h-9 text-sm" placeholder="Tema" />
            <select name="projectId" className="select !min-h-9 text-sm" aria-label="Proyecto">
              <option value="">Sin proyecto</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
            <input name="notes" className="input !min-h-9 text-sm" placeholder="Nota rápida" />
          </div>
          <button type="submit" className="btn btn-primary self-start" data-testid="new-resource-save">Guardar</button>
        </form>
      </details>

      <form method="get" className="flex flex-wrap gap-2 mb-5">
        <label className="sr-only" htmlFor="r-q">Buscar</label>
        <input id="r-q" name="q" className="input !w-56 !min-h-9 text-sm" placeholder="Buscar recursos…" defaultValue={q} />
        <select name="tipo" className="select !w-auto !min-h-9 text-sm" defaultValue={tipo} aria-label="Filtrar por tipo">
          <option value="">Todos los tipos</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select name="estado" className="select !w-auto !min-h-9 text-sm" defaultValue={estado} aria-label="Filtrar por estado">
          <option value="">Cualquier estado</option>
          <option value="pendiente">Pendiente</option>
          <option value="en-proceso">En proceso</option>
          <option value="revisado">Revisado</option>
        </select>
        <button type="submit" className="btn btn-secondary !min-h-9 text-sm">Filtrar</button>
        <Link href="/biblioteca/recursos?fav=1" className={`chip self-center ${fav ? "!bg-forest !text-cream" : "hover:bg-sand"}`}>
          <Star size={11} aria-hidden /> Favoritos
        </Link>
      </form>

      {resources.length === 0 ? (
        <EmptyState icon={FolderOpen} title="Sin recursos guardados" hint="Guarda ese video o artículo que no quieres perder — con una nota de por qué importa." />
      ) : (
        <ul className="flex flex-col gap-2.5" data-testid="resource-list">
          {resources.map((r) => (
            <ResourceItem key={r.id} resource={r} projectTitle={r.projectId ? projectName.get(r.projectId) : undefined} />
          ))}
        </ul>
      )}
    </div>
  );
}
