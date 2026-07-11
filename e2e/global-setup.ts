import fs from "fs";
import path from "path";

/** Borra la base de datos de prueba para que cada corrida empiece limpia. */
export default function globalSetup() {
  const dir = path.join(__dirname, ".test-db");
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}
