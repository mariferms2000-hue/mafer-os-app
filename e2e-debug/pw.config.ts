import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: ".",
  timeout: 120000,
  use: { locale: "es-MX" },
  projects: [{ name: "webkit", use: { ...devices["Desktop Safari"] } }],
});
