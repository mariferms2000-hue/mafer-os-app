/**
 * Sincroniza Mafer OS → vault de Obsidian (exportación de solo escritura hacia el vault).
 * Uso: npm run sync:obsidian
 *
 * Escribe únicamente dentro de las carpetas gestionadas del vault
 * (01 - Proyectos, 02 - Decisiones, 03 - Learn Fast, 04 - Journal,
 *  06 - Agentes y Skills, 07 - Prompts, 08 - Recursos, 09 - Exportaciones).
 * Las notas que crees tú en otras carpetas nunca se tocan.
 */
import path from "node:path";
import fs from "node:fs";
import { openDb, dumpAll, toMarkdownFiles, writeFiles, SCHEMA_VERSION } from "./lib-export.mjs";

const VAULT = process.env.OBSIDIAN_VAULT_PATH ?? path.join(process.cwd(), "..", "mafer-os-vault");
if (!fs.existsSync(VAULT)) {
  console.error("No encuentro el vault en", VAULT);
  process.exit(1);
}

const db = openDb();
const dump = dumpAll(db);
const files = toMarkdownFiles(dump);

files["09 - Exportaciones/ultima-sincronizacion.md"] =
  `# Última sincronización\n\n- Fecha: ${dump.exportedAt}\n- Versión de esquema: ${SCHEMA_VERSION}\n\n` +
  Object.entries(dump.counts).map(([k, v]) => `- ${k}: ${v}`).join("\n") + "\n";

writeFiles(VAULT, files);
console.log(`Vault actualizado: ${VAULT}`);
console.log(`${Object.keys(files).length} notas escritas.`);
