import { defineConfig, devices } from "@playwright/test";
import path from "path";

const TEST_DB = path.join(__dirname, "e2e", ".test-db", "mafer-test.db");

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1, // una sola base de datos de prueba → serial
  retries: 1,
  timeout: 30_000,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3900",
    trace: "retain-on-failure",
    locale: "es-MX",
    permissions: ["clipboard-read", "clipboard-write"],
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
    },
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /mobile\.spec\.ts/,
    },
    {
      name: "iphone",
      use: { ...devices["iPhone 14"], browserName: "chromium" },
      testMatch: /mobile\.spec\.ts/,
      dependencies: ["desktop"],
    },
  ],
});
