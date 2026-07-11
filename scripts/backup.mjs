/**
 * Respaldo completo de Mafer OS → backups-and-exports/AAAA-MM-DD/
 * Uso: npm run backup
 */
import path from "node:path";
import fs from "node:fs";
import { openDb, dumpAll, toMarkdownFiles, writeFiles, SCHEMA_VERSION } from "./lib-export.mjs";

const BACKUPS = process.env.BACKUPS_PATH ?? path.join(process.cwd(), "..", "backups-and-exports");
const db = openDb();
const dump = dumpAll(db);
const d = new Date();
const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dir = path.join(BACKUPS, date);
fs.mkdirSync(dir, { recursive: true });

// 1) JSON completo
fs.writeFileSync(path.join(dir, "full-backup.json"), JSON.stringify(dump, null, 2));

// 2) Markdown por entidad
const files = toMarkdownFiles(dump);
const remap = {
  "01 - Proyectos": "projects",
  "02 - Decisiones": "decisions",
  "03 - Learn Fast": "learn-fast",
  "04 - Journal": "journal",
  "06 - Agentes y Skills": "agents-skills",
  "07 - Prompts": "prompts",
  "08 - Recursos": "resources",
};
const remapped = {};
for (const [rel, content] of Object.entries(files)) {
  const [top, ...rest] = rel.split("/");
  remapped[[remap[top] ?? top, ...rest].join("/")] = content;
}
writeFiles(dir, remapped);

// 3) Copia consistente de la base SQLite (API de backup: incluye lo pendiente en WAL)
await db.backup(path.join(dir, "mafer-os.db"));

// 4) Manifiesto
const manifest = `# Respaldo de Mafer OS — ${date}

- Fecha de exportación: ${dump.exportedAt}
- Versión de esquema: ${SCHEMA_VERSION}

## Conteos

${Object.entries(dump.counts).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

## Cómo restaurar

1. **Restauración completa (recomendada):** cierra la app y copia \`mafer-os.db\` de esta carpeta
   a \`mafer-os-app/data/mafer-os.db\` (reemplaza el archivo). Vuelve a abrir la app.
2. **Consulta puntual:** los archivos .md y \`full-backup.json\` son legibles directamente;
   puedes copiar de ahí cualquier texto que necesites.

## Advertencias

- Este respaldo NO incluye tus credenciales (.env.local) — guárdalas aparte si cambias de Mac.
`;
fs.writeFileSync(path.join(dir, "manifest.md"), manifest);

console.log(`Respaldo completo en: ${dir}`);
console.log(Object.entries(dump.counts).map(([k, v]) => `  ${k}: ${v}`).join("\n"));
