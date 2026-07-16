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

/* Representación local (los timestamps guardados no se tocan) */
export const TIMEZONE = process.env.MAFER_TZ ?? "America/Mexico_City";
export const GENERATED_MARK = "<!-- generado por Mafer OS · se regenera en cada sync · escribe tus notas en otro archivo -->";
const fmtLocal = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("es-MX", { timeZone: TIMEZONE, dateStyle: "medium", timeStyle: "short" }) : "";
const MESES_MD = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fmtFecha = (ymd: string | null | undefined) => {
  if (!ymd) return "";
  const [y, m, d] = String(ymd).slice(0, 10).split("-").map(Number);
  return y && m && d ? `${d} ${MESES_MD[m - 1]} ${y}` : String(ymd);
};
const hoyLocal = () => new Date().toLocaleDateString("en-CA", { timeZone: TIMEZONE });
const TIPO_CAPTURA: Record<string, string> = { tarea: "Tarea", proyecto: "Proyecto", idea: "Idea", aprendizaje: "Learn Fast", journal: "Journal", decision: "Decisión", recurso: "Recurso" };
const IDEA_STATUS: Record<string, string> = { incubando: "Incubando", "algun-dia": "Algún día", graduada: "Graduada", archivada: "Archivada", rechazada: "Rechazada" };

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
      md += `- **${r.type}** · ${fmtLocal(r.startedAt)} · ${r.completed ? "completa" : "incompleta"}` +
        `${r.processed ? ` · ${r.processed} elementos` : ""}${r.summary ? ` — ${mdEscape(r.summary)}` : ""}\n`;
    }
    files["09 - Exportaciones/historial-revisiones.md"] = md;
  }

  /* ── 05 - Incubadora ── */
  const learnName = new Map(d.learning.map((l) => [l.id, l.title]));
  const vinculo = (g: string | null) => {
    if (!g) return "";
    const [tipo, gid] = g.split(":");
    if (tipo === "proyecto") return `proyecto «${projName.get(gid) ?? "?"}»`;
    if (tipo === "learnfast" || tipo === "aprendizaje") return `Learn Fast «${learnName.get(gid) ?? "?"}»`;
    return tipo;
  };
  if (d.ideas.length) {
    const conNota = (i: (typeof d.ideas)[number]) => Boolean(mdEscape(i.description)) || Boolean(i.graduatedTo);
    let idx = `# Incubadora\n\n| Idea | Estado | Categoría | Creada | Última revisión | Vinculada a |\n|---|---|---|---|---|---|\n`;
    for (const i of [...d.ideas].sort((a, b) => (b.updatedAt < a.updatedAt ? -1 : 1))) {
      const nombre = conNota(i) ? `[[${slug(i.title)}\\|${i.title}]]` : i.title;
      idx += `| ${nombre} | ${IDEA_STATUS[i.status] ?? i.status} | ${i.category ?? "general"} | ${fmtLocal(i.createdAt)} | ${fmtLocal(i.updatedAt)} | ${vinculo(i.graduatedTo) || "—"} |\n`;
    }
    files["05 - Incubadora/Incubadora.md"] = idx;
    for (const i of d.ideas.filter(conNota)) {
      let md = `# ${i.title}\n\n**Estado:** ${IDEA_STATUS[i.status] ?? i.status} · **Categoría:** ${i.category ?? "general"}\n\n`;
      md += `**Creada:** ${fmtLocal(i.createdAt)} · **Última revisión:** ${fmtLocal(i.updatedAt)}\n\n`;
      if (i.graduatedTo) md += `**Se convirtió en:** ${vinculo(i.graduatedTo)}\n\n`;
      if (mdEscape(i.description)) md += `${mdEscape(i.description)}\n\n`;
      md += `*(ID interno: ${i.id})*\n`;
      files[`05 - Incubadora/${slug(i.title)}.md`] = md;
    }
  }

  /* ── 06 - Inbox ── */
  if (d.inbox.length) {
    const nombres: Record<string, Map<string, string>> = {
      tarea: new Map(d.cards.map((x) => [x.id, x.title])),
      proyecto: projName,
      idea: new Map(d.ideas.map((x) => [x.id, x.title])),
      aprendizaje: learnName,
      recurso: new Map(d.resources.map((x) => [x.id, x.title])),
    };
    const destino = (c: string | null) => {
      if (!c) return "";
      if (c === "archivado") return "archivada";
      const [tipo, cid] = c.split(":");
      const titulo = nombres[tipo]?.get(cid);
      return `${TIPO_CAPTURA[tipo] ?? tipo}${titulo ? ` «${titulo}»` : ""}`;
    };
    const pendientes = d.inbox.filter((i) => !i.processed).sort((a, b) => (b.createdAt < a.createdAt ? -1 : 1));
    const procesadas = d.inbox.filter((i) => i.processed && i.convertedTo !== "archivado").sort((a, b) => (b.createdAt < a.createdAt ? -1 : 1)).slice(0, 15);
    const archivadas = d.inbox.filter((i) => i.convertedTo === "archivado").sort((a, b) => (b.createdAt < a.createdAt ? -1 : 1)).slice(0, 15);
    let md = `# Inbox pendiente\n\n## Pendientes (${pendientes.length})\n\n`;
    md += pendientes.length
      ? pendientes.map((i) => `- **${i.content}**${mdEscape(i.note) ? ` — ${mdEscape(i.note)}` : ""}${i.typeHint ? ` · tipo: ${TIPO_CAPTURA[i.typeHint] ?? i.typeHint}` : ""} · ${fmtLocal(i.createdAt)}`).join("\n") + "\n"
      : "Inbox en cero. 🌿\n";
    if (procesadas.length) md += `\n## Procesadas recientemente\n\n` + procesadas.map((i) => `- ~~${i.content}~~ → ${destino(i.convertedTo)} · ${fmtLocal(i.createdAt)}`).join("\n") + "\n";
    if (archivadas.length) md += `\n## Archivadas\n\n` + archivadas.map((i) => `- ~~${i.content}~~ · ${fmtLocal(i.createdAt)}`).join("\n") + "\n";
    files["06 - Inbox/Inbox pendiente.md"] = md;
  }

  /* ── 09 - Prioridades diarias ── */
  if (d.priorities.length) {
    const cardById = new Map(d.cards.map((c) => [c.id, c]));
    const porFecha = new Map<string, typeof d.priorities>();
    for (const pr of d.priorities) porFecha.set(pr.date, [...(porFecha.get(pr.date) ?? []), pr]);
    let md = `# Prioridades diarias\n\n`;
    for (const fecha of [...porFecha.keys()].sort().reverse()) {
      md += `## ${fmtFecha(fecha)}\n\n`;
      for (const pr of porFecha.get(fecha)!.sort((a, b) => a.position - b.position)) {
        const c = cardById.get(pr.cardId);
        if (!c) { md += `- ${pr.position + 1}. (tarea eliminada)\n`; continue; }
        const proy = c.projectId ? ` · ${projName.get(c.projectId) ?? ""}` : "";
        const estado = c.completedAt ? "completada ✓" : c.archived ? "archivada" : "abierta";
        md += `- ${pr.position + 1}. ${c.completedAt ? "~~" : ""}${c.title}${c.completedAt ? "~~" : ""}${proy} · ${estado}\n`;
      }
      md += "\n";
    }
    files["09 - Exportaciones/Prioridades diarias.md"] = md;
  }

  /* ── 09 - Calendario (hora local) ── */
  if (d.events.length) {
    const hoy = hoyLocal();
    const linea = (e: (typeof d.events)[number]) => {
      const horas = e.startTime ? `${e.startTime}${e.endTime ? `–${e.endTime}` : ""}` : "todo el día";
      const proy = e.projectId ? ` · ${projName.get(e.projectId) ?? ""}` : "";
      return `- **${fmtFecha(e.date)}** · ${horas} · ${e.title} (${e.type ?? "evento"})${proy}${mdEscape(e.notes) ? ` — ${mdEscape(e.notes)}` : ""}`;
    };
    const proximos = d.events.filter((e) => e.date >= hoy).sort((a, b) => (a.date < b.date ? -1 : 1));
    const corte = new Date(Date.now() - 30 * 86_400_000).toLocaleDateString("en-CA", { timeZone: TIMEZONE });
    const pasados = d.events.filter((e) => e.date < hoy && e.date >= corte).sort((a, b) => (b.date < a.date ? -1 : 1)).slice(0, 20);
    let md = `# Calendario\n\n## Próximos\n\n${proximos.length ? proximos.map(linea).join("\n") + "\n" : "Sin eventos próximos.\n"}`;
    if (pasados.length) md += `\n## Pasados recientes (30 días)\n\n${pasados.map(linea).join("\n")}\n`;
    files["09 - Exportaciones/Calendario.md"] = md;
  }

  /* ── 00 - Tareas sin proyecto (sin duplicar las de proyectos) ── */
  const sueltas = d.cards.filter((c) => !c.projectId);
  if (sueltas.length) {
    const linea = (c: (typeof d.cards)[number], checkbox = true) => {
      const metas = [
        c.dueDate && `📅 ${fmtFecha(c.dueDate)}`,
        durationLabel(c.duration) && `⏱ ${durationLabel(c.duration)}`,
        energyLabel(c.energy) && `⚡ energía ${energyLabel(c.energy)?.toLowerCase()}`,
        c.priority === "alta" && "prioridad alta",
      ].filter(Boolean);
      let out = checkbox ? `- [${c.completedAt ? "x" : " "}] **${c.title}**` : `- **${c.title}**`;
      if (metas.length) out += ` · ${metas.join(" · ")}`;
      const desc = mdEscape(c.description);
      if (desc) out += `\n  ${desc.split("\n")[0].slice(0, 140)}`;
      for (const item of c.checklist ?? []) out += `\n  - [${item.done ? "x" : " "}] ${item.text}`;
      return out;
    };
    const abiertas = sueltas.filter((c) => !c.completedAt && !c.archived && !c.waitingFor && !c.blockedReason);
    const esperando = sueltas.filter((c) => !c.completedAt && !c.archived && c.waitingFor);
    const bloqueadas = sueltas.filter((c) => !c.completedAt && !c.archived && c.blockedReason && !c.waitingFor);
    const terminadas = sueltas.filter((c) => c.completedAt && !c.archived).sort((a, b) => ((b.completedAt ?? "") < (a.completedAt ?? "") ? -1 : 1)).slice(0, 20);
    const archivadasT = sueltas.filter((c) => c.archived).slice(0, 20);
    let md = `# Tareas sin proyecto\n\n`;
    if (abiertas.length) md += `## Abiertas (${abiertas.length})\n\n${abiertas.map((c) => linea(c)).join("\n")}\n\n`;
    if (esperando.length) md += `## Esperando\n\n${esperando.map((c) => `${linea(c)}\n  ⏳ espera a: ${c.waitingFor}`).join("\n")}\n\n`;
    if (bloqueadas.length) md += `## Bloqueadas\n\n${bloqueadas.map((c) => `${linea(c)}\n  ⛔ ${c.blockedReason}`).join("\n")}\n\n`;
    if (terminadas.length) md += `## Terminadas recientes\n\n${terminadas.map((c) => linea(c)).join("\n")}\n\n`;
    if (archivadasT.length) md += `## Archivadas\n\n${archivadasT.map((c) => linea(c, false)).join("\n")}\n`;
    files["00 - Tareas/Tareas sin proyecto.md"] = md;
  }

  // Marca de «generado» en todos los archivos administrados
  for (const k of Object.keys(files)) {
    files[k] = files[k].trimEnd() + "\n\n" + GENERATED_MARK + "\n";
  }

  return files;
}

export { today };
