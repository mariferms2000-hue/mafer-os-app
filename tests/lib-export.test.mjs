import { describe, it, expect } from "vitest";
import { slug, toMarkdownFiles } from "../scripts/lib-export.mjs";

const fixtureDump = {
  exportedAt: "2026-07-10T12:00:00.000Z",
  counts: {},
  data: {
    projects: [
      {
        id: "p1", title: "Proyecto Ñandú", objective: "Probar acentos", status: "activo",
        area: "personal", next_action: "Escribir tests", notes: "", archived: 0,
      },
    ],
    boards: [{ id: "b1", project_id: "p1", title: "Tablero" }],
    columns: [
      { id: "c1", board_id: "b1", title: "Próximo", kind: "proximo", position: 1 },
      { id: "c2", board_id: "b1", title: "Terminado", kind: "terminado", position: 6 },
    ],
    cards: [
      { id: "t1", title: "Tarea abierta", project_id: "p1", column_id: "c1", completed_at: null, due_date: "2026-07-15", archived: 0 },
      { id: "t2", title: "Tarea hecha", project_id: "p1", column_id: "c2", completed_at: "2026-07-09", due_date: null, archived: 0 },
      { id: "t3", title: "Archivada (no debe salir)", project_id: "p1", column_id: "c1", completed_at: null, due_date: null, archived: 1 },
    ],
    inbox: [],
    journal: [
      { id: "j1", title: "Mi día", date: "2026-07-10", body: "Texto libre.", template_type: "diaria", favorite: 1, tags: "[]" },
    ],
    learning: [
      {
        id: "l1", title: "Homeopatía", depth: "exploracion", status: "idea",
        evidence_class: "marco-tradicional", progress: 0, motivation: "Contraste con evidencia",
        key_questions: '["¿Qué dice la evidencia?"]', exercises: '[{"id":"e1","text":"Leer revisión","done":false}]', notes: "",
      },
    ],
    ideas: [],
    prompts: [
      { id: "pr1", title: "Prompt de prueba", body: "Haz X con Y", tool: "claude-code", category: "general", version: "1.0", purpose: "probar" },
    ],
    aiTools: [],
    agentsSkills: [
      {
        id: "a1", name: "maca-researcher", kind: "agente", source: "MACA", status: "activo",
        purpose: "Investiga", when_to_use: "Antes de planear", when_not_to_use: "Copy final",
        command: "/maca-investigar", relationships: '["maca-content-strategist"]', source_path: "~/x.md",
      },
    ],
    decisions: [
      { id: "d1", title: "Usar SQLite", date: "2026-07-10", project_id: "p1", context: "Sin Docker", decision: "", reason: "Local primero", consequences: "Sync después" },
    ],
    resources: [
      { id: "r1", title: "Documentación", type: "sitio", topic: "ia", status: "pendiente", url: "https://example.com" },
    ],
    events: [],
    priorities: [],
  },
};

describe("slug", () => {
  it("normaliza acentos, espacios y símbolos", () => {
    expect(slug("Proyecto Ñandú — ¡éxito!")).toBe("proyecto-nandu-exito");
  });
  it("nunca devuelve vacío", () => {
    expect(slug("¡¡¡")).toBe("sin-titulo");
    expect(slug(null)).toBe("sin-titulo");
  });
});

describe("toMarkdownFiles", () => {
  const files = toMarkdownFiles(fixtureDump);

  it("genera una nota por proyecto con su tablero", () => {
    const md = files["01 - Proyectos/proyecto-nandu.md"];
    expect(md).toContain("# Proyecto Ñandú");
    expect(md).toContain("**Próxima acción:** Escribir tests");
    expect(md).toContain("- [ ] Tarea abierta (📅 2026-07-15)");
    expect(md).toContain("- [x] Tarea hecha");
  });

  it("excluye tarjetas archivadas", () => {
    expect(files["01 - Proyectos/proyecto-nandu.md"]).not.toContain("Archivada");
  });

  it("exporta journal con fecha en el nombre", () => {
    const md = files["04 - Journal/2026-07-10 mi-dia.md"];
    expect(md).toContain("# Mi día");
    expect(md).toContain("⭐");
  });

  it("exporta learn fast con evidencia y ejercicios", () => {
    const md = files["03 - Learn Fast/homeopatia.md"];
    expect(md).toContain("**Evidencia:** marco-tradicional");
    expect(md).toContain("- [ ] Leer revisión");
  });

  it("exporta prompts con el cuerpo en bloque de código", () => {
    expect(files["07 - Prompts/prompt-de-prueba.md"]).toContain("```\nHaz X con Y\n```");
  });

  it("exporta decisiones y agentes con wikilinks", () => {
    expect(files["02 - Decisiones/2026-07-10 usar-sqlite.md"]).toContain("**Razón:** Local primero");
    expect(files["06 - Agentes y Skills/maca-researcher.md"]).toContain("[[maca-content-strategist]]");
  });

  it("exporta recursos como tabla", () => {
    expect(files["08 - Recursos/recursos.md"]).toContain("| Documentación | sitio |");
  });
});

