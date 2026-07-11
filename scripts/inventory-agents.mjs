/**
 * Inventario real de agentes, comandos y skills desde el filesystem.
 * Uso: npm run inventory
 *
 * Escanea (solo lectura):
 *   ~/Desktop/MACA Medical Journey/.claude/{agents,commands,skills}
 *   ~/.claude/{agents,commands,skills}
 *
 * - Añade lo nuevo, actualiza ruta/fecha de lo existente.
 * - NO pisa los campos curados (propósito, cuándo usar…) de entradas ya descritas.
 * - Marca como "no-encontrado" lo que está en la base pero ya no existe en disco.
 * - No inventa nada: solo archivos reales.
 */
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { randomUUID } from "node:crypto";

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), "data", "mafer-os.db");
if (!fs.existsSync(DB_PATH)) {
  console.error("No existe la base de datos. Abre la app una vez primero.");
  process.exit(1);
}
const db = new Database(DB_PATH);
const now = () => new Date().toISOString();
const uid = () => randomUUID();

const HOME = os.homedir();
const ROOTS = [
  { base: path.join(HOME, "Desktop", "MACA Medical Journey", ".claude"), source: "MACA", scope: "maca" },
  { base: path.join(HOME, ".claude"), source: "Global (~/.claude)", scope: "global" },
];

function frontmatter(file) {
  try {
    const text = fs.readFileSync(file, "utf8");
    const m = text.match(/^---\n([\s\S]*?)\n---/);
    const fm = {};
    if (m) {
      for (const line of m[1].split("\n")) {
        const i = line.indexOf(":");
        if (i > 0) fm[line.slice(0, i).trim()] = line.slice(i + 1).trim();
      }
    }
    return { fm, firstLine: text.replace(/^---\n[\s\S]*?\n---/, "").trim().split("\n")[0] ?? "" };
  } catch {
    return { fm: {}, firstLine: "" };
  }
}

function mtime(file) {
  try {
    return fs.statSync(file).mtime.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

const found = []; // { name, kind, source, scope, purpose, command, sourcePath, fileModified }

for (const root of ROOTS) {
  const agentsDir = path.join(root.base, "agents");
  if (fs.existsSync(agentsDir)) {
    for (const f of fs.readdirSync(agentsDir).filter((f) => f.endsWith(".md"))) {
      const file = path.join(agentsDir, f);
      const { fm } = frontmatter(file);
      found.push({
        name: fm.name || f.replace(/\.md$/, ""),
        kind: "agente",
        source: root.source,
        scope: root.scope,
        purpose: fm.description || "",
        command: "",
        sourcePath: file.replace(HOME, "~"),
        fileModified: mtime(file),
      });
    }
  }
  const commandsDir = path.join(root.base, "commands");
  if (fs.existsSync(commandsDir)) {
    for (const f of fs.readdirSync(commandsDir).filter((f) => f.endsWith(".md"))) {
      const file = path.join(commandsDir, f);
      const name = f.replace(/\.md$/, "");
      const { firstLine } = frontmatter(file);
      found.push({
        name,
        kind: "comando",
        source: root.source,
        scope: root.scope,
        purpose: firstLine.slice(0, 240),
        command: `/${name}`,
        sourcePath: file.replace(HOME, "~"),
        fileModified: mtime(file),
      });
    }
  }
  const skillsDir = path.join(root.base, "skills");
  if (fs.existsSync(skillsDir)) {
    for (const d of fs.readdirSync(skillsDir)) {
      const skillFile = path.join(skillsDir, d, "SKILL.md");
      if (!fs.existsSync(skillFile)) continue;
      const { fm } = frontmatter(skillFile);
      found.push({
        name: fm.name || d,
        kind: "skill",
        source: root.source,
        scope: root.scope,
        purpose: fm.description || "",
        command: "",
        sourcePath: skillFile.replace(HOME, "~"),
        fileModified: mtime(skillFile),
      });
    }
  }
}

const existing = db.prepare("SELECT * FROM agents_skills").all();
const byKey = new Map(existing.map((r) => [`${r.kind}:${r.name}`, r]));
let added = 0, updated = 0, missing = 0;

const insert = db.prepare(`
  INSERT INTO agents_skills (id,name,kind,source,purpose,input,output,when_to_use,when_not_to_use,command,relationships,source_path,status,scope,file_modified)
  VALUES (@id,@name,@kind,@source,@purpose,'','','','',@command,'[]',@sourcePath,'activo',@scope,@fileModified)
`);
const touch = db.prepare(`
  UPDATE agents_skills SET source_path=@sourcePath, file_modified=@fileModified, scope=@scope, status='activo' WHERE id=@id
`);
const touchPurpose = db.prepare(`UPDATE agents_skills SET purpose=@purpose WHERE id=@id`);
const markMissing = db.prepare(`UPDATE agents_skills SET status='no-encontrado' WHERE id=?`);

const foundKeys = new Set();
for (const f of found) {
  const key = `${f.kind}:${f.name}`;
  foundKeys.add(key);
  const row = byKey.get(key);
  if (row) {
    touch.run({ id: row.id, sourcePath: f.sourcePath, fileModified: f.fileModified, scope: f.scope });
    if (!row.purpose && f.purpose) touchPurpose.run({ id: row.id, purpose: f.purpose });
    updated++;
  } else {
    insert.run({ id: uid(), ...f });
    added++;
  }
}

for (const row of existing) {
  if (!foundKeys.has(`${row.kind}:${row.name}`)) {
    markMissing.run(row.id);
    missing++;
  }
}

db.prepare("INSERT INTO settings (key,value,updated_at) VALUES ('agents_inventory_at',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at")
  .run(now(), now());

console.log(`Inventario completo: ${found.length} elementos en disco.`);
console.log(`  Nuevos: ${added} · Actualizados: ${updated} · No encontrados (marcados): ${missing}`);
for (const f of found) console.log(`  [${f.kind}] ${f.name} (${f.scope})`);
