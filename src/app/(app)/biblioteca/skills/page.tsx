import { asc, eq } from "drizzle-orm";
import { Wrench, Bot, TerminalSquare, Brain, MessagesSquare, SquareChevronRight, Globe } from "lucide-react";
import { db, schema } from "@/lib/db";
import { getSetting } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { BibliotecaTabs } from "@/components/library/tabs";
import { StatusChip, SCOPE_LABEL } from "@/components/library/status-chip";

export const dynamic = "force-dynamic";
export const metadata = { title: "Skills" };

const GLOSARIO = [
  { icon: Bot, term: "Agente", def: "Un especialista configurado (con reglas, contexto y límites) que trabaja dentro de Claude Code. Ej.: maca-researcher." },
  { icon: Wrench, term: "Skill", def: "Un paquete de instrucciones que el modelo carga para hacer mejor una tarea concreta. No actúa solo. Ej.: fable-playbook." },
  { icon: TerminalSquare, term: "Comando", def: "Un atajo que empieza con «/» y activa un flujo o agente. Ej.: /maca-auditar." },
  { icon: Brain, term: "Modelo", def: "El «cerebro» que responde (Fable 5, Opus, Sonnet…). Los agentes y skills lo usan por dentro." },
  { icon: MessagesSquare, term: "Interfaz de chat", def: "Donde conversas: ChatGPT, Claude Chat. Buenas para pensar; no tocan tus archivos." },
  { icon: SquareChevronRight, term: "Flujo de terminal", def: "Comandos que corren en tu Mac (npm run backup). Claude Code puede ejecutarlos por ti." },
];

export default async function SkillsPage() {
  const skills = await db
    .select()
    .from(schema.agentsSkills)
    .where(eq(schema.agentsSkills.kind, "skill"))
    .orderBy(asc(schema.agentsSkills.name));
  const inventoryAt = await getSetting("agents_inventory_at");

  return (
    <div>
      <PageHeader
        icon={Wrench}
        title="Skills"
        intro="Las skills instaladas de verdad en tu sistema, leídas de los archivos reales, y un glosario para no confundir las piezas."
      />
      <BibliotecaTabs />

      {inventoryAt && (
        <p className="text-xs text-stone-soft mb-4">
          Último inventario: {inventoryAt.slice(0, 10)} · para actualizar: <code className="bg-code-bg border border-card-border px-1 rounded">npm run inventory</code>
        </p>
      )}

      <h2 className="section-eyebrow mb-3">Tus skills instaladas ({skills.length})</h2>
      <ul className="flex flex-col gap-3 mb-8">
        {skills.map((s) => (
          <li key={s.id} className="card p-4" data-testid={`skill-${s.name}`}>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <code className="text-sm font-semibold text-forest-deep">{s.name}</code>
              <StatusChip status={s.status} />
              <span className="chip">
                {s.scope === "global" && <Globe size={11} aria-hidden />}
                {SCOPE_LABEL[s.scope ?? "otro"] ?? s.scope}
              </span>
            </div>
            <p className="text-sm text-stone">{s.purpose}</p>
            <div className="grid md:grid-cols-2 gap-x-6 gap-y-1 text-sm mt-2">
              {s.whenToUse && <p><strong className="text-ink-green">Úsala cuando:</strong> <span className="text-stone">{s.whenToUse}</span></p>}
              {s.whenNotToUse && <p><strong className="text-ink-green">No es para:</strong> <span className="text-stone">{s.whenNotToUse}</span></p>}
              {(s.relationships ?? []).length > 0 && (
                <p><strong className="text-ink-green">La usan:</strong> <span className="text-stone">{(s.relationships ?? []).join(", ")}</span></p>
              )}
            </div>
            <p className="text-xs text-stone-soft mt-2">
              {s.sourcePath}
              {s.fileModified && ` · modificada ${s.fileModified}`}
            </p>
          </li>
        ))}
        {skills.length === 0 && (
          <li className="text-sm text-stone">No se encontraron skills. Corre <code>npm run inventory</code>.</li>
        )}
      </ul>

      <h2 className="section-eyebrow mb-3">Para no confundirse</h2>
      <ul className="grid gap-3 md:grid-cols-2">
        {GLOSARIO.map(({ icon: Icon, term, def }) => (
          <li key={term} className="card p-4 flex gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-sage-soft text-forest shrink-0">
              <Icon size={17} aria-hidden />
            </span>
            <p className="text-sm"><strong className="text-ink-green">{term}:</strong> <span className="text-stone">{def}</span></p>
          </li>
        ))}
      </ul>
    </div>
  );
}
