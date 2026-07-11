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

test("datos de demostración: sembrar, contar y eliminar sin tocar lo real", async ({ page }) => {
  // sembrar datos de ejemplo en la base de prueba
  execSync("node scripts/seed.mjs", {
    cwd: path.join(__dirname, ".."),
    env: { ...process.env, DB_PATH: TEST_DB },
  });

  await login(page);
  await page.goto("/ajustes");
  await expect(page.getByText(/elementos de ejemplo/)).toBeVisible();

  // lo real creado en tests anteriores existe antes…
  await page.goto("/tareas");
  await expect(page.getByText("Tarea creada desde Tareas")).toBeVisible();

  // eliminar ejemplos con confirmación
  await page.goto("/ajustes");
  await page.getByTestId("delete-demo").click();
  await expect(page.getByText(/Se eliminarán/)).toBeVisible();
  await page.getByTestId("confirm-delete-demo").click();
  await expect(page.getByText(/eliminados/)).toBeVisible();

  // los ejemplos ya no están
  await page.goto("/proyectos?f=todos");
  await expect(page.getByText("Aprender Mafer OS")).toHaveCount(0);

  // …y lo real sigue intacto después
  await page.goto("/tareas");
  await expect(page.getByText("Tarea creada desde Tareas")).toBeVisible();
  await page.goto("/proyectos");
  await expect(page.getByText("Proyecto de prueba E2E")).toBeVisible();
});
