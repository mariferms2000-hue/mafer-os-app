import { test, expect } from "@playwright/test";

/** Smoke test acotado del aislamiento de pruebas (PR #13): demuestra un ciclo
 *  completo de creación → modificación → eliminación contra mafer-os-testing,
 *  sin depender del flujo «convertir en tarea» (ver hallazgo separado sobre
 *  esa ruta específica). No usa datos reales: el texto es único por corrida. */

const PASSWORD = "prueba-mafer-123";

test("crear, modificar y eliminar una captura del Inbox contra la base de pruebas", async ({ page }) => {
  const marca = `smoke-aislamiento-${Date.now()}`;
  const original = `Captura ${marca}`;
  const modificada = `Captura ${marca} editada`;

  await page.goto("/login");
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  const confirm = page.getByLabel("Confirma tu contraseña");
  if (await confirm.isVisible()) {
    await confirm.fill(PASSWORD);
    await page.getByRole("button", { name: "Crear y entrar" }).click();
  } else {
    await page.getByRole("button", { name: "Entrar" }).click();
  }
  await page.waitForURL("/");

  // Crear
  await page.getByTestId("capture-fab").click();
  await page.getByTestId("fab-captura").click();
  await page.getByTestId("capture-input").fill(original);
  await page.getByTestId("capture-save").click();
  await expect(page.getByText("Capturado.")).toBeVisible();
  await page.getByRole("button", { name: "Cerrar" }).click();

  await page.goto("/inbox");
  const item = page.getByTestId("inbox-item").filter({ hasText: marca });
  await expect(item).toHaveCount(1);

  // Modificar (sin elegir destino: guarda cambios, no convierte — evita la
  // ruta «convertir en tarea» documentada aparte como hallazgo separado)
  await item.getByTestId("inbox-process").click();
  const panel = page.getByTestId("process-panel");
  await expect(panel).toBeVisible();
  await panel.locator("#pp-content").fill(modificada);
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(panel).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByTestId("inbox-item").filter({ hasText: modificada })).toHaveCount(1);

  // Eliminar (reset del dato creado)
  const itemModificado = page.getByTestId("inbox-item").filter({ hasText: modificada });
  await itemModificado.getByTestId("inbox-menu").click();
  await itemModificado.getByTestId("inbox-delete").click();
  await itemModificado.getByTestId("inbox-delete-confirm").click();
  await expect(page.getByTestId("inbox-item").filter({ hasText: marca })).toHaveCount(0);
});
