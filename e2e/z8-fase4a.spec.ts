import { test, expect, type Page, type TestInfo } from "@playwright/test";
import fs from "fs";
import path from "path";

const QA_DIR = path.join(__dirname, "..", "docs", "qa", "phase-4a-tasks");
const PASSWORD = "prueba-mafer-123";

test.describe.configure({ mode: "serial" });

const t = (info: TestInfo, name: string) => `${name} Z8R${info.retry}`;

async function shot(page: Page, name: string, locator?: ReturnType<Page["getByTestId"]>) {
  fs.mkdirSync(QA_DIR, { recursive: true });
  if (locator) await locator.screenshot({ path: path.join(QA_DIR, `${name}.png`) });
  else await page.screenshot({ path: path.join(QA_DIR, `${name}.png`), fullPage: false });
}

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("/");
}

async function crear(page: Page, titulo: string, opts?: { date?: string; dur?: string; energy?: string }) {
  await page.goto("/tareas?v=todas");
  await page.getByTestId("new-task").click();
  await page.getByTestId("new-task-title").fill(titulo);
  if (opts?.date) {
    await page.getByTestId("new-task-more").click();
    await page.getByLabel("Fecha (opcional)").fill(opts.date);
  }
  await page.getByTestId("new-task-save").click();
  await expect(page.getByTestId("classify-step")).toBeVisible();
  if (opts?.dur || opts?.energy) {
    if (opts.dur) await page.getByTestId(opts.dur).click();
    if (opts.energy) await page.getByTestId(opts.energy).click();
    await page.getByTestId("classify-confirm").click();
    await expect(page.getByText("Clasificación guardada ✓").first()).toBeVisible();
  } else {
    await page.getByTestId("classify-skip").click();
  }
  await expect(page.getByTestId("task-groups").getByText(titulo, { exact: true })).toBeVisible();
}

test("«Haz ahora» es la vista inicial: una sola lista sin bosque de chips", async ({ page }) => {
  await login(page);
  await page.goto("/tareas");
  // vista por defecto
  await expect(page.getByTestId("view-ahora")).toHaveAttribute("aria-pressed", "true");
  // encabezado simple: buscador + Filtrar + Agrupar + Nueva tarea
  await expect(page.getByPlaceholder("Buscar tareas…")).toBeVisible();
  await expect(page.getByTestId("open-filters")).toContainText("Filtrar");
  await expect(page.getByTestId("open-group")).toContainText("Agrupar");
  await expect(page.getByTestId("new-task")).toBeVisible();
  // una sola lista ordenada, sin grandes contenedores por proyecto
  await expect(page.getByTestId("task-groups").locator("section")).toHaveCount(0);
  // sin resumen de filtros (no hay filtros activos)
  await expect(page.getByTestId("filters-summary")).toHaveCount(0);
  await shot(page, "01-haz-ahora");
});

test("las cinco vistas responden y muestran lo suyo", async ({ page }, info) => {
  const esperando = t(info, "Esperando refacción");
  const corta = t(info, "Cortita");
  const deHoy = t(info, "Cita de hoy");
  const hoy = new Date().toLocaleDateString("en-CA");
  await login(page);
  await crear(page, esperando);
  await page.getByTestId("task-open").filter({ hasText: esperando }).first().click();
  await page.getByLabel("Esperando a…").fill("proveedor z8");
  await page.getByTestId("card-save").click();
  await expect(page.getByText("Tarea actualizada ✓").first()).toBeVisible();
  await crear(page, corta, { dur: "dur-under_10", energy: "energy-low" });
  await crear(page, deHoy, { date: hoy });

  await page.goto("/tareas");
  await page.getByTestId("view-hoy").click();
  await expect(page).toHaveURL(/v=hoy/);
  await expect(page.getByTestId("task-groups").getByText(deHoy, { exact: true })).toBeVisible();

  await page.getByTestId("view-rapidas").click();
  await expect(page).toHaveURL(/v=rapidas/);
  await expect(page.getByTestId("task-groups").getByText(corta, { exact: true })).toBeVisible();
  await expect(page.getByTestId("task-groups").getByText(esperando, { exact: true })).toHaveCount(0);

  await page.getByTestId("view-esperando").click();
  await expect(page).toHaveURL(/v=esperando/);
  await expect(page.getByTestId("task-groups").getByText(esperando, { exact: true })).toBeVisible();

  await page.getByTestId("view-todas").click();
  await expect(page).toHaveURL(/v=todas/);
  for (const titulo of [esperando, corta, deHoy]) {
    await expect(page.getByTestId("task-groups").getByText(titulo, { exact: true })).toBeVisible();
  }

  await page.getByTestId("view-ahora").click();
  await expect(page).not.toHaveURL(/v=/);
});

