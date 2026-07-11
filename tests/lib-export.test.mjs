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
