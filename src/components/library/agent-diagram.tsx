"use client";

import { useState } from "react";
import { Bot, FileCode2 } from "lucide-react";
import type { schema } from "@/lib/db";

type Agent = typeof schema.agentsSkills.$inferSelect;

/** Posiciones del diagrama del sistema MACA (viewBox 800×430). */
const POS: Record<string, { x: number; y: number; short: string }> = {
  "maca-orchestrator": { x: 400, y: 55, short: "Orquestador" },
  "maca-researcher": { x: 115, y: 190, short: "Investigador" },
  "maca-content-strategist": { x: 305, y: 190, short: "Estratega" },
  "maca-calm-authority-writer": { x: 495, y: 190, short: "Escritor" },
  "maca-clinical-brand-auditor": { x: 685, y: 190, short: "Auditor" },
  "maca-visual-asset-curator": { x: 115, y: 340, short: "Curador visual" },
  "maca-senior-consultant": { x: 305, y: 340, short: "Consultor sr." },
  "maca-legal-policy-assistant": { x: 495, y: 340, short: "Legal" },
  "maca-web-framer-seo-assistant": { x: 685, y: 340, short: "Web / SEO" },
};

const FLOW: [string, string][] = [
  ["maca-researcher", "maca-content-strategist"],
  ["maca-content-strategist", "maca-calm-authority-writer"],
  ["maca-calm-authority-writer", "maca-clinical-brand-auditor"],
  ["maca-visual-asset-curator", "maca-content-strategist"],
];

export function AgentDiagram({ agents }: { agents: Agent[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const byName = new Map(agents.map((a) => [a.name, a]));
  const selected = selectedId ? agents.find((a) => a.id === selectedId) : null;

  return (
    <div>
      <div className="card p-4 overflow-x-auto">
        <svg viewBox="0 0 800 430" className="w-full min-w-[560px]" role="group" aria-label="Diagrama del sistema de agentes MACA">
          {/* flechas del orquestador al pipeline */}
          {["maca-researcher", "maca-content-strategist", "maca-calm-authority-writer", "maca-clinical-brand-auditor"].map((n) => (
            <line key={n} x1={400} y1={80} x2={POS[n].x} y2={POS[n].y - 32} stroke="#d4c5a9" strokeWidth="1.5" strokeDasharray="4 4" />
          ))}
          {/* pipeline principal */}
          {FLOW.map(([a, b]) => (
            <g key={`${a}-${b}`}>
              <line x1={POS[a].x + (POS[a].y === POS[b].y ? 62 : 0)} y1={POS[a].y === POS[b].y ? POS[a].y : POS[a].y - 32}
                x2={POS[b].x - (POS[a].y === POS[b].y ? 70 : 0)} y2={POS[a].y === POS[b].y ? POS[b].y : POS[b].y + 32}
                stroke="#7c9473" strokeWidth="2" markerEnd="url(#arrow)" />
            </g>
          ))}
          <defs>
            <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill="#7c9473" />
            </marker>
          </defs>
          <text x={400} y={130} textAnchor="middle" fontSize="11" fill="#7c766a">
            pipeline de contenido → (investigar → planear → redactar → auditar)
          </text>
          <text x={400} y={415} textAnchor="middle" fontSize="11" fill="#7c766a">
            especialistas de apoyo (se usan directo cuando los necesitas)
          </text>
          {Object.entries(POS).map(([name, p]) => {
            const agent = byName.get(name);
            const isSel = agent && selectedId === agent.id;
            return (
              <g
                key={name}
                onClick={() => agent && setSelectedId(isSel ? null : agent.id)}
                style={{ cursor: agent ? "pointer" : "default" }}
                role="button"
                aria-label={`Ver detalle de ${name}`}
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && agent && setSelectedId(isSel ? null : agent.id)}
              >
                <rect x={p.x - 62} y={p.y - 30} width={124} height={60} rx={14}
                  fill={isSel ? "#45573f" : name === "maca-orchestrator" ? "#dde5d6" : "#fdfcf8"}
                  stroke={isSel ? "#45573f" : "#d4c5a9"} strokeWidth="1.5" />
                <text x={p.x} y={p.y - 4} textAnchor="middle" fontSize="13" fontWeight="600"
                  fill={isSel ? "#faf7f1" : "#324230"}>
                  {p.short}
                </text>
                <text x={p.x} y={p.y + 14} textAnchor="middle" fontSize="9"
                  fill={isSel ? "#dde5d6" : "#7c766a"}>
                  {name.replace("maca-", "")}
                </text>
              </g>
            );
          })}
        </svg>
        <p className="text-xs text-stone-soft mt-1 text-center">Toca cualquier agente para ver su detalle.</p>
      </div>

      {selected && (
        <div className="card p-5 mt-4" data-testid="agent-detail">
          <div className="flex items-center gap-2.5 mb-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-sage-soft text-forest">
              <Bot size={18} aria-hidden />
            </span>
            <h3 className="text-lg text-forest-deep font-display">{selected.name}</h3>
            {selected.command && <span className="chip chip-sage">{selected.command}</span>}
          </div>
          <div className="grid md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <p><strong className="text-ink-green">Qué hace:</strong> <span className="text-stone">{selected.purpose}</span></p>
            <p><strong className="text-ink-green">Recibe:</strong> <span className="text-stone">{selected.input}</span></p>
            <p><strong className="text-ink-green">Devuelve:</strong> <span className="text-stone">{selected.output}</span></p>
            <p><strong className="text-ink-green">Úsalo cuando:</strong> <span className="text-stone">{selected.whenToUse}</span></p>
            <p><strong className="text-ink-green">No lo uses para:</strong> <span className="text-stone">{selected.whenNotToUse}</span></p>
            {(selected.relationships ?? []).length > 0 && (
              <p><strong className="text-ink-green">Trabaja con:</strong> <span className="text-stone">{(selected.relationships ?? []).join(", ")}</span></p>
            )}
          </div>
          {selected.sourcePath && (
            <p className="text-xs text-stone-soft mt-3 flex items-center gap-1.5">
              <FileCode2 size={12} aria-hidden /> {selected.sourcePath}
              {selected.fileModified && <span>· modificado {selected.fileModified}</span>}
              <span>· estado: {selected.status}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
