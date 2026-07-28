import { test, expect, type Page } from "@playwright/test";
import { execSync } from "child_process";
import path from "path";

const PASSWORD = "prueba-mafer-123";
const TEST_DB = path.join(__dirname, ".test-db", "mafer-test.db");

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("/");
}

test("datos de demostración: sembrar, contar, convertir en reales sin tocar lo real", async ({ page }) => {
  // sembrar datos de ejemplo en la base de prueba
  execSync("node scripts/seed.mjs", {
    cwd: path.join(__dirname, ".."),
    env: { ...process.env, DB_PATH: TEST_DB },
  });

  await login(page);
  await page.goto("/ajustes");
  await expect(page.getByText(/elementos de ejemplo/)).toBeVisible();

  // la acción destructiva "eliminar todos los ejemplos" ya no existe (Fase 2)
  await expect(page.getByTestId("delete-demo")).toHaveCount(0);
  await expect(page.getByTestId("confirm-delete-demo")).toHaveCount(0);

  // lo real creado en tests anteriores existe antes…
  await page.goto("/tareas?v=todas");
  await expect(page.getByText("Tarea creada desde Tareas")).toBeVisible();

  // convertir ejemplos en datos reales (la única acción que queda, no destructiva)
  await page.goto("/ajustes");
  await page.getByRole("button", { name: "Convertir en datos reales" }).click();
  await expect(page.getByText("Listo: los ejemplos ahora son datos tuyos (sin etiqueta).")).toBeVisible();

  // los ejemplos ya no llevan la etiqueta, pero siguen existiendo
  await page.goto("/proyectos?f=todos");
  await expect(page.getByText("Aprender Mafer OS")).toBeVisible();

  // …y lo real sigue intacto después
  await page.goto("/tareas?v=todas");
  await expect(page.getByText("Tarea creada desde Tareas")).toBeVisible();
  await page.goto("/proyectos");
  await expect(page.getByText("Proyecto de prueba E2E")).toBeVisible();
});
