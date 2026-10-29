import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Pruebas de integración contra la base de pruebas (mafer_e2e), nunca la real:
// tests-db/setup.ts apunta DATABASE_URL a TEST_DATABASE_URL con la misma guardia
// que las E2E. Aparte de test:unit porque necesitan red y base. `npm run test:db`.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // fuera de Next, «server-only» lanzaría al importarse
      "server-only": fileURLToPath(new URL("./tests-db/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    include: ["tests-db/**/*.test.ts"],
    setupFiles: ["./tests-db/setup.ts"],
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 60_000,
  },
});
