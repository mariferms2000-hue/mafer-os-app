"use server";

import { revalidatePath } from "next/cache";
import { eq, like } from "drizzle-orm";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { db, schema, uid, now, today } from "@/lib/db";
import { requireAuth, setSetting, getSetting } from "@/lib/auth";
import { exportAllJson, exportAllMarkdown, GENERATED_MARK, SCHEMA_VERSION } from "@/lib/export/exporters";

const BACKUPS_DIR = process.env.BACKUPS_PATH ?? path.join(process.cwd(), "..", "backups-and-exports");
const VAULT_DIR = process.env.OBSIDIAN_VAULT_PATH ?? path.join(process.cwd(), "..", "mafer-os-vault");
const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), "data", "mafer-os.db");

function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const MD_TO_BACKUP_DIR: Record<string, string> = {
  "01 - Proyectos": "projects",
  "02 - Decisiones": "decisions",
  "03 - Learn Fast": "learn-fast",
  "04 - Journal": "journal",
  "06 - Agentes y Skills": "agents-skills",
  "07 - Prompts": "prompts",
  "08 - Recursos": "resources",
};

/** Respaldo completo desde la interfaz — mismo resultado que `npm run backup`. */
export async function createBackupAction(): Promise<{ ok: boolean; dir?: string; error?: string }> {
  await requireAuth();
  try {
    const date = localDate();
    const dir = path.join(BACKUPS_DIR, date);
    fs.mkdirSync(dir, { recursive: true });

    const json = await exportAllJson();
    fs.writeFileSync(path.join(dir, "full-backup.json"), JSON.stringify(json, null, 2));

    const files = await exportAllMarkdown();
    for (const [rel, content] of Object.entries(files)) {
      const [top, ...rest] = rel.split("/");
      const mapped = [MD_TO_BACKUP_DIR[top] ?? top, ...rest].join("/");
      const full = path.join(dir, mapped);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content);
    }

    // Copia binaria consistente (API de backup de SQLite, segura con WAL)
    const raw = new Database(DB_PATH, { readonly: true });
    await raw.backup(path.join(dir, "mafer-os.db"));
    raw.close();

    fs.writeFileSync(
      path.join(dir, "manifest.md"),
      `# Respaldo de Mafer OS — ${date}\n\n- Fecha: ${json.exportedAt}\n- Versión de esquema: ${SCHEMA_VERSION}\n\n## Conteos\n\n${Object.entries(json.counts).map(([k, v]) => `- ${k}: ${v}`).join("\n")}\n\n## Cómo restaurar\n\n1. Restauración completa: cierra la app y copia \`mafer-os.db\` de esta carpeta a \`mafer-os-app/data/\` (reemplazando).\n2. Consulta puntual: los .md y el JSON son legibles directamente.\n`
    );

    await setSetting("last_backup_at", json.exportedAt);
    revalidatePath("/ajustes");
    return { ok: true, dir };
  } catch (e) {
    console.error("[backup]", e);
    return { ok: false, error: "No se pudo crear el respaldo. Revisa que la carpeta backups-and-exports exista." };
  }
}

/** Actualiza el vault de Obsidian desde la interfaz — igual que `npm run sync:obsidian`. */
export async function syncObsidianAction(): Promise<{ ok: boolean; notes?: number; error?: string }> {
  await requireAuth();
  try {
    if (!fs.existsSync(VAULT_DIR)) {
      return { ok: false, error: `No encuentro el vault en ${VAULT_DIR}` };
    }
    const files = await exportAllMarkdown();
    // Igual que npm run sync:obsidian: elimina SOLO archivos generados huérfanos
    // (llevan la marca y su registro ya no existe). Las notas manuales no se tocan.
    const MANAGED = [
      "00 - Tareas", "01 - Proyectos", "02 - Decisiones", "03 - Learn Fast", "04 - Journal",
      "05 - Incubadora", "06 - Agentes y Skills", "06 - Inbox", "07 - Prompts", "08 - Recursos",
      "09 - Exportaciones",
    ];
    const keep = new Set(Object.keys(files));
    for (const dir of MANAGED) {
      const fullDir = path.join(VAULT_DIR, dir);
      if (!fs.existsSync(fullDir)) continue;
      for (const f of fs.readdirSync(fullDir)) {
        if (!f.endsWith(".md") || keep.has(`${dir}/${f}`)) continue;
        try {
          if (fs.readFileSync(path.join(fullDir, f), "utf8").includes(GENERATED_MARK)) {
            fs.rmSync(path.join(fullDir, f));
          }
        } catch {}
      }
    }
    for (const [rel, content] of Object.entries(files)) {
      const full = path.join(VAULT_DIR, rel);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content);
    }
    const stamp = new Date().toISOString();
    fs.writeFileSync(
      path.join(VAULT_DIR, "09 - Exportaciones", "ultima-sincronizacion.md"),
      `# Última sincronización\n\n- Fecha: ${stamp}\n- Origen: botón «Actualizar Obsidian» de la app\n- Notas escritas: ${Object.keys(files).length}\n`
    );
    await setSetting("last_obsidian_sync_at", stamp);
    revalidatePath("/ajustes");
    return { ok: true, notes: Object.keys(files).length };
  } catch (e) {
    console.error("[sync-obsidian]", e);
    return { ok: false, error: "No se pudo actualizar el vault." };
  }
}