// ─── Fase 5B: exportación completa y legible ────────────────────────
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { toMarkdownFiles as tmf, writeFiles, GENERATED_MARK, fmtLocal, fmtFecha } from "../scripts/lib-export.mjs";

const dump5b = {
  exportedAt: "2026-07-16T01:33:00.000Z",
  counts: {},
  data: {
    projects: [{ id: "p1", title: "MACA", objective: "", status: "activo", area: "personal", next_action: "", notes: "", archived: 0 }],
    boards: [], columns: [], journal: [], prompts: [], aiTools: [], agentsSkills: [], decisions: [],
    learning: [{ id: "l1", title: "Biotipos", depth: "exploracion", status: "activo", evidence_class: "x", progress: 0, motivation: "", key_questions: "[]", exercises: "[]", notes: "" }],
    cards: [
      { id: "c1", title: "Suelta abierta", project_id: null, completed_at: null, archived: 0, due_date: "2026-07-20", duration: "ten_to_30", energy: "low", priority: "alta", description: "Primera línea.\nSegunda.", checklist: '[{"id":"k1","text":"paso","done":false}]', waiting_for: "", blocked_reason: "" },
      { id: "c2", title: "Suelta esperando", project_id: null, completed_at: null, archived: 0, waiting_for: "labs", checklist: "[]", blocked_reason: "" },
      { id: "c3", title: "De proyecto (no duplicar)", project_id: "p1", column_id: "x", completed_at: null, archived: 0, checklist: "[]" },
    ],
    ideas: [
      { id: "i1", title: "Taller de biotipos", status: "incubando", category: "negocio", description: "Un taller corto.", graduated_to: null, created_at: "2026-07-01T18:00:00Z", updated_at: "2026-07-10T18:00:00Z" },
      { id: "i2", title: "Idea breve", status: "algun-dia", category: "general", description: "", graduated_to: "learnfast:l1", created_at: "2026-07-02T18:00:00Z", updated_at: "2026-07-02T18:00:00Z" },
    ],
    inbox: [
      { id: "n1", content: "Captura pendiente", note: "con nota", type_hint: "tarea", processed: 0, converted_to: null, created_at: "2026-07-16T01:33:00Z" },
      { id: "n2", content: "Ya procesada", note: "", type_hint: null, processed: 1, converted_to: "tarea:c1", created_at: "2026-07-14T18:00:00Z" },
      { id: "n3", content: "Archivada vieja", note: "", type_hint: null, processed: 1, converted_to: "archivado", created_at: "2026-07-10T18:00:00Z" },
    ],
    events: [
      { id: "e1", title: "Cita clínica", date: "2099-01-05", start_time: "10:30", end_time: "11:00", type: "reunion", project_id: "p1", notes: "llevar labs" },
    ],
    priorities: [
      { id: "y1", date: "2026-07-15", card_id: "c1", position: 0 },
      { id: "y2", date: "2026-07-14", card_id: "c3", position: 0 },
    ],
    resources: [],
    reviews: [{ id: "r1", type: "diaria", started_at: "2026-07-16T01:33:00Z", finished_at: "2026-07-16T01:38:00Z", completed: 1, processed: 2, summary: "todo bien", step: 5, date: "2026-07-15" }],
  },
};

describe("fase 5B — zona horaria local", () => {
  it("fmtLocal muestra America/Mexico_City, no UTC", () => {
    expect(fmtLocal("2026-07-16T01:33:00Z")).toContain("15 jul 2026");
    expect(fmtLocal("2026-07-16T01:33:00Z")).toMatch(/7:33/); // 19:33 local
  });
  it("fmtFecha no corre el día por UTC", () => {
    expect(fmtFecha("2026-07-15")).toBe("15 jul 2026");
  });
});

