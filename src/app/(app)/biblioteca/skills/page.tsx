import { asc, eq } from "drizzle-orm";
import { Wrench, Bot, TerminalSquare, Brain, MessagesSquare, SquareChevronRight } from "lucide-react";
import { db, schema } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { BibliotecaTabs } from "@/components/library/tabs";

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

  return (
    <div>
      <PageHeader
        icon={Wrench}
        title="Skills"
        intro="Qué es cada pieza del ecosistema y qué skills tienes instaladas de verdad."
      />
      <BibliotecaTabs />

      <h2 className="text-lg text-forest-deep mb-3">Para no confundirse</h2>
      <ul className="grid gap-3 md:grid-cols-2 mb-8">
        {GLOSARIO.map(({ icon: Icon, term, def }) => (
          <li key={term} className="card p-4 flex gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-sage-soft text-forest shrink-0">
              <Icon size={17} aria-hidden />
            </span>
            <p className="text-sm"><strong className="text-ink-green">{term}:</strong> <span className="text-stone">{def}</span></p>
          </li>
        ))}
      </ul>

      <h2 className="text-lg text-forest-deep mb-3">Tus skills instaladas</h2>
      {skills.length === 0 ? (
        <p className="text-sm text-stone">No se encontraron skills en el inventario.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {skills.map((s) => (
            <li key={s.id} className="card p-4">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <code className="text-sm font-semibold text-forest-deep">{s.name}</code>
                <span className="chip chip-sage capitalize">{s.status}</span>
                <span className="chip">{s.source}</span>
              </div>
              <p className="text-sm text-stone">{s.purpose}</p>
              <div className="grid md:grid-cols-2 gap-x-6 gap-y-1 text-sm mt-2">
                <p><strong className="text-ink-green">Úsala cuando:</strong> <span className="text-stone">{s.whenToUse}</span></p>
                <p><strong className="text-ink-green">No es para:</strong> <span className="text-stone">{s.whenNotToUse}</span></p>
              </div>
              {s.sourcePath && <p className="text-xs text-stone-soft mt-2">{s.sourcePath}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
