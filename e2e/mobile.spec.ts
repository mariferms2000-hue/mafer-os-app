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
  await page.goto("/tareas?v=todas");
  // toque en el centro del cuerpo de la fila, como con el dedo
  const fila = page.getByTestId("task-open").filter({ hasText: "Tarea detalle editada" }).first();
  await fila.scrollIntoViewIfNeeded();
  const box = await fila.boundingBox();
  if (!box) throw new Error("No se pudo medir la fila");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByTestId("card-detail")).toBeVisible();
  expect(page.url()).toContain("abrir=");

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

test("móvil: Hoy responde en un vistazo — Haz esto ahora y antiolvido sin scroll horizontal", async ({ page }) => {
  await login(page);
  await expect(page.getByTestId("do-now")).toBeVisible();
  await expect(page.getByTestId("do-now-reasons")).toContainText("Porque");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
  const qa = path.join(__dirname, "..", "docs", "qa", "phase-3", "04-movil-hoy.png");
  fs.mkdirSync(path.dirname(qa), { recursive: true });
  await page.screenshot({ path: qa, fullPage: false });

  // tocar la recomendación abre su detalle
  await page.getByTestId("do-now-title").click();
  await expect(page.getByTestId("card-detail")).toBeVisible();
  await page.getByTestId("card-cancel").click();
});

test("móvil: Proyectos legible — tarjeta, siguiente acción y Retomar", async ({ page }) => {
  await login(page);
  await page.goto("/proyectos");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);

  await page.locator("ul.grid > li a").first().click();
  await page.waitForURL(/\/proyectos\/.+/);
  await expect(page.getByTestId("next-action-block")).toBeVisible();
  await page.goto(`${page.url().split("?")[0]}?retomar=1`);
  await expect(page.getByTestId("resume-panel")).toBeVisible();
  const qa = path.join(__dirname, "..", "docs", "qa", "phase-4b-projects", "07-proyecto-iphone.png");
  fs.mkdirSync(path.dirname(qa), { recursive: true });
  await page.screenshot({ path: qa, fullPage: false });
});

test("móvil: Tareas simple — vistas rápidas y Filtrar como bottom sheet", async ({ page }) => {
  await login(page);
  await page.goto("/tareas");
  await expect(page.getByTestId("view-ahora")).toHaveAttribute("aria-pressed", "true");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
  const qa = path.join(__dirname, "..", "docs", "qa", "phase-4a-tasks", "05-tareas-iphone.png");
  fs.mkdirSync(path.dirname(qa), { recursive: true });
  await page.screenshot({ path: qa, fullPage: false });

  // Filtrar abre como bottom sheet y se puede aplicar con el dedo
  await page.getByTestId("open-filters").click();
  await expect(page.getByTestId("filters-panel")).toBeVisible();
  await page.getByTestId("flt-en").selectOption("low");
  await page.getByTestId("apply-filters").click();
  await expect(page).toHaveURL(/en=low/);
  await expect(page.getByTestId("open-filters")).toContainText("Filtrar (1)");
  await page.getByTestId("clear-filters-inline").click();
  await expect(page).not.toHaveURL(/en=/);

  // cambiar de vista con el dedo
  await page.getByTestId("view-todas").click();
  await expect(page).toHaveURL(/v=todas/);
});

test("móvil: toast legible en modo oscuro y prioridad con feedback", async ({ page }) => {
  await login(page);
  await page.goto("/ajustes");
  await page.getByTestId("theme-dark").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.goto("/tareas?v=todas");
  await page.getByRole("button", { name: /^Completar «/ }).first().click();
  const toast = page.locator('[role="status"]').first();
  await expect(toast).toBeVisible();
  const css = await toast.evaluate((el) => {
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, fg: s.color };
  });
  expect(css.bg).toBe("rgb(34, 49, 34)");
  expect(css.fg).toBe("rgb(242, 236, 223)");
  await expect(toast.getByRole("button", { name: "Deshacer" })).toBeVisible();
  await toast.getByRole("button", { name: "Deshacer" }).click();
  await page.goto("/ajustes");
  await page.getByTestId("theme-light").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("móvil: crear con solo título y clasificar con chips al toque", async ({ page }, testInfo) => {
  const titulo = `Llamar farmacia móvil R${testInfo.retry}`;
  await login(page);
  await page.goto("/tareas?v=todas");
  await page.getByTestId("new-task").click();
  await page.getByTestId("new-task-title").fill(titulo);
  await page.getByTestId("new-task-save").click();

  // clasificación opcional con sugerencia («llamar» → 10–30, baja)
  await expect(page.getByTestId("classify-step")).toBeVisible();
  await expect(page.getByTestId("classify-suggestion")).toContainText("«llamar»");
  const qa = path.join(__dirname, "..", "docs", "qa", "phase-2", "04-movil-clasificacion.png");
  fs.mkdirSync(path.dirname(qa), { recursive: true });
  await page.screenshot({ path: qa, fullPage: false });

  // sin scroll horizontal y chips tocables
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await page.getByTestId("energy-medium").click(); // corrige la energía con el dedo
  await page.getByTestId("classify-confirm").click();
  await expect(page.getByText("Clasificación guardada ✓").first()).toBeVisible();

  await page.getByTestId("task-open").filter({ hasText: titulo }).first().click();
  await expect(page.getByTestId("dur-ten_to_30")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("energy-medium")).toHaveAttribute("aria-checked", "true");
  await page.getByTestId("card-cancel").click();
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