test("Filtrar: abrir, cancelar, aplicar, combinar, contador y resumen compacto", async ({ page }, info) => {
  const ligera = t(info, "Cortita"); // under_10 + low
  await login(page);
  await page.goto("/tareas?v=todas");

  // abrir y cancelar no cambia nada
  await page.getByTestId("open-filters").click();
  await expect(page.getByTestId("filters-panel")).toBeVisible();
  await shot(page, "02-panel-filtrar");
  await page.getByTestId("cancel-filters").click();
  await expect(page.getByTestId("filters-panel")).toHaveCount(0);
  await expect(page).not.toHaveURL(/en=/);

  // aplicar un filtro
  await page.getByTestId("open-filters").click();
  await page.getByTestId("flt-en").selectOption("low");
  await page.getByTestId("apply-filters").click();
  await expect(page).toHaveURL(/en=low/);
  await expect(page.getByTestId("open-filters")).toContainText("Filtrar (1)");
  await expect(page.getByTestId("task-groups").getByText(ligera, { exact: true })).toBeVisible();

  // combinar un segundo filtro
  await page.getByTestId("open-filters").click();
  await page.getByTestId("flt-dur").selectOption("under_10");
  await page.getByTestId("apply-filters").click();
  await expect(page).toHaveURL(/dur=under_10/);
  await expect(page.getByTestId("open-filters")).toContainText("Filtrar (2)");
  const resumen = page.getByTestId("filters-summary");
  await expect(resumen).toContainText("Menos de 10 min");
  await expect(resumen).toContainText("Energía baja");
  await shot(page, "03-resumen-filtros");

  // limpiar desde el resumen
  await page.getByTestId("clear-filters-inline").click();
  await expect(page).not.toHaveURL(/en=|dur=/);
  await expect(page.getByTestId("open-filters")).toContainText(/Filtrar$/);
  await expect(page.getByTestId("filters-summary")).toHaveCount(0);
});

test("Agrupar: una sola agrupación activa y el botón refleja la elección", async ({ page }) => {
  await login(page);
  await page.goto("/tareas?v=todas");

  await page.getByTestId("open-group").click();
  await shot(page, "04-menu-agrupar");
  await page.getByTestId("group-proyecto").click();
  await expect(page).toHaveURL(/agrupar=proyecto/);
  await expect(page.getByTestId("open-group")).toContainText("Por proyecto");
  await expect(page.getByTestId("task-groups").locator("section").first()).toBeVisible();

  for (const g of ["estado", "fecha", "duracion", "prioridad", "energia"]) {
    await page.getByTestId("open-group").click();
    await page.getByTestId(`group-${g}`).click();
    await expect(page).toHaveURL(new RegExp(`agrupar=${g}`));
  }

  await page.getByTestId("open-group").click();
  await page.getByTestId("group-ninguno").click();
  await expect(page).not.toHaveURL(/agrupar=/);
  await expect(page.getByTestId("open-group")).toContainText(/Agrupar/);
  await expect(page.getByTestId("task-groups").locator("section")).toHaveCount(0);
});

test("búsqueda + filtros + agrupación persisten al abrir una tarea, volver y refrescar", async ({ page }, info) => {
  const ligera = t(info, "Cortita");
  await login(page);
  await page.goto("/tareas?v=todas");

  await page.getByPlaceholder("Buscar tareas…").fill("Cortita");
  await page.getByPlaceholder("Buscar tareas…").press("Enter");
  await expect(page).toHaveURL(/q=Cortita/);
  await page.getByTestId("open-filters").click();
  await page.getByTestId("flt-en").selectOption("low");
  await page.getByTestId("apply-filters").click();
  await page.getByTestId("open-group").click();
  await page.getByTestId("group-proyecto").click();

  await expect(page.getByTestId("task-groups").getByText(ligera, { exact: true })).toBeVisible();

  // abrir la tarea y volver: todo el estado sigue en la URL
  await page.getByTestId("task-open").filter({ hasText: ligera }).first().click();
  await expect(page.getByTestId("card-detail")).toBeVisible();
  expect(page.url()).toContain("abrir=");
  expect(page.url()).toContain("q=Cortita");
  expect(page.url()).toContain("en=low");
  expect(page.url()).toContain("agrupar=proyecto");
  await page.getByTestId("card-cancel").click();
  expect(page.url()).not.toContain("abrir=");
  expect(page.url()).toContain("q=Cortita");

  // refrescar conserva vista, búsqueda, filtros y agrupación
  await page.reload();
  await expect(page.getByTestId("view-todas")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("open-filters")).toContainText("Filtrar (1)");
  await expect(page.getByTestId("open-group")).toContainText("Por proyecto");
  await expect(page.getByPlaceholder("Buscar tareas…")).toHaveValue("Cortita");
  await expect(page.getByTestId("task-groups").getByText(ligera, { exact: true })).toBeVisible();
});

test("Más vistas: terminadas discreta y favoritas junto a las principales", async ({ page }) => {
  await login(page);
  await page.goto("/tareas");

  // Terminadas vive dentro de Más vistas, no como vista principal permanente
  await expect(page.getByTestId("view-terminadas")).toHaveCount(0);
  await page.getByTestId("more-views").click();
  await page.getByTestId("moreview-terminadas").click();
  await expect(page).toHaveURL(/v=terminadas/);

  // marcar una favorita → aparece junto a las cinco principales
  await page.getByTestId("more-views").click();
  await page.getByTestId("fav-bloqueadas").click();
  await page.getByTestId("moreview-bloqueadas").click();
  await expect(page).toHaveURL(/v=bloqueadas/);
  await page.reload();
  await expect(page.getByTestId("view-bloqueadas")).toBeVisible(); // favorita persistida
  // quitarla para dejar el entorno limpio
  await page.getByTestId("more-views").click();
  await page.getByTestId("fav-bloqueadas").click();
});

test("modo oscuro: la página Tareas mantiene contraste", async ({ page }) => {
  await login(page);
  await page.goto("/ajustes");
  await page.getByTestId("theme-dark").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.goto("/tareas");
  await expect(page.getByTestId("view-ahora")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("open-filters").click();
  await expect(page.getByTestId("filters-panel")).toBeVisible();
  await shot(page, "06-tareas-oscuro");
  await page.getByTestId("cancel-filters").click();
  await page.goto("/ajustes");
  await page.getByTestId("theme-light").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
