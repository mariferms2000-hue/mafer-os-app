import { test, expect, type Page, type TestInfo } from "@playwright/test";
import fs from "fs";
import path from "path";

const QA_DIR = path.join(__dirname, "..", "docs", "qa", "phase-3-fixes");
const PASSWORD = "prueba-mafer-123";

test.describe.configure({ mode: "serial" });

const t = (info: TestInfo, name: string) => `${name} FIXR${info.retry}`;

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

async function crearTarea(page: Page, titulo: string) {
  await page.goto("/tareas?v=todas");
  await page.getByTestId("new-task").click();
  await page.getByTestId("new-task-title").fill(titulo);
  await page.getByTestId("new-task-save").click();
  await expect(page.getByTestId("classify-step")).toBeVisible();
  await page.getByTestId("classify-skip").click();
  await expect(page.getByTestId("task-groups").getByText(titulo, { exact: true })).toBeVisible();
}

async function limpiarPrioridades(page: Page) {
  await page.goto("/");
  const quitar = page.getByRole("button", { name: /^Quitar «/ });
  for (let n = await quitar.count(); n > 0; n--) {
    await quitar.first().click();
    await expect(quitar).toHaveCount(n - 1);
  }
}

test("elegir prioridad desde Hoy: feedback, visible al instante y persiste", async ({ page }, info) => {
  const titulo = t(info, "Prioridad desde Hoy");
  await login(page);
  await crearTarea(page, titulo);
  await limpiarPrioridades(page);

  await page.getByTestId("pick-priority").click();
  await page.getByTestId("priority-candidates").getByText(titulo, { exact: true }).click();
  await expect(page.getByText("Añadida a tus prioridades de hoy ✓").first()).toBeVisible();
  await expect(page.locator("ol").getByText(titulo, { exact: true })).toBeVisible();
  await shot(page, "01-prioridad-asignada");

  await page.reload();
  await expect(page.locator("ol").getByText(titulo, { exact: true })).toBeVisible();
});

test("marcar desde el detalle: añadida, y duplicado avisa «Ya está»", async ({ page }, info) => {
  const titulo = t(info, "Prioridad desde detalle");
  await login(page);
  await crearTarea(page, titulo);
  await page.getByTestId("task-open").filter({ hasText: titulo }).first().click();
  await page.getByTestId("mark-priority").click();
  await expect(page.getByText("Añadida a tus prioridades de hoy ✓").first()).toBeVisible();
  // segundo intento: sin duplicar, con aviso claro
  await page.getByTestId("mark-priority").click();
  await expect(page.getByText("Ya está en tus prioridades de hoy.").first()).toBeVisible();
  await page.getByTestId("card-cancel").click();
  // no hay duplicados en Hoy
  await page.goto("/");
  await expect(page.locator("ol").getByText(titulo, { exact: true })).toHaveCount(1);
});

