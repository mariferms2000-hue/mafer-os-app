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

/* ── Representación local de fechas (los timestamps de la base no se tocan) ── */
export const TIMEZONE = process.env.MAFER_TZ ?? "America/Mexico_City";
export const GENERATED_MARK = "<!-- generado por Mafer OS · se regenera en cada sync · escribe tus notas en otro archivo -->";

/** ISO → «15 jul 2026, 19:33» en la zona local de Mafer. */
export function fmtLocal(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("es-MX", { timeZone: TIMEZONE, dateStyle: "medium", timeStyle: "short" });
  } catch { return String(iso); }
}

/** Fecha de calendario YYYY-MM-DD → «15 jul 2026» (sin pasar por UTC). */
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export function fmtFecha(ymd) {
  if (!ymd) return "";
  const [y, m, dd] = String(ymd).slice(0, 10).split("-").map(Number);
  if (!y || !m || !dd) return String(ymd);
  return `${dd} ${MESES[m - 1]} ${y}`;
}

/** Hoy (YYYY-MM-DD) en la zona local. */
export function hoyLocal() {
  return new Date().toLocaleDateString("en-CA", { timeZone: TIMEZONE });
}

const DUR_LABEL = { under_10: "Menos de 10 min", ten_to_30: "10–30 min", thirty_to_60: "30–60 min", over_60: "Más de 60 min" };
const EN_LABEL = { low: "baja", medium: "media", high: "alta" };
const TIPO_CAPTURA = { tarea: "Tarea", proyecto: "Proyecto", idea: "Idea", aprendizaje: "Learn Fast", journal: "Journal", decision: "Decisión", recurso: "Recurso" };

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
      md += `- **${r.type}** · ${fmtLocal(r.started_at)} · ` +
        `${r.completed ? "completa" : "incompleta"}` +
        `${r.processed ? ` · ${r.processed} elementos` : ""}` +
        `${r.summary ? ` — ${esc(r.summary)}` : ""}\n`;
    }
    files["09 - Exportaciones/historial-revisiones.md"] = md;
  }

  /* ── 05 - Incubadora: índice + nota por idea con contenido ── */
  const ideas = d.ideas ?? [];
  const learnName = new Map(d.learning.map((l) => [l.id, l.title]));
  const IDEA_STATUS = { incubando: "Incubando", "algun-dia": "Algún día", graduada: "Graduada", archivada: "Archivada", rechazada: "Rechazada" };
  const vinculo = (g) => {
    if (!g) return "";
    const [tipo, id] = String(g).split(":");
    if (tipo === "proyecto") return `proyecto «${projName.get(id) ?? "?"}»`;
    if (tipo === "learnfast" || tipo === "aprendizaje") return `Learn Fast «${learnName.get(id) ?? "?"}»`;
    return tipo;
  };
  if (ideas.length) {
    const conNota = (i) => Boolean(esc(i.description)) || Boolean(i.graduated_to);
    let idx = `# Incubadora\n\n| Idea | Estado | Categoría | Creada | Última revisión | Vinculada a |\n|---|---|---|---|---|---|\n`;
    for (const i of [...ideas].sort((a, b) => (b.updated_at < a.updated_at ? -1 : 1))) {
      const nombre = conNota(i) ? `[[${slug(i.title)}\\|${i.title}]]` : i.title;
      idx += `| ${nombre} | ${IDEA_STATUS[i.status] ?? i.status} | ${i.category ?? "general"} | ${fmtLocal(i.created_at)} | ${fmtLocal(i.updated_at)} | ${vinculo(i.graduated_to) || "—"} |\n`;
    }
    files["05 - Incubadora/Incubadora.md"] = idx;
    for (const i of ideas.filter(conNota)) {
      let md = `# ${i.title}\n\n**Estado:** ${IDEA_STATUS[i.status] ?? i.status} · **Categoría:** ${i.category ?? "general"}\n\n`;
      md += `**Creada:** ${fmtLocal(i.created_at)} · **Última revisión:** ${fmtLocal(i.updated_at)}\n\n`;
      if (i.graduated_to) md += `**Se convirtió en:** ${vinculo(i.graduated_to)}\n\n`;
      if (esc(i.description)) md += `${esc(i.description)}\n\n`;
      md += `*(ID interno: ${i.id})*\n`;
      files[`05 - Incubadora/${slug(i.title)}.md`] = md;
    }
  }

  /* ── 06 - Inbox: pendientes, procesadas recientes y archivadas ── */
  const inbox = d.inbox ?? [];
  if (inbox.length) {
    const destino = (c) => {
      if (!c) return "";
      if (c === "archivado") return "archivada";
      const [tipo, id] = String(c).split(":");
      const nombres = {
        tarea: new Map(d.cards.map((x) => [x.id, x.title])),
        proyecto: projName,
        idea: new Map((d.ideas ?? []).map((x) => [x.id, x.title])),
        aprendizaje: learnName,
        recurso: new Map(d.resources.map((x) => [x.id, x.title])),
      };
      const titulo = nombres[tipo]?.get(id);
      return `${TIPO_CAPTURA[tipo] ?? tipo}${titulo ? ` «${titulo}»` : ""}`;
    };
    const pendientes = inbox.filter((i) => !i.processed).sort((a, b) => (b.created_at < a.created_at ? -1 : 1));
    const procesadas = inbox.filter((i) => i.processed && i.converted_to !== "archivado").sort((a, b) => (b.created_at < a.created_at ? -1 : 1)).slice(0, 15);
    const archivadas = inbox.filter((i) => i.converted_to === "archivado").sort((a, b) => (b.created_at < a.created_at ? -1 : 1)).slice(0, 15);
    let md = `# Inbox pendiente\n\n## Pendientes (${pendientes.length})\n\n`;
    md += pendientes.length
      ? pendientes.map((i) => `- **${i.content}**${esc(i.note) ? ` — ${esc(i.note)}` : ""}${i.type_hint ? ` · tipo: ${TIPO_CAPTURA[i.type_hint] ?? i.type_hint}` : ""} · ${fmtLocal(i.created_at)}`).join("\n") + "\n"
      : "Inbox en cero. 🌿\n";
    if (procesadas.length) {
      md += `\n## Procesadas recientemente\n\n` +
        procesadas.map((i) => `- ~~${i.content}~~ → ${destino(i.converted_to)} · ${fmtLocal(i.created_at)}`).join("\n") + "\n";
    }
    if (archivadas.length) {
      md += `\n## Archivadas\n\n` + archivadas.map((i) => `- ~~${i.content}~~ · ${fmtLocal(i.created_at)}`).join("\n") + "\n";
    }
    files["06 - Inbox/Inbox pendiente.md"] = md;
  }

  /* ── 09 - Prioridades diarias, por fecha (reciente → antigua) ── */
  const prioridades = d.priorities ?? [];
  if (prioridades.length) {
    const cardById = new Map(d.cards.map((c) => [c.id, c]));
    const porFecha = new Map();
    for (const p of prioridades) porFecha.set(p.date, [...(porFecha.get(p.date) ?? []), p]);
    let md = `# Prioridades diarias\n\n`;
    for (const fecha of [...porFecha.keys()].sort().reverse()) {
      md += `## ${fmtFecha(fecha)}\n\n`;
      const lista = porFecha.get(fecha).sort((a, b) => a.position - b.position);
      for (const p of lista) {
        const c = cardById.get(p.card_id);
        if (!c) { md += `- ${p.position + 1}. (tarea eliminada)\n`; continue; }
        const proy = c.project_id ? ` · ${projName.get(c.project_id) ?? ""}` : "";
        const estado = c.completed_at ? "completada ✓" : c.archived ? "archivada" : "abierta";
        md += `- ${p.position + 1}. ${c.completed_at ? "~~" : ""}${c.title}${c.completed_at ? "~~" : ""}${proy} · ${estado}\n`;
      }
      md += "\n";
    }
    files["09 - Exportaciones/Prioridades diarias.md"] = md;
  }

  /* ── 09 - Calendario: próximos y pasados recientes, hora local ── */
  const eventos = d.events ?? [];
  if (eventos.length) {
    const hoy = hoyLocal();
    const linea = (e) => {
      const horas = e.start_time ? `${e.start_time}${e.end_time ? `–${e.end_time}` : ""}` : "todo el día";
      const proy = e.project_id ? ` · ${projName.get(e.project_id) ?? ""}` : "";
      return `- **${fmtFecha(e.date)}** · ${horas} · ${e.title} (${e.type ?? "evento"})${proy}${esc(e.notes) ? ` — ${esc(e.notes)}` : ""}`;
    };
    const proximos = eventos.filter((e) => e.date >= hoy).sort((a, b) => (a.date < b.date ? -1 : 1));
    const corte = new Date(Date.now() - 30 * 86_400_000).toLocaleDateString("en-CA", { timeZone: TIMEZONE });
    const pasados = eventos.filter((e) => e.date < hoy && e.date >= corte).sort((a, b) => (b.date < a.date ? -1 : 1)).slice(0, 20);
    let md = `# Calendario\n\n## Próximos\n\n${proximos.length ? proximos.map(linea).join("\n") + "\n" : "Sin eventos próximos.\n"}`;
    if (pasados.length) md += `\n## Pasados recientes (30 días)\n\n${pasados.map(linea).join("\n")}\n`;
    files["09 - Exportaciones/Calendario.md"] = md;
  }

  /* ── 00 - Tareas: las sueltas, sin duplicar las de proyectos ── */
  const sueltas = d.cards.filter((c) => !c.project_id);
  if (sueltas.length) {
    const linea = (c, checkbox = true) => {
      const metas = [
        c.due_date && `📅 ${fmtFecha(c.due_date)}`,
        DUR_LABEL[c.duration] && `⏱ ${DUR_LABEL[c.duration]}`,
        EN_LABEL[c.energy] && `⚡ energía ${EN_LABEL[c.energy]}`,
        c.priority === "alta" && "prioridad alta",
      ].filter(Boolean);
      let out = checkbox ? `- [${c.completed_at ? "x" : " "}] **${c.title}**` : `- **${c.title}**`;
      if (metas.length) out += ` · ${metas.join(" · ")}`;
      const desc = esc(c.description);
      if (desc) out += `\n  ${desc.split("\n")[0].slice(0, 140)}`;
      const checklist = j(c.checklist);
      for (const item of checklist) out += `\n  - [${item.done ? "x" : " "}] ${item.text}`;
      return out;
    };
    const abiertas = sueltas.filter((c) => !c.completed_at && !c.archived && !c.waiting_for && !c.blocked_reason);
    const esperando = sueltas.filter((c) => !c.completed_at && !c.archived && c.waiting_for);
    const bloqueadas = sueltas.filter((c) => !c.completed_at && !c.archived && c.blocked_reason && !c.waiting_for);
    const terminadas = sueltas.filter((c) => c.completed_at && !c.archived).sort((a, b) => (b.completed_at < a.completed_at ? -1 : 1)).slice(0, 20);
    const archivadas = sueltas.filter((c) => c.archived).slice(0, 20);
    let md = `# Tareas sin proyecto\n\n`;
    if (abiertas.length) md += `## Abiertas (${abiertas.length})\n\n${abiertas.map((c) => linea(c)).join("\n")}\n\n`;
    if (esperando.length) md += `## Esperando\n\n${esperando.map((c) => `${linea(c)}\n  ⏳ espera a: ${c.waiting_for}`).join("\n")}\n\n`;
    if (bloqueadas.length) md += `## Bloqueadas\n\n${bloqueadas.map((c) => `${linea(c)}\n  ⛔ ${c.blocked_reason}`).join("\n")}\n\n`;
    if (terminadas.length) md += `## Terminadas recientes\n\n${terminadas.map((c) => linea(c)).join("\n")}\n\n`;
    if (archivadas.length) md += `## Archivadas\n\n${archivadas.map((c) => linea(c, false)).join("\n")}\n`;
    files["00 - Tareas/Tareas sin proyecto.md"] = md;
  }

  /* ── 00 - Inicio: mapa/índice del vault (generado) ── */
  files["00 - Inicio/Mapa del vault.md"] = `# Mapa del vault

\`\`\`
mafer-os-vault/
├── 00 - Inicio/            ← portada y este mapa
├── 00 - Tareas/            ← auto: tareas sin proyecto
├── 01 - Proyectos/         ← auto: un .md por proyecto, con su tablero
├── 02 - Decisiones/        ← auto: una nota por decisión registrada
├── 03 - Learn Fast/        ← auto: un .md por tema de aprendizaje
├── 04 - Journal/           ← auto: tus entradas, por fecha
├── 05 - IA y Herramientas/ ← guía de qué IA usar
├── 05 - Incubadora/        ← auto: tus ideas, con índice
├── 06 - Agentes y Skills/  ← auto: fichas de agentes/comandos/skills MACA
├── 06 - Inbox/             ← auto: capturas pendientes y procesadas
├── 07 - Prompts/           ← auto: tus prompts maestros
├── 08 - Recursos/          ← auto: tabla de recursos
├── 09 - Exportaciones/     ← auto: calendario, prioridades, revisiones y manifiestos
├── 10 - Manuales/          ← guías en español para operar todo
├── Templates/              ← plantillas de Obsidian
└── Attachments/            ← imágenes y adjuntos de tus notas
\`\`\`

## Atajos generados

- [[Tareas sin proyecto]] · [[Incubadora]] · [[Inbox pendiente]]
- [[Prioridades diarias]] · [[Calendario]] · [[historial-revisiones\\|Revisiones]]
- [[recursos\\|Recursos]] · Proyectos, Decisiones, Learn Fast, Journal y Prompts: una nota por elemento en su carpeta.

**auto** = lo escribe \`npm run sync:obsidian\` (o el botón de Ajustes). Cada archivo
generado termina con una marca visible; si lo editas a mano, la siguiente
sincronización lo sobrescribirá. Escribe tus notas personales en cualquier otro
archivo o carpeta: nunca se tocan.
`;

  // Marca de «generado» al final de TODOS los archivos administrados
  for (const k of Object.keys(files)) {
    files[k] = files[k].trimEnd() + "\n\n" + GENERATED_MARK + "\n";
  }

  return files;
}

/** Carpetas administradas por Mafer OS dentro del vault. */
export const MANAGED_DIRS = [
  "00 - Tareas", "01 - Proyectos", "02 - Decisiones", "03 - Learn Fast", "04 - Journal",
  "05 - Incubadora", "06 - Agentes y Skills", "06 - Inbox", "07 - Prompts", "08 - Recursos",
  "09 - Exportaciones",
];

/** Escribe los archivos generados y elimina SOLO los generados huérfanos
 *  (los que llevan la marca y ya no corresponden a ningún registro).
 *  Las notas manuales —sin marca— nunca se tocan. Idempotente. */
export function writeFiles(baseDir, files) {
  const keep = new Set(Object.keys(files));
  for (const dir of MANAGED_DIRS) {
    const full = path.join(baseDir, dir);
    if (!fs.existsSync(full)) continue;
    for (const f of fs.readdirSync(full)) {
      if (!f.endsWith(".md")) continue;
      const rel = `${dir}/${f}`;
      if (keep.has(rel)) continue;
      try {
        const content = fs.readFileSync(path.join(full, f), "utf8");
        if (content.includes(GENERATED_MARK)) fs.rmSync(path.join(full, f));
      } catch {}
    }
  }
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(baseDir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
}