export async function getMaintenanceStatus() {
  await requireAuth();
  return {
    lastBackup: (await getSetting("last_backup_at")) || null,
    lastSync: (await getSetting("last_obsidian_sync_at")) || null,
    vaultPath: VAULT_DIR,
    backupsPath: BACKUPS_DIR,
  };
}

/* ── Datos de demostración ─────────────────────────────── */

export type DemoCounts = {
  projects: number;
  cards: number;
  inbox: number;
  learning: number;
  ideas: number;
  prompts: number;
  resources: number;
  events: number;
  total: number;
};

export async function getDemoCounts(): Promise<DemoCounts> {
  await requireAuth();
  const starterProjects = await db.select({ id: schema.projects.id }).from(schema.projects).where(eq(schema.projects.isStarter, true));
  const starterProjectIds = new Set(starterProjects.map((p) => p.id));
  const allCards = await db.select({ id: schema.cards.id, isStarter: schema.cards.isStarter, projectId: schema.cards.projectId }).from(schema.cards);
  // Tarjetas de ejemplo directas + las que viven dentro de proyectos de ejemplo
  const cards = allCards.filter((c) => c.isStarter || (c.projectId && starterProjectIds.has(c.projectId))).length;
  const [inbox, learning, ideas, prompts, resources, events] = await Promise.all([
    db.select({ id: schema.inboxItems.id }).from(schema.inboxItems).where(eq(schema.inboxItems.isStarter, true)).then((r) => r.length),
    db.select({ id: schema.learningTopics.id }).from(schema.learningTopics).where(eq(schema.learningTopics.isStarter, true)).then((r) => r.length),
    db.select({ id: schema.ideas.id }).from(schema.ideas).where(eq(schema.ideas.isStarter, true)).then((r) => r.length),
    db.select({ id: schema.prompts.id }).from(schema.prompts).where(eq(schema.prompts.isStarter, true)).then((r) => r.length),
    db.select({ id: schema.resources.id }).from(schema.resources).where(eq(schema.resources.isStarter, true)).then((r) => r.length),
    db.select({ id: schema.events.id }).from(schema.events).where(eq(schema.events.isStarter, true)).then((r) => r.length),
  ]);
  const projects = starterProjects.length;
  return {
    projects, cards, inbox, learning, ideas, prompts, resources, events,
    total: projects + cards + inbox + learning + ideas + prompts + resources + events,
  };
}

/** Convierte todos los datos de ejemplo en datos reales (quita la etiqueta «Ejemplo»). */
export async function convertDemoToRealAction() {
  await requireAuth();
  await db.update(schema.projects).set({ isStarter: false }).where(eq(schema.projects.isStarter, true));
  await db.update(schema.cards).set({ isStarter: false }).where(eq(schema.cards.isStarter, true));
  await db.update(schema.inboxItems).set({ isStarter: false }).where(eq(schema.inboxItems.isStarter, true));
  await db.update(schema.learningTopics).set({ isStarter: false }).where(eq(schema.learningTopics.isStarter, true));
  await db.update(schema.ideas).set({ isStarter: false }).where(eq(schema.ideas.isStarter, true));
  await db.update(schema.prompts).set({ isStarter: false }).where(eq(schema.prompts.isStarter, true));
  await db.update(schema.resources).set({ isStarter: false }).where(eq(schema.resources.isStarter, true));
  await db.update(schema.events).set({ isStarter: false }).where(eq(schema.events.isStarter, true));
  revalidatePath("/", "layout");
}

