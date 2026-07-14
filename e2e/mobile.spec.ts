import { test, expect, type Page } from "@playwright/test";
import fs from "fs";
import path from "path";

const QA_DIR = path.join(__dirname, "..", "..", "project-management", "qa", "stabilization-round");
const PASSWORD = "prueba-mafer-123";

async function shot(page: Page, name: string) {
  fs.mkdirSync(QA_DIR, { recursive: true });
  await page.screenshot({ path: path.join(QA_DIR, `${name}.png`), fullPage: false });
}

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("/");
}

test("móvil: navegación inferior visible y sin scroll horizontal", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("navigation", { name: "Navegación principal" }).last()).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await shot(page, "10-movil-hoy");
});

test("móvil: captura rápida con pocos toques", async ({ page }) => {
  await login(page);
  await page.getByTestId("capture-fab").click();
  await page.getByTestId("fab-captura").click();
  await page.getByTestId("capture-input").fill("Captura desde el teléfono");
  await page.getByTestId("capture-save").click();
  await expect(page.getByText("Capturado.")).toBeVisible();
  await shot(page, "11-movil-captura");
});

test("móvil: tablero con scroll horizontal por listas", async ({ page }) => {
  await login(page);
  await page.goto("/proyectos");
  await page.getByText("Proyecto de prueba E2E").click();
  await page.waitForURL(/\/proyectos\/.+/);
  await expect(page.getByTestId("column-backlog")).toBeVisible();
  await shot(page, "12-movil-tablero");
  // el contenedor del tablero permite desplazarse a las demás listas
  const board = page.getByTestId("board");
  const canScroll = await board.evaluate((el) => el.scrollWidth > el.clientWidth);
  expect(canScroll).toBeTruthy();
});

test("móvil: calendario legible", async ({ page }) => {
  await login(page);
  await page.goto("/calendario?vista=agenda");
  await expect(page.getByText("Reunión de prueba")).toBeVisible();
  await shot(page, "13-movil-calendario");
});

test("móvil: abrir el detalle de una tarea, editar y guardar sin scroll horizontal", async ({ page }) => {
  await login(page);
  await page.goto("/tareas");
  await page.getByTestId("task-open").filter({ hasText: "Tarea detalle editada" }).first().click();
  await expect(page.getByTestId("card-detail")).toBeVisible();

  // sin scroll horizontal en el detalle
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
  const detailShot = path.join(__dirname, "..", "docs", "qa", "phase-1-task-detail", "04-detalle-movil.png");
  fs.mkdirSync(path.dirname(detailShot), { recursive: true });
  await page.screenshot({ path: detailShot, fullPage: false });

  await page.getByTestId("card-desc-input").fill("Editada desde el teléfono.");
  await page.getByTestId("card-save").click();
  await expect(page.getByText("Tarea actualizada ✓")).toBeVisible();
  await expect(page.getByTestId("card-detail")).toHaveCount(0);
});

test("móvil: nueva captura desde el Inbox en segundos", async ({ page }, testInfo) => {
  const texto = `Captura móvil ${testInfo.retry}`;
  await login(page);
  await page.goto("/inbox");
  await page.getByTestId("new-capture").click();
  await expect(page.getByTestId("new-capture-panel")).toBeVisible();
  await page.getByTestId("new-capture-content").fill(texto);
  await page.getByTestId("new-capture-save").click();
  await expect(page.getByTestId("new-capture-panel")).not.toBeVisible();
  await expect(page.getByTestId("inbox-item").first()).toContainText(texto);
  await shot(page, "14-movil-inbox-captura");
});
