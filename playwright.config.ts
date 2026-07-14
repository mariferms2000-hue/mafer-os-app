import { defineConfig, devices } from "@playwright/test";
import path from "path";

const TEST_DB = path.join(__dirname, "e2e", ".test-db", "mafer-test.db");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1, // una sola base de datos de prueba → serial
  retries: 1,
  timeout: 30_000,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3900",
    trace: "retain-on-failure",
    locale: "es-MX",
  },
  webServer: {
    command: "npm run start",
    url: "http://localhost:3900/login",
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      PORT: "3900",
      DB_PATH: TEST_DB,
      AUTH_SECRET: "secreto-solo-para-tests-0123456789abcdef",
      LOCAL_HTTP: "1",
      NODE_ENV: "production",
      MAFER_QA_TOOLS: "1", // habilita el panel QA de alertas en el entorno de pruebas (nunca en el lanzador real)
    },
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], permissions: ["clipboard-read", "clipboard-write"] },
      testIgnore: [/mobile\.spec\.ts/, /safari-board\.spec\.ts/, /z2-demo-data\.spec\.ts/],
    },
    {
      name: "safari",
      use: { ...devices["Desktop Safari"] },
      testMatch: /safari-board\.spec\.ts/,
      dependencies: ["desktop"],
    },
    {
      name: "iphone",
      use: { ...devices["iPhone 14"], browserName: "chromium" },
      testMatch: /mobile\.spec\.ts/,
      dependencies: ["safari"],
    },
    {
      // corre al final: siembra y borra los datos de ejemplo
      name: "demo-data",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /z2-demo-data\.spec\.ts/,
      dependencies: ["iphone"],
    },
  ],
});
