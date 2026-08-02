import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Mismo alias que tsconfig.json ("@/*" → "./src/*"): las pruebas que simulan
  // un módulo con `vi.mock("@/lib/…")` necesitan resolver el especificador
  // exactamente igual que lo hace el código de la app.
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["tests/**/*.test.{ts,mjs}"],
  },
});
