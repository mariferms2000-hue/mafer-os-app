import { test, expect, type Page, type TestInfo } from "@playwright/test";
import fs from "fs";
import path from "path";
import { PASSWORD } from "./lib/credentials";

const QA_DIR = path.join(__dirname, "..", "docs", "qa", "phase-3-fixes");

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

/* Bloque 2: «Prioridad de hoy» pasa a «Destacar hoy». Sin espacios vacíos en
 * Hoy: el bloque «Destacadas hoy» solo aparece si hay alguna. Se conservan el
 * máximo de tres, el selector de sustitución y Deshacer. */

async function destacarDesdeDetalle(page: Page, titulo: string) {
  await page.goto("/tareas?v=todas");
  await page.getByTestId("task-open").filter({ hasText: titulo }).first().click();
  await page.getByTestId("mark-priority").click();
}

test("destacar desde el detalle: feedback, visible en Hoy al instante y persiste", async ({ page }, info) => {
  const titulo = t(info, "Prioridad desde Hoy");
  await login(page);
  await crearTarea(page, titulo);
  await limpiarPrioridades(page);
  await expect(page.getByTestId("highlights")).toHaveCount(0); // sin espacios vacíos

  await destacarDesdeDetalle(page, titulo);
  await expect(page.getByText("Destacada para hoy ✓").first()).toBeVisible();
  await page.getByTestId("card-cancel").click();
  await page.goto("/");
  await expect(page.getByTestId("highlights").getByText(titulo, { exact: true })).toBeVisible();
  await shot(page, "01-prioridad-asignada", page.getByTestId("highlights"));

  await page.reload();
  await expect(page.getByTestId("highlights").getByText(titulo, { exact: true })).toBeVisible();
});

test("destacar dos veces la misma: avisa «Ya está» y no duplica", async ({ page }, info) => {
  const titulo = t(info, "Prioridad desde detalle");
  await login(page);
  await crearTarea(page, titulo);
  await destacarDesdeDetalle(page, titulo);
  await expect(page.getByText("Destacada para hoy ✓").first()).toBeVisible();
  // segundo intento: sin duplicar, con aviso claro
  await page.getByTestId("mark-priority").click();
  await expect(page.getByText("Ya está destacada hoy.").first()).toBeVisible();
  await page.getByTestId("card-cancel").click();
  await page.goto("/");
  await expect(page.getByTestId("highlights").getByText(titulo, { exact: true })).toHaveCount(1);
});

test("con tres destacadas: selector de sustitución, nunca en silencio", async ({ page }, info) => {
  const tercera = t(info, "Tercera prioridad");
  const cuarta = t(info, "Cuarta que pide espacio");
  await login(page);
  await crearTarea(page, tercera);
  await crearTarea(page, cuarta);

  // la tercera (las otras dos vienen de las pruebas anteriores)
  await destacarDesdeDetalle(page, tercera);
  await expect(page.getByText("Destacada para hoy ✓").first()).toBeVisible();
  await page.getByTestId("card-cancel").click();

  // la cuarta → ya hay tres → selector
  await destacarDesdeDetalle(page, cuarta);
  const dialog = page.getByTestId("priority-replace-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Ya tienes 3 destacadas hoy")).toBeVisible();
  await expect(dialog.getByText(tercera)).toBeVisible();
  await shot(page, "02-selector-reemplazo");

  await dialog.getByText(tercera).click();
  await expect(page.getByText(/Destacada en lugar de/).first()).toBeVisible();
  await page.getByTestId("card-cancel").click();
  await page.goto("/");
  const destacadas = page.getByTestId("highlights");
  await expect(destacadas.getByText(cuarta, { exact: true })).toBeVisible();
  await expect(destacadas.getByText(tercera, { exact: true })).toHaveCount(0);

  // Deshacer la sustitución restaura la anterior
  await destacarDesdeDetalle(page, tercera);
  await expect(page.getByTestId("priority-replace-dialog")).toBeVisible();
  await page.getByTestId("priority-replace-dialog").getByText(cuarta).click();
  await expect(page.getByText(/Destacada en lugar de/).first()).toBeVisible();
  await page.getByRole("button", { name: "Deshacer" }).first().click();
  await page.getByTestId("card-cancel").click();
  await page.goto("/");
  await expect(page.getByTestId("highlights").getByText(cuarta, { exact: true })).toBeVisible();
});

