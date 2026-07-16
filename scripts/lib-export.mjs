/** Utilidades compartidas de exportación para los scripts locales (backup y sync:obsidian).
 *  Leen la base SQLite directamente — no necesitan el servidor corriendo. */
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

export const SCHEMA_VERSION = 1;

export function openDb() {
  const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), "data", "mafer-os.db");
  if (!fs.existsSync(DB_PATH)) {
    console.error("No existe la base de datos en", DB_PATH, "— abre la app al menos una vez.");
    process.exit(1);
  }
  return new Database(DB_PATH, { readonly: true });
}

export function dumpAll(db) {
  const t = (name) => db.prepare(`SELECT * FROM ${name}`).all();
  const data = {
    projects: t("projects"), boards: t("boards"), columns: t("columns"), cards: t("cards"),
    inbox: t("inbox_items"), journal: t("journal_entries"), learning: t("learning_topics"),
    ideas: t("ideas"), prompts: t("prompts"), aiTools: t("ai_tools"),
    agentsSkills: t("agents_skills"), decisions: t("decisions"), resources: t("resources"),
    events: t("events"), priorities: t("today_priorities"),
  };
  // Revisiones (Fase 5A). La tabla puede no existir en bases antiguas.
  try { data.reviews = t("reviews"); } catch { data.reviews = []; }
  return {
    app: "Mafer OS",
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    counts: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length])),
    data,
  };
}

export const slug = (s) =>
  (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "sin-titulo";

const esc = (s) => (s ?? "").trim();
const j = (s, fallback = []) => { try { return JSON.parse(s ?? "null") ?? fallback; } catch { return fallback; } };

/** Genera { rutaRelativa → contenido } en Markdown compatible con el vault. */
export function toMarkdownFiles(dump) {
  const d = dump.data;
  const files = {};
  const colName = new Map(d.columns.map((c) => [c.id, c.title]));
  const projName = new Map(d.projects.map((p) => [p.id, p.title]));

  for (const p of d.projects) {
    const cards = d.cards.filter((c) => c.project_id === p.id && !c.archived);
    const byCol = new Map();
    for (const c of cards) {
      const key = colName.get(c.column_id) ?? "Sin lista";
      byCol.set(key, [...(byCol.get(key) ?? []), c]);
    }
    let md = `# ${p.title}\n\n`;
    if (p.objective) md += `**Objetivo:** ${esc(p.objective)}\n\n`;
    md += `**Estado:** ${p.status} · **Área:** ${p.area}\n\n`;
    if (p.next_action) md += `**Próxima acción:** ${esc(p.next_action)}\n\n`;
    if (p.notes) md += `## Notas\n\n${esc(p.notes)}\n\n`;
    md += `## Tablero\n\n`;
    for (const [col, list] of byCol) {
      md += `### ${col}\n\n${list.map((c) => `- [${c.completed_at ? "x" : " "}] ${c.title}${c.due_date ? ` (📅 ${c.due_date})` : ""}`).join("\n")}\n\n`;
    }
    files[`01 - Proyectos/${slug(p.title)}.md`] = md;
  }
  for (const e of d.journal) {
    files[`04 - Journal/${e.date} ${slug(e.title)}.md`] =
      `# ${e.title}\n\n*${e.date}* · ${e.template_type}${e.favorite ? " · ⭐" : ""}\n\n${esc(e.body)}\n`;
  }
  for (const l of d.learning) {
    const questions = j(l.key_questions);
    const exercises = j(l.exercises);
    let md = `# ${l.title}\n\n**Profundidad:** ${l.depth} · **Estado:** ${l.status} · **Evidencia:** ${l.evidence_class} · **Progreso:** ${l.progress ?? 0}%\n\n`;
    if (l.motivation) md += `**Por qué importa:** ${esc(l.motivation)}\n\n`;
    if (questions.length) md += `## Preguntas clave\n\n${questions.map((q) => `- ${q}`).join("\n")}\n\n`;
    if (exercises.length) md += `## Ejercicios\n\n${exercises.map((e) => `- [${e.done ? "x" : " "}] ${e.text}`).join("\n")}\n\n`;
    if (l.notes) md += `## Notas\n\n${esc(l.notes)}\n`;
    files[`03 - Learn Fast/${slug(l.title)}.md`] = md;
  }
  for (const p of d.prompts) {
    files[`07 - Prompts/${slug(p.title)}.md`] =
      `# ${p.title}\n\n- **Herramienta:** ${p.tool}\n- **Categoría:** ${p.category}\n- **Versión:** ${p.version}\n- **Propósito:** ${esc(p.purpose)}\n\n## Prompt\n\n\`\`\`\n${p.body}\n\`\`\`\n`;
  }
  for (const dec of d.decisions) {
    files[`02 - Decisiones/${dec.date} ${slug(dec.title)}.md`] =
      `# ${dec.title}\n\n*${dec.date}*${dec.project_id ? ` · ${projName.get(dec.project_id) ?? ""}` : ""}\n\n**Contexto:** ${esc(dec.context)}\n\n**Decisión:** ${esc(dec.decision) || dec.title}\n\n**Razón:** ${esc(dec.reason)}\n\n**Consecuencias:** ${esc(dec.consequences)}\n`;
  }
  if (d.resources.length) {
    files[`08 - Recursos/recursos.md`] =
      `# Recursos\n\n| Título | Tipo | Tema | Estado | URL |\n|---|---|---|---|---|\n` +
      d.resources.map((r) => `| ${r.title} | ${r.type} | ${r.topic || "—"} | ${r.status} | ${r.url || "—"} |`).join("\n") + "\n";
  }
  for (const a of d.agentsSkills) {
    const rels = j(a.relationships);
    files[`06 - Agentes y Skills/${slug(a.name)}.md`] =
      `# ${a.name}\n\n**Tipo:** ${a.kind} · **Fuente:** ${a.source} · **Estado:** ${a.status}\n\n**Qué hace:** ${esc(a.purpose)}\n\n**Úsalo cuando:** ${esc(a.when_to_use)}\n\n**No lo uses para:** ${esc(a.when_not_to_use)}\n${a.command ? `\n**Comando:** \`${a.command}\`\n` : ""}${rels.length ? `\n**Trabaja con:** ${rels.map((r) => `[[${r}]]`).join(", ")}\n` : ""}\n**Archivo fuente:** \`${a.source_path}\`\n`;
  }
  // Historial de revisiones diaria/semanal (si la base ya las tiene)
  const reviews = d.reviews ?? [];
  if (reviews.length) {
    let md = `# Historial de revisiones\n\n`;
    for (const r of [...reviews].sort((a, b) => (b.started_at < a.started_at ? -1 : 1))) {
      md += `- **${r.type}** · ${String(r.started_at).slice(0, 16).replace("T", " ")} · ` +
        `${r.completed ? "completa" : "incompleta"}` +
        `${r.processed ? ` · ${r.processed} elementos` : ""}` +
        `${r.summary ? ` — ${esc(r.summary)}` : ""}\n`;
    }
    files["09 - Exportaciones/historial-revisiones.md"] = md;
  }

  return files;
}

export function writeFiles(baseDir, files) {
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(baseDir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
}
