import { test, expect, type Page } from "@playwright/test";

const PASSWORD = "prueba-mafer-123";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("/");
}

// scripts/seed.mjs sigue escribiendo en el SQLite local de la era pre-Supabase
// (ver docs/arquitectura.md) — no llega a la base de pruebas Postgres, así que
// este test queda deshabilitado hasta portar el seed a Postgres (seguimiento
// separado, fuera del alcance del aislamiento de testing).
test.skip("datos de demostración: sembrar, contar, convertir en reales sin tocar lo real", async ({ page }) => {
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