test("completar una destacada la saca del bloque; Deshacer la reabre y la vuelve a destacar", async ({ page }, info) => {
  const titulo = t(info, "Prioridad desde Hoy"); // sigue destacada
  await login(page);
  await page.goto("/");
  const destacadas = page.getByTestId("highlights");
  await destacadas.getByRole("button", { name: `Completar «${titulo}»` }).first().click();
  await expect(page.getByText("Tarea completada ✓").first()).toBeVisible();

  await page.getByRole("button", { name: "Deshacer" }).first().click();
  // esperar a que la acción llegue al servidor: recargar en el mismo instante la cortaba
  await page.waitForLoadState("networkidle");
  await page.reload();
  await expect(page.getByTestId("highlights").getByText(titulo, { exact: true })).toBeVisible();
  await expect(
    page.getByTestId("highlights").getByRole("button", { name: `Completar «${titulo}»` })
  ).toBeVisible(); // abierta otra vez
});

test("destacar desde «Haz esto ahora», quitar desde Hoy y abrir la tarea desde Destacadas", async ({ page }) => {
  await login(page);
  await limpiarPrioridades(page);
  await page.goto("/");
  const recomendada = ((await page.getByTestId("do-now-title").textContent()) ?? "").trim();
  await page.getByTestId("do-now").getByTestId("mark-priority").click();
  await expect(page.getByText(/Destacada para hoy|Ya está destacada/).first()).toBeVisible();
  const destacadas = page.getByTestId("highlights");
  await expect(destacadas.getByText(recomendada, { exact: true })).toBeVisible();

  // abrir la tarea desde Destacadas
  await destacadas.getByTestId("task-open").first().click();
  await expect(page.getByTestId("card-detail")).toBeVisible();
  await page.getByTestId("card-cancel").click();

  // quitarla: el bloque desaparece si no queda ninguna
  await destacadas.getByTestId("highlight-remove").first().click();
  await expect(page.getByText("Ya no está destacada (la tarea sigue en Tareas).").first()).toBeVisible();
  await expect(page.getByTestId("highlights")).toHaveCount(0);
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
  expect(css.bg).toBe("rgb(30, 38, 25)"); // superficie carbón elevada (#1e2619), nada de crema
  expect(css.fg).toBe("rgb(242, 236, 220)"); // texto crema legible
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

test("panel QA de alertas: escenarios visibles en «Para que nada se caiga», sin duplicados, y limpieza total", async ({ page }) => {
  await login(page);
  await page.goto("/ajustes");
  const panel = page.getByTestId("alert-qa-panel");
  await expect(panel).toBeVisible();
  await shot(page, "04-panel-qa", panel);

  await page.getByTestId("qa-seed-alerts").click();
  await expect(page.getByText("Escenarios QA creados ✓ — revísalos en Hoy.").first()).toBeVisible();

  // Bloque 2: los escenarios se ven en «Para que nada se caiga», cada uno en su grupo
  await page.goto("/");
  const keep = page.getByTestId("keep-up");
  await expect(keep).toBeVisible();
  await expect(page.getByTestId("keepup-overdue").getByText("QA ALERTA — Tarea vencida")).toBeVisible();
  await expect(page.getByTestId("keepup-waiting").getByText("QA ALERTA — Esperando respuesta")).toBeVisible();
  await expect(page.getByTestId("keepup-projects").getByText("QA ALERTA — Proyecto dormido")).toBeVisible();
  // cada tarea una sola vez en todo el bloque
  await expect(keep.getByText("QA ALERTA — Tarea vencida", { exact: true })).toHaveCount(1);
  await shot(page, "05-alertas-simuladas", keep);

  // la fila abre el elemento correcto
  await page.getByTestId("keepup-overdue").getByText("QA ALERTA — Tarea vencida").click();
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
