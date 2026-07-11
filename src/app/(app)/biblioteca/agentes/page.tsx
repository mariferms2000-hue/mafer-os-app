import { asc, eq } from "drizzle-orm";
import { Bot, TerminalSquare } from "lucide-react";
import { db, schema } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { BibliotecaTabs } from "@/components/library/tabs";
import { AgentDiagram } from "@/components/library/agent-diagram";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agentes" };

export default async function AgentesPage() {
  const all = await db.select().from(schema.agentsSkills).orderBy(asc(schema.agentsSkills.name));
  const agents = all.filter((a) => a.kind === "agente");
  const commands = all.filter((a) => a.kind === "comando");

  return (
    <div>
      <PageHeader
        icon={Bot}
        title="Agentes"
        intro="Tu equipo MACA: especialistas configurados con las reglas de tu negocio. Inventario leído directamente del repositorio real (solo lectura)."
      />
      <BibliotecaTabs />

      <h2 className="text-lg text-forest-deep mb-3">Cómo se conectan</h2>
      <AgentDiagram agents={agents} />

      <h2 className="text-lg text-forest-deep mt-8 mb-3">Comandos de flujo</h2>
      <p className="text-sm text-stone mb-3">
        Un <strong>comando</strong> es un atajo que escribes en Claude Code (empieza con «/») y activa a uno o varios agentes.
      </p>
      <ul className="grid gap-4 md:grid-cols-2">
        {commands.map((c) => (
          <li key={c.id} className="card p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-sage-soft text-forest">
                <TerminalSquare size={15} aria-hidden />
              </span>
              <code className="text-sm font-semibold text-forest-deep">{c.command || `/${c.name}`}</code>
            </div>
            <p className="text-sm text-stone">{c.purpose}</p>
            <p className="text-xs text-stone-soft mt-2">Úsalo: {c.whenToUse}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