/** Elimina SOLO los datos de ejemplo. No toca datos reales, configuración, ni agentes/skills. */
export async function deleteDemoDataAction() {
  await requireAuth();
  // Proyectos de ejemplo (sus tableros/columnas/tarjetas caen en cascada)
  await db.delete(schema.projects).where(eq(schema.projects.isStarter, true));
  await db.delete(schema.cards).where(eq(schema.cards.isStarter, true));
  await db.delete(schema.inboxItems).where(eq(schema.inboxItems.isStarter, true));
  await db.delete(schema.learningTopics).where(eq(schema.learningTopics.isStarter, true));
  await db.delete(schema.ideas).where(eq(schema.ideas.isStarter, true));
  await db.delete(schema.prompts).where(eq(schema.prompts.isStarter, true));
  await db.delete(schema.resources).where(eq(schema.resources.isStarter, true));
  await db.delete(schema.events).where(eq(schema.events.isStarter, true));
  revalidatePath("/", "layout");
}

/* ── Pruebas de alertas antiolvido (solo desarrollo) ─────────────────
   Crea datos temporales con el prefijo visible «QA ALERTA» para validar los
   seis escenarios sin esperar días reales. Nunca toca datos reales y todo se
   elimina con un botón. No disponible en producción. */

const QA_PREFIX = "QA ALERTA";

export async function qaToolsEnabled(): Promise<boolean> {
  return process.env.NODE_ENV === "development" || process.env.MAFER_QA_TOOLS === "1";
}

function haceDias(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

export async function seedAlertQaAction() {
  await requireAuth();
  if (!(await qaToolsEnabled())) throw new Error("Las herramientas QA no están disponibles en producción.");
  const t = now();
  const hoy = today();
  const ayer5 = hoy && new Date(Date.now() - 5 * 86_400_000).toISOString().slice(0, 10);

  // 1) Tarea vencida (hace 5 días)
  await db.insert(schema.cards).values({
    id: uid(), title: `${QA_PREFIX} — Tarea vencida`, dueDate: ayer5, createdAt: t, updatedAt: t,
  });
  // 2) Tarea de hoy sin duración ni energía
  await db.insert(schema.cards).values({
    id: uid(), title: `${QA_PREFIX} — Tarea de hoy sin estimar`, dueDate: hoy, createdAt: t, updatedAt: t,
  });
  // 3) Proyecto activo sin siguiente acción (con actividad reciente)
  await db.insert(schema.projects).values({
    id: uid(), title: `${QA_PREFIX} — Proyecto sin siguiente acción`, status: "activo", nextAction: "",
    createdAt: t, updatedAt: t,
  });
  // 4) Captura del Inbox con más de 3 días
  await db.insert(schema.inboxItems).values({
    id: uid(), content: `${QA_PREFIX} — Captura olvidada`, createdAt: haceDias(5),
  });
  // 5) Tarea en Esperando con más de 7 días
  await db.insert(schema.cards).values({
    id: uid(), title: `${QA_PREFIX} — Esperando respuesta`, waitingFor: "QA proveedor",
    createdAt: haceDias(10), updatedAt: haceDias(10),
  });
  // 6) Proyecto sin actividad durante más de 14 días (con siguiente acción para no duplicar el escenario 3)
  await db.insert(schema.projects).values({
    id: uid(), title: `${QA_PREFIX} — Proyecto dormido`, status: "activo", nextAction: "QA retomar guion",
    createdAt: haceDias(20), updatedAt: haceDias(20),
  });

  revalidatePath("/", "layout");
}

export async function deleteAlertQaAction() {
  await requireAuth();
  if (!(await qaToolsEnabled())) throw new Error("Las herramientas QA no están disponibles en producción.");
  await db.delete(schema.cards).where(like(schema.cards.title, `${QA_PREFIX}%`));
  await db.delete(schema.projects).where(like(schema.projects.title, `${QA_PREFIX}%`));
  await db.delete(schema.inboxItems).where(like(schema.inboxItems.content, `${QA_PREFIX}%`));
  revalidatePath("/", "layout");
}

export async function alertQaCount(): Promise<number> {
  await requireAuth();
  if (!(await qaToolsEnabled())) return 0;
  const [c, p, i] = await Promise.all([
    db.select({ id: schema.cards.id }).from(schema.cards).where(like(schema.cards.title, `${QA_PREFIX}%`)),
    db.select({ id: schema.projects.id }).from(schema.projects).where(like(schema.projects.title, `${QA_PREFIX}%`)),
    db.select({ id: schema.inboxItems.id }).from(schema.inboxItems).where(like(schema.inboxItems.content, `${QA_PREFIX}%`)),
  ]);
  return c.length + p.length + i.length;
}