test("tres espacios llenos: selector de reemplazo, nunca en silencio", async ({ page }, info) => {
  const tercera = t(info, "Tercera prioridad");
  const cuarta = t(info, "Cuarta que pide espacio");
  await login(page);
  await crearTarea(page, tercera);
  await crearTarea(page, cuarta);

  // llenar el tercer espacio (los otros dos vienen de las pruebas anteriores)
  await page.goto("/");
  await page.getByTestId("pick-priority").click();
  await page.getByTestId("priority-candidates").getByText(tercera, { exact: true }).click();
  await expect(page.getByText("Añadida a tus prioridades de hoy ✓").first()).toBeVisible();

  // la cuarta desde su detalle → los tres están llenos → selector
  await page.goto("/tareas?v=todas");
  await page.getByTestId("task-open").filter({ hasText: cuarta }).first().click();
  await page.getByTestId("mark-priority").click();
  const dialog = page.getByTestId("priority-replace-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(tercera)).toBeVisible();
  await shot(page, "02-selector-reemplazo");

  await dialog.getByText(tercera).click();
  await expect(page.getByText(/Prioridad reemplazada/).first()).toBeVisible();
  await page.getByTestId("card-cancel").click();
  await page.goto("/");
  await expect(page.locator("ol").getByText(cuarta, { exact: true })).toBeVisible();
  await expect(page.locator("ol").getByText(tercera, { exact: true })).toHaveCount(0);

  // Deshacer del reemplazo restaura la anterior — lo probamos con el flujo inverso explícito
  await page.goto("/tareas?v=todas");
  await page.getByTestId("task-open").filter({ hasText: tercera }).first().click();
  await page.getByTestId("mark-priority").click();
  await expect(page.getByTestId("priority-replace-dialog")).toBeVisible();
  await page.getByTestId("priority-replace-dialog").getByText(cuarta).click();
  await expect(page.getByText(/Prioridad reemplazada/).first()).toBeVisible();
  await page.getByRole("button", { name: "Deshacer" }).first().click();
  await page.getByTestId("card-cancel").click();
  await page.goto("/");
  await expect(page.locator("ol").getByText(cuarta, { exact: true })).toBeVisible();
});

test("completar una prioridad libera su espacio y ofrece reemplazo; Deshacer la restaura completa", async ({ page }, info) => {
  const titulo = t(info, "Prioridad desde Hoy"); // sigue siendo prioridad
  await login(page);
  await page.goto("/");
  await page.getByRole("button", { name: `Completar «${titulo}»` }).first().click();
  await expect(page.getByText("Prioridad completada ✓ — su espacio quedó libre").first()).toBeVisible();
  // el espacio quedó libre (no se eligió otra automáticamente)
  await expect(page.locator("ol").getByText(titulo, { exact: true })).toHaveCount(0);
  // ofrece elegir reemplazo
  await expect(page.getByRole("button", { name: "Elegir reemplazo" })).toBeVisible();

  // Deshacer: la tarea se reabre Y recupera su espacio de prioridad
  await page.getByRole("button", { name: "Deshacer" }).first().click();
  await expect(page.locator("ol").getByText(titulo, { exact: true })).toBeVisible({ timeout: 10_000 });
  await page.reload();
  await expect(page.locator("ol").getByText(titulo, { exact: true })).toBeVisible();
});

test("marcar como prioridad desde «Haz esto ahora» y abrir la tarea desde la prioridad", async ({ page }) => {
  await login(page);
  await limpiarPrioridades(page);
  await page.goto("/");
  // desde la recomendación
  const recomendada = (await page.getByTestId("do-now-title").textContent()) ?? "";
  await page.getByTestId("do-now").getByTestId("mark-priority").click();
  await expect(page.getByText(/Añadida a tus prioridades|Ya está en tus prioridades/).first()).toBeVisible();
  await expect(page.locator("ol").getByText(recomendada.trim(), { exact: true })).toBeVisible();

  // abrir la tarea desde la prioridad
  await page.getByTestId("priority-open").first().click();
  await expect(page.getByTestId("card-detail")).toBeVisible();
  await page.getByTestId("card-cancel").click();
});

test("toasts legibles en modo oscuro (éxito e información) y en claro", async ({ page }, testInfo) => {
  const titulo = t(testInfo, "Toast oscuro");
  await login(page);
  await crearTarea(page, titulo);

  // modo oscuro
  await page.goto("/ajustes");
  await page.getByTestId("theme-dark").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.goto("/tareas?v=todas");
  await page.getByRole("button", { name: `Completar «${titulo}»` }).first().click();
  const toastOscuro = page.locator('[role="status"]').first();
  await expect(toastOscuro).toBeVisible();
  const css = await toastOscuro.evaluate((el) => {
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, fg: s.color };
  });
  expect(css.bg).toBe("rgb(34, 49, 34)"); // superficie verde bosque elevada, nada de crema
  expect(css.fg).toBe("rgb(242, 236, 223)"); // texto crema legible
  expect(css.bg).not.toBe(css.fg);
  await expect(toastOscuro.getByRole("button", { name: "Deshacer" })).toBeVisible();
  await shot(page, "03-toast-oscuro");
  await toastOscuro.getByRole("button", { name: "Deshacer" }).click();

  // tono info también legible en oscuro (duplicado de prioridad)
  await page.goto("/");
  await page.getByTestId("do-now").getByTestId("mark-priority").click();
  await page.getByTestId("do-now").getByTestId("mark-priority").click();
  const info2 = page.locator('[role="status"][data-tone="info"]').first();
  await expect(info2).toBeVisible();

  // volver a claro: el toast sigue siendo el oscuro de siempre (contraste correcto)
  await page.goto("/ajustes");
  await page.getByTestId("theme-light").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.goto("/tareas?v=todas");
  await page.getByRole("button", { name: `Completar «${titulo}»` }).first().click();
  const toastClaro = page.locator('[role="status"]').first();
  const cssClaro = await toastClaro.evaluate((el) => {
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, fg: s.color };
  });
  expect(cssClaro.bg).toBe("rgb(46, 43, 37)");
  expect(cssClaro.fg).toBe("rgb(250, 247, 241)");
  await toastClaro.getByRole("button", { name: "Deshacer" }).click();
});

test("panel QA de alertas: los seis escenarios, orden, máximo cinco y limpieza total", async ({ page }) => {
  await login(page);
  await page.goto("/ajustes");
  const panel = page.getByTestId("alert-qa-panel");
  await expect(panel).toBeVisible();
  await shot(page, "04-panel-qa", panel);

  await page.getByTestId("qa-seed-alerts").click();
  await expect(page.getByText("Escenarios QA creados ✓ — revísalos en Hoy.").first()).toBeVisible();

  await page.goto("/");
  const alerts = page.getByTestId("forget-alerts");
  await expect(alerts).toBeVisible();
  // máximo cinco, y la vencida (lo más urgente) va primero
  await expect(alerts.locator("li")).toHaveCount(5);
  await expect(alerts.locator("li").first()).toContainText("QA ALERTA — Tarea vencida");
  await expect(page.getByTestId("alert-esperando-mucho").first()).toContainText("QA ALERTA — Esperando respuesta");
  await expect(page.getByTestId("alert-proyecto-inactivo").first()).toContainText("QA ALERTA — Proyecto dormido");
  await shot(page, "05-alertas-simuladas", alerts);

  // la alerta abre el elemento correcto
  await page.getByTestId("alert-tarea-vencida").click();
  await expect(page.getByTestId("card-detail")).toBeVisible();
  await expect(page.getByTestId("card-title-input")).toHaveValue("QA ALERTA — Tarea vencida");
  await page.getByTestId("card-cancel").click();

  // limpieza total de datos QA
  await page.goto("/ajustes");
  await page.getByTestId("qa-delete-alerts").click();
  await expect(page.getByText("Datos QA eliminados. Tus datos reales quedaron intactos.").first()).toBeVisible();
  await page.goto("/");
  await expect(page.getByText("QA ALERTA")).toHaveCount(0);
  await page.goto("/tareas?v=todas");
  await expect(page.getByTestId("task-groups").getByText(/QA ALERTA/)).toHaveCount(0);
});
