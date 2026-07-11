/** Configuración inicial: crea .env.local con un secreto aleatorio si no existe. */
import fs from "node:fs";
import crypto from "node:crypto";

if (fs.existsSync(".env.local")) {
  console.log(".env.local ya existe — nada que hacer.");
} else {
  const secret = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(".env.local", `AUTH_SECRET=${secret}\nLOCAL_HTTP=1\n`);
  console.log(".env.local creado con un secreto nuevo ✅");
}
