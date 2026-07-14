import { test, expect, type Page } from "@playwright/test";
import fs from "fs";
import path from "path";

const QA_DIR = path.join(__dirname, "..", "..", "project-management", "qa", "phase-1");
const PASSWORD = "prueba-mafer-123";

test.describe.configure({ mode: "serial" });

async function shot(page: Page, name: string) {
  fs.mkdirSync(QA_DIR, { recursive: true });
  await page.screenshot({ path: path.join(QA_DIR, `${name}.png`), fullPage: true });
}

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("/");
}

test("eliminar desde el menú del Inbox pide confirmación", async ({ page }, testInfo) => {
  const texto = `Captura a eliminar ${testInfo.retry}`;
  await login(page);
  await page.goto("/inbox");
  await page.getByTestId("quickbar-input").fill(texto);
  await page.keyboard.press("Enter");
  const item = page.getByTestId("inbox-item").filter({ hasText: texto });
  await expect(item).toHaveCount(1);

  // pulsar «Eliminar» NO borra todavía: aparece la confirmación
  await item.getByTestId("inbox-menu").click();
  await item.getByTestId("inbox-delete").click();
  await expect(item.getByTestId("inbox-delete-confirm")).toBeVisible();
  await expect(item).toHaveCount(1);
  await shot(page, "01-inbox-eliminar-confirmacion");

  // arrepentirse conserva la captura
  await item.getByRole("button", { name: "No", exact: true }).click();
  await expect(item.getByTestId("inbox-delete")).toBeVisible();
  await expect(item).toHaveCount(1);

  // confirmar sí elimina, y persiste tras recargar
  await item.getByTestId("inbox-delete").click();
  await item.getByTestId("inbox-delete-confirm").click();
  await expect(item).toHaveCount(0, { timeout: 10_000 });
  await page.reload();
  await expect(page.getByTestId("inbox-item").filter({ hasText: texto })).toHaveCount(0);
});

test("doble Enter durante el guardado no duplica la captura", async ({ page }, testInfo) => {
  const texto = `Captura única ${testInfo.retry}`;
  await login(page);
  await page.goto("/inbox");
  const input = page.getByTestId("quickbar-input");
  await input.fill(texto);
  await input.press("Enter");
  await input.press("Enter"); // segundo Enter mientras aún guarda
  await expect(page.getByText("Guardado en Inbox").first()).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("inbox-item").filter({ hasText: texto })).toHaveCount(1);
  await shot(page, "02-inbox-sin-duplicados");
});

test("mover entre listas conserva el orden de la lista origen", async ({ page }) => {
  await login(page);
  await page.goto("/proyectos");
  await page.getByTestId("new-project").first().click();
  await page.getByTestId("new-project-title").fill("Fase 1 — orden de listas");
  await page.getByTestId("new-project-save").click();
  await page.waitForURL(/\/proyectos\/.+/);

  for (const t of ["Tarjeta A", "Tarjeta B", "Tarjeta C"]) {
    await page.getByTestId("quickadd-backlog").click();
    await page.getByTestId("quickadd-input-backlog").fill(t);
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("column-backlog").getByText(t)).toBeVisible();
  }

  // arrastrar la del medio (B) a Próximo
  const card = page.getByTestId("column-backlog").getByText("Tarjeta B");
  const target = page.getByTestId("column-proximo");
  const from = await card.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error("No se pudieron medir los elementos");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 30, from.y, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + 120, { steps: 15 });
  await page.mouse.up();

  await expect(page.getByTestId("column-proximo").getByText("Tarjeta B")).toBeVisible({ timeout: 10_000 });

  // tras recargar: B está en Próximo y el origen mantiene A antes que C
  await page.reload();
  await expect(page.getByTestId("column-proximo").getByText("Tarjeta B")).toBeVisible();
  const backlogCards = page.getByTestId("column-backlog").locator('[data-testid^="card-"]');
  await expect(backlogCards).toHaveCount(2);
  await expect(backlogCards.nth(0)).toContainText("Tarjeta A");
  await expect(backlogCards.nth(1)).toContainText("Tarjeta C");
  await shot(page, "03-tablero-orden-origen");
});