describe("fase 5B — secciones nuevas del vault", () => {
  const files = tmf(dump5b);

  it("incubadora: índice + nota individual solo con contenido", () => {
    const idx = files["05 - Incubadora/Incubadora.md"];
    expect(idx).toContain("Taller de biotipos");
    expect(idx).toContain("Learn Fast «Biotipos»"); // vínculo resuelto
    expect(files["05 - Incubadora/taller-de-biotipos.md"]).toContain("Un taller corto.");
    // «Idea breve» sin descripción pero graduada → también tiene nota
    expect(files["05 - Incubadora/idea-breve.md"]).toContain("Se convirtió en:");
  });

  it("inbox: pendientes, procesadas con destino y archivadas", () => {
    const md = files["06 - Inbox/Inbox pendiente.md"];
    expect(md).toContain("## Pendientes (1)");
    expect(md).toContain("**Captura pendiente** — con nota · tipo: Tarea");
    expect(md).toContain("~~Ya procesada~~ → Tarea «Suelta abierta»");
    expect(md).toContain("## Archivadas");
    expect(md).toContain("15 jul 2026"); // hora local, no 16 jul UTC
  });

  it("prioridades por fecha, recientes primero, con estado", () => {
    const md = files["09 - Exportaciones/Prioridades diarias.md"];
    expect(md.indexOf("15 jul 2026")).toBeLessThan(md.indexOf("14 jul 2026"));
    expect(md).toContain("Suelta abierta");
    expect(md).toContain("abierta");
  });

  it("calendario con hora y proyecto", () => {
    const md = files["09 - Exportaciones/Calendario.md"];
    expect(md).toContain("## Próximos");
    expect(md).toContain("10:30–11:00 · Cita clínica (reunion) · MACA — llevar labs");
  });

  it("tareas sin proyecto: agrupadas, con detalle, sin duplicar las de proyectos", () => {
    const md = files["00 - Tareas/Tareas sin proyecto.md"];
    expect(md).toContain("## Abiertas (1)");
    expect(md).toContain("**Suelta abierta** · 📅 20 jul 2026 · ⏱ 10–30 min · ⚡ energía baja · prioridad alta");
    expect(md).toContain("Primera línea.");
    expect(md).toContain("- [ ] paso");
    expect(md).toContain("⏳ espera a: labs");
    expect(md).not.toContain("De proyecto (no duplicar)");
  });

  it("revisiones con hora local y todos los archivos llevan la marca de generado", () => {
    expect(files["09 - Exportaciones/historial-revisiones.md"]).toMatch(/7:33/);
    expect(files["00 - Inicio/Mapa del vault.md"]).toContain("Tareas sin proyecto");
    for (const [k, v] of Object.entries(files)) {
      expect(v, k).toContain(GENERATED_MARK);
    }
  });
});

describe("fase 5B — writeFiles seguro e idempotente", () => {
  it("conserva notas manuales, borra solo generados huérfanos y repite igual", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vault-"));
    // nota manual y nota generada huérfana en carpeta administrada
    fs.mkdirSync(path.join(tmp, "05 - Incubadora"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "05 - Incubadora", "mi nota manual.md"), "# Mía\nno tocar");
    fs.writeFileSync(path.join(tmp, "05 - Incubadora", "huerfana.md"), `# vieja\n${GENERATED_MARK}\n`);

    const files = tmf(dump5b);
    writeFiles(tmp, files);
    expect(fs.existsSync(path.join(tmp, "05 - Incubadora", "mi nota manual.md"))).toBe(true);
    expect(fs.existsSync(path.join(tmp, "05 - Incubadora", "huerfana.md"))).toBe(false);
    expect(fs.existsSync(path.join(tmp, "05 - Incubadora", "taller-de-biotipos.md"))).toBe(true);

    // idempotente: segunda pasada, mismo resultado
    const antes = fs.readdirSync(path.join(tmp, "05 - Incubadora")).sort();
    writeFiles(tmp, tmf(dump5b));
    expect(fs.readdirSync(path.join(tmp, "05 - Incubadora")).sort()).toEqual(antes);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
