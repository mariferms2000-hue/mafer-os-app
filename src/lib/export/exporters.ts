import "server-only";
import { db, schema, today } from "@/lib/db";
import { durationLabel, energyLabel } from "@/lib/estimates";

export const SCHEMA_VERSION = 1;

/** Exporta toda la base como objeto JSON serializable. */
export async function exportAllJson() {
  const [
    projects, boards, columns, cards, inbox, journal, learning, ideas,
    prompts, aiTools, agentsSkills, decisions, resources, events, priorities, reviews,
  ] = await Promise.all([
    db.select().from(schema.projects),
    db.select().from(schema.boards),
    db.select().from(schema.columns),
    db.select().from(schema.cards),
    db.select().from(schema.inboxItems),
    db.select().from(schema.journalEntries),
    db.select().from(schema.learningTopics),
    db.select().from(schema.ideas),
    db.select().from(schema.prompts),
    db.select().from(schema.aiTools),
    db.select().from(schema.agentsSkills),
    db.select().from(schema.decisions),
    db.select().from(schema.resources),
    db.select().from(schema.events),
    db.select().from(schema.todayPriorities),
    db.select().from(schema.reviews),
  ]);
  return {
    app: "Mafer OS",
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    counts: {
      projects: projects.length, cards: cards.length, journal: journal.length,
      learning: learning.length, ideas: ideas.length, prompts: prompts.length,
      decisions: decisions.length, resources: resources.length, events: events.length,
      inbox: inbox.length, reviews: reviews.length,
    },
    data: {
      projects, boards, columns, cards, inbox, journal, learning, ideas,
      prompts, aiTools, agentsSkills, decisions, resources, events, priorities, reviews,
    },
  };
}

const mdEscape = (s: string | null | undefined) => (s ?? "").trim();

