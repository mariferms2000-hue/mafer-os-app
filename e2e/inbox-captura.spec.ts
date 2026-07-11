import { test, expect, type Page } from "@playwright/test";

const PASSWORD = "prueba-mafer-123";

test.describe.configure({ mode: "serial" });

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("/");
}

test("barra rápida: guardar con Enter y aparecer al principio", async ({ page }, testInfo) => {
  const texto = `Captura con Enter ${testInfo.retry}`;
  await login(page);
  await page.goto("/inbox");
  await page.getByTestId("quickbar-input").fill(texto);
  await page.keyboard.press("Enter");
  await expect(page.getByText("Guardado en Inbox")).toBeVisible();
  // aparece de inmediato y al principio de la lista
  await expect(page.getByTestId("inbox-item").first()).toContainText(texto);
  // el campo quedó limpio y con foco para seguir capturando
  await expect(page.getByTestId("quickbar-input")).toHaveValue("");
});

test("barra rápida: guardar con el botón", async ({ page }, testInfo) => {
  const texto = `Captura con botón ${testInfo.retry}`;
  await login(page);
  await page.goto("/inbox");
  await page.getByTestId("quickbar-input").fill(texto);
  await page.getByTestId("quickbar-save").click();
  await expect(page.getByText("Guardado en Inbox")).toBeVisible();
  await expect(page.getByTestId("inbox-item").first()).toContainText(texto);
});

test("barra rápida: no guarda capturas vacías", async ({ page }) => {
  await login(page);
  await page.goto("/inbox");
  const antes = await page.getByTestId("inbox-item").count();
  await page.getByTestId("quickbar-save").click();
  await page.waitForTimeout(600);
  await expect(page.getByTestId("inbox-item")).toHaveCount(antes);
  // tampoco con solo espacios
  await page.getByTestId("quickbar-input").fill("   ");
  await page.getByTestId("quickbar-save").click();
  await page.waitForTimeout(600);
  await expect(page.getByTestId("inbox-item")).toHaveCount(antes);
});

test("la captura persiste después de refrescar", async ({ page }, testInfo) => {
  const texto = `Captura persistente ${testInfo.retry}`;
  await login(page);
  await page.goto("/inbox");
  await page.getByTestId("quickbar-input").fill(texto);
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("inbox-item").first()).toContainText(texto);
  await page.reload();
  await expect(page.getByTestId("inbox-item").first()).toContainText(texto);
});

test("deshacer desde el toast elimina la captura", async ({ page }, testInfo) => {
  const texto = `Captura para deshacer ${testInfo.retry}`;
  await login(page);
  await page.goto("/inbox");
  await page.getByTestId("quickbar-input").fill(texto);
  await page.keyboard.press("Enter");
  await expect(page.getByText("Guardado en Inbox")).toBeVisible();
  await page.getByRole("button", { name: "Deshacer", exact: true }).click();
  await expect(page.getByTestId("inbox-item").filter({ hasText: texto })).toHaveCount(0, { timeout: 10_000 });
  await page.reload();
  await expect(page.getByTestId("inbox-item").filter({ hasText: texto })).toHaveCount(0);
});

test("botón «+ Nueva captura» abre el panel y guarda", async ({ page }, testInfo) => {
  const texto = `Captura desde panel ${testInfo.retry}`;
  await login(page);
  await page.goto("/inbox");
  await page.getByTestId("new-capture").click();
  await expect(page.getByTestId("new-capture-panel")).toBeVisible();
  await page.getByTestId("new-capture-content").fill(texto);
  await page.getByTestId("new-capture-save").click();
  await expect(page.getByTestId("new-capture-panel")).not.toBeVisible();
  await expect(page.getByTestId("inbox-item").first()).toContainText(texto);
});

test("FAB contextual: en Inbox abre Nueva captura directo; fuera abre el menú", async ({ page }, testInfo) => {
  const texto = `Captura vía FAB ${testInfo.retry}`;
  await login(page);
  // fuera del Inbox: menú de 6 acciones
  await page.getByTestId("capture-fab").click();
  await expect(page.getByTestId("fab-captura")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByTestId("fab-captura").click(); // cerrar vía selección también vale
  await page.getByRole("button", { name: "Cerrar" }).click();

  // dentro del Inbox: una sola pulsación → panel de captura
  await page.goto("/inbox");
  await page.getByTestId("capture-fab").click();
  await expect(page.getByTestId("new-capture-panel")).toBeVisible();
  await expect(page.getByTestId("fab-captura")).toHaveCount(0); // no hubo menú
  await page.getByTestId("new-capture-content").fill(texto);
  await page.getByTestId("new-capture-save").click();
  await expect(page.getByTestId("inbox-item").first()).toContainText(texto);
});
