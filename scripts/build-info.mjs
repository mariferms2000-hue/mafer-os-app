/* Genera src/generated/build-info.json antes de compilar o arrancar en dev.
   Ajustes lo muestra para poder comprobar de un vistazo qué versión está corriendo. */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function git(cmd) {
  try {
    return execSync(`git ${cmd}`, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}

const info = {
  commit: git("rev-parse --short HEAD") || "desconocido",
  dirty: git("status --porcelain").length > 0,
  builtAt: new Date().toISOString(),
};

const dir = path.join(process.cwd(), "src", "generated");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "build-info.json"), JSON.stringify(info, null, 2) + "\n");
console.log(`build-info: ${info.commit}${info.dirty ? " (con cambios sin commit)" : ""}`);