/** Exporta el sistema como colección de archivos Markdown { ruta relativa → contenido }. */
export async function exportAllMarkdown(): Promise<Record<string, string>> {
  const json = await exportAllJson();
  const d = json.data;
  const files: Record<string, string> = {};
  const colName = new Map(d.columns.map((c) => [c.id, c.title]));
  const projName = new Map(d.projects.map((p) => [p.id, p.title]));
  const slug = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "sin-titulo";

  for (const p of d.projects) {
    const cards = d.cards.filter((c) => c.projectId === p.id && !c.archived);
    const byCol = new Map<string, typeof cards>();
    for (const c of cards) {
      const key = colName.get(c.columnId ?? "") ?? "Sin lista";
      byCol.set(key, [...(byCol.get(key) ?? []), c]);
    }
    let md = `# ${p.title}\n\n`;
    if (p.objective) md += `**Objetivo:** ${mdEscape(p.objective)}\n\n`;
    md += `**Estado:** ${p.status} · **Área:** ${p.area}\n\n`;
    if (p.nextAction) md += `**Próxima acción:** ${mdEscape(p.nextAction)}\n\n`;
    if (p.description) md += `${mdEscape(p.description)}\n\n`;
    if (p.notes) md += `## Notas\n\n${mdEscape(p.notes)}\n\n`;
    md += `## Tablero\n\n`;
    for (const [col, list] of byCol) {
      md += `### ${col}\n\n`;
      for (const c of list) {
        md += `- [${c.completedAt ? "x" : " "}] ${c.title}`;
        const meta = [
          c.dueDate && `📅 ${c.dueDate}`,
          durationLabel(c.duration) && `⏱ ${durationLabel(c.duration)}`,
          energyLabel(c.energy) && `⚡ Energía ${energyLabel(c.energy)?.toLowerCase()}`,
          c.blockedReason && `⛔ ${c.blockedReason}`,
          c.waitingFor && `⏳ ${c.waitingFor}`,
        ].filter(Boolean);
        if (meta.length) md += ` (${meta.join(" · ")})`;
        md += "\n";
      }
      md += "\n";
    }
    files[`01 - Proyectos/${slug(p.title)}.md`] = md;
  }

  for (const j of d.journal) {
    let md = `# ${j.title}\n\n*${j.date}* · ${j.templateType}${j.favorite ? " · ⭐" : ""}\n\n${mdEscape(j.body)}\n`;
    if ((j.tags ?? []).length) md += `\nTags: ${(j.tags ?? []).map((t) => `#${t}`).join(" ")}\n`;
    files[`04 - Journal/${j.date} ${slug(j.title)}.md`] = md;
  }

  for (const l of d.learning) {
    let md = `# ${l.title}\n\n`;
    if (l.motivation) md += `**Por qué importa:** ${mdEscape(l.motivation)}\n\n`;
    if (l.outcome) md += `**Suficientemente bueno:** ${mdEscape(l.outcome)}\n\n`;
    md += `**Profundidad:** ${l.depth} · **Estado:** ${l.status} · **Evidencia:** ${l.evidenceClass} · **Progreso:** ${l.progress ?? 0}%\n\n`;
    if ((l.keyQuestions ?? []).length) md += `## Preguntas clave\n\n${(l.keyQuestions ?? []).map((q) => `- ${q}`).join("\n")}\n\n`;
    if (l.sprint?.goal) md += `## Sprint\n\n${l.sprint.goal} (${l.sprint.start ?? "?"} → ${l.sprint.end ?? "?"})\n\n`;
    if ((l.exercises ?? []).length) md += `## Ejercicios\n\n${(l.exercises ?? []).map((e) => `- [${e.done ? "x" : " "}] ${e.text}`).join("\n")}\n\n`;
    if (l.notes) md += `## Notas\n\n${mdEscape(l.notes)}\n\n`;
    if (l.result) md += `## Resultado\n\n${mdEscape(l.result)}\n`;
    files[`03 - Learn Fast/${slug(l.title)}.md`] = md;
  }

  for (const p of d.prompts) {
    const md = `# ${p.title}\n\n- **Herramienta:** ${p.tool}\n- **Categoría:** ${p.category}\n- **Versión:** ${p.version}\n- **Proyecto:** ${p.projectId ? projName.get(p.projectId) ?? "" : "—"}\n- **Propósito:** ${mdEscape(p.purpose)}\n- **Archivos:** ${mdEscape(p.requiredFiles) || "ninguno"}\n- **Devuelve:** ${mdEscape(p.expectedOutput)}\n\n## Prompt\n\n\`\`\`\n${p.body}\n\`\`\`\n${p.notes ? `\n## Notas\n\n${mdEscape(p.notes)}\n` : ""}`;
    files[`07 - Prompts/${slug(p.title)}.md`] = md;
  }

  for (const dec of d.decisions) {
    const md = `# ${dec.title}\n\n*${dec.date}*${dec.projectId ? ` · ${projName.get(dec.projectId) ?? ""}` : ""}\n\n**Contexto:** ${mdEscape(dec.context)}\n\n**Decisión:** ${mdEscape(dec.decision) || dec.title}\n\n**Razón:** ${mdEscape(dec.reason)}\n\n**Consecuencias:** ${mdEscape(dec.consequences)}\n`;
    files[`02 - Decisiones/${dec.date} ${slug(dec.title)}.md`] = md;
  }

  if (d.resources.length) {
    let md = `# Recursos\n\n| Título | Tipo | Tema | Estado | URL |\n|---|---|---|---|---|\n`;
    for (const r of d.resources) {
      md += `| ${r.title} | ${r.type} | ${r.topic || "—"} | ${r.status} | ${r.url || "—"} |\n`;
    }
    files[`08 - Recursos/recursos.md`] = md;
  }

  for (const a of d.agentsSkills) {
    const md = `# ${a.name}\n\n**Tipo:** ${a.kind} · **Fuente:** ${a.source} · **Estado:** ${a.status}\n\n**Qué hace:** ${mdEscape(a.purpose)}\n\n**Recibe:** ${mdEscape(a.input)}\n\n**Devuelve:** ${mdEscape(a.output)}\n\n**Úsalo cuando:** ${mdEscape(a.whenToUse)}\n\n**No lo uses para:** ${mdEscape(a.whenNotToUse)}\n${a.command ? `\n**Comando:** \`${a.command}\`\n` : ""}${(a.relationships ?? []).length ? `\n**Trabaja con:** ${(a.relationships ?? []).map((r) => `[[${r}]]`).join(", ")}\n` : ""}\n**Archivo fuente:** \`${a.sourcePath}\`\n`;
    files[`06 - Agentes y Skills/${slug(a.name)}.md`] = md;
  }

  files[`09 - Exportaciones/ultima-exportacion.md`] =
    `# Última exportación\n\n- Fecha: ${json.exportedAt}\n- Versión de esquema: ${SCHEMA_VERSION}\n- Proyectos: ${json.counts.projects}\n- Tarjetas: ${json.counts.cards}\n- Journal: ${json.counts.journal}\n- Learn Fast: ${json.counts.learning}\n- Prompts: ${json.counts.prompts}\n- Decisiones: ${json.counts.decisions}\n- Recursos: ${json.counts.resources}\n`;

  // Historial de revisiones diaria/semanal
  if (d.reviews.length) {
    let md = `# Historial de revisiones\n\n`;
    for (const r of [...d.reviews].sort((a, b) => (b.startedAt < a.startedAt ? -1 : 1))) {
      md += `- **${r.type}** · ${r.startedAt.slice(0, 16).replace("T", " ")} · ${r.completed ? "completa" : "incompleta"}` +
        `${r.processed ? ` · ${r.processed} elementos` : ""}${r.summary ? ` — ${mdEscape(r.summary)}` : ""}\n`;
    }
    files["09 - Exportaciones/historial-revisiones.md"] = md;
  }

  return files;
}

export { today };
