import { asc } from "drizzle-orm";
import { Bot, TerminalSquare, Globe } from "lucide-react";
import { db, schema } from "@/lib/db";
import { getSetting } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { BibliotecaTabs } from "@/components/library/tabs";
import { AgentDiagram } from "@/components/library/agent-diagram";
import { StatusChip, SCOPE_LABEL } from "@/components/library/status-chip";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agentes" };

export default async function AgentesPage() {
  const all = await db.select().from(schema.agentsSkills).orderBy(asc(schema.agentsSkills.name));
  const agents = all.filter((a) => a.kind === "agente");
  const macaAgents = agents.filter((a) => a.scope === "maca");
  const globalAgents = agents.filter((a) => a.scope !== "maca");
  const commands = all.filter((a) => a.kind === "comando");
  const inventoryAt = await getSetting("agents_inventory_at");

  return (
    <div>
      <PageHeader
        icon={Bot}
        title="Agentes"
        intro="Inventario leído directamente de los archivos reales (MACA y ~/.claude). Nada inventado; si algo falta en disco, se marca «No encontrado»."
      />
      <BibliotecaTabs />

      {inventoryAt && (
        <p className="text-xs text-stone-soft mb-4">
          Último inventario: {inventoryAt.slice(0, 10)} · para actualizar: <code className="bg-code-bg border border-card-border px-1 rounded">npm run inventory</code>
        </p>
      )}

      <h2 className="section-eyebrow mb-3">Sistema MACA — cómo se conecta</h2>
      <AgentDiagram agents={macaAgents} />

      {globalAgents.length > 0 && (
        <>
          <h2 className="section-eyebrow mt-8 mb-3 flex items-center gap-2">
            <Globe size={13} className="text-sage-deep" aria-hidden /> Agentes transversales (todos tus proyectos)
          </h2>
          <ul className="grid gap-4 md:grid-cols-2">
            {globalAgents.map((a) => (
              <li key={a.id} className="card p-4" data-testid={`agent-${a.name}`}>
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <code className="text-sm font-semibold text-forest-deep">{a.name}</code>
                  <StatusChip status={a.status} />
                  <span className="chip">{SCOPE_LABEL[a.scope ?? "otro"] ?? a.scope}</span>
                </div>
                <p className="text-sm text-stone">{a.purpose}</p>
                <p className="text-xs text-stone-soft mt-2">
                  {a.sourcePath}
                  {a.fileModified && ` · modificado ${a.fileModified}`}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className="section-eyebrow mt-8 mb-3">Comandos de flujo</h2>
      <p className="text-sm text-stone mb-3">
        Un <strong>comando</strong> es un atajo que escribes en Claude Code (empieza con «/») y activa a uno o varios agentes.
      </p>
      <ul className="grid gap-4 md:grid-cols-2">
        {commands.map((c) => (
          <li key={c.id} className="card p-4">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-sage-soft text-forest">
                <TerminalSquare size={15} aria-hidden />
              </span>
              <code className="text-sm font-semibold text-forest-deep">{c.command || `/${c.name}`}</code>
              <StatusChip status={c.status} />
            </div>
            <p className="text-sm text-stone">{c.purpose}</p>
            {c.whenToUse && <p className="text-xs text-stone-soft mt-2">Úsalo: {c.whenToUse}</p>}
            <p className="text-xs text-stone-soft mt-1">
              {c.sourcePath}
              {c.fileModified && ` · modificado ${c.fileModified}`}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
