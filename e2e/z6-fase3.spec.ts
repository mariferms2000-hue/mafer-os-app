import { test, expect, type Page, type TestInfo } from "@playwright/test";
import fs from "fs";
import path from "path";

const QA_DIR = path.join(__dirname, "..", "docs", "qa", "phase-3");
const PASSWORD = "prueba-mafer-123";

test.describe.configure({ mode: "serial" });

const t = (info: TestInfo, name: string) => `${name} F3R${info.retry}`;

async function shot(page: Page, name: string, locator?: ReturnType<Page["getByTestId"]>) {
  fs.mkdirSync(QA_DIR, { recursive: true });
  if (locator) await locator.screenshot({ path: path.join(QA_DIR, `${name}.png`) });
  else await page.screenshot({ path: path.join(QA_DIR, `${name}.png`), fullPage: true });
}

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("/");
}

/** Crea una tarea y confirma o ajusta su clasificación con chips. */
async function crearClasificada(
  page: Page,
  titulo: string,
  opts?: { date?: string; dur?: string; energy?: string; skip?: boolean }
) {
  await page.goto("/tareas?v=todas");
  await page.getByTestId("new-task").click();
  await page.getByTestId("new-task-title").fill(titulo);
  if (opts?.date) {
    await page.getByTestId("new-task-more").click();
    await page.getByLabel("Fecha (opcional)").fill(opts.date);
  }
  await page.getByTestId("new-task-save").click();
  await expect(page.getByTestId("classify-step")).toBeVisible();
  if (opts?.skip) {
    await page.getByTestId("classify-skip").click();
  } else {
    if (opts?.dur) await page.getByTestId(opts.dur).click();
    if (opts?.energy) await page.getByTestId(opts.energy).click();
    await page.getByTestId("classify-confirm").click();
    await expect(page.getByText("Clasificación guardada ✓").first()).toBeVisible();
  }
}

test("«Haz esto ahora» muestra una sola recomendación con sus razones", async ({ page }) => {
  await login(page);
  const doNow = page.getByTestId("do-now");
  await expect(doNow).toBeVisible();
  await expect(page.getByTestId("do-now-title")).toHaveCount(1); // UNA recomendación
  await expect(page.getByTestId("do-now-reasons")).toContainText("Porque");
});

test("la prioridad #1 manual manda, y «La terminé» la completa desde ahí", async ({ page }, info) => {
  const titulo = t(info, "Prioridad absoluta");
  await login(page);
  await crearClasificada(page, titulo, { skip: true });

  await page.goto("/");
  // deja las prioridades en cero (suites anteriores pudieron dejar alguna) para que la nueva sea la #1
  const quitar = page.getByRole("button", { name: /^Quitar «/ });
  for (let n = await quitar.count(); n > 0; n--) {
    await quitar.first().click();
    await expect(quitar).toHaveCount(n - 1);
  }
  await page.getByTestId("pick-priority").click();
  await page.getByTestId("priority-candidates").getByText(titulo, { exact: true }).click();

  await expect(page.getByTestId("do-now-title")).toContainText(titulo);
  await expect(page.getByTestId("do-now-reasons")).toContainText("prioridad #1");
  await shot(page, "02-haz-esto-ahora", page.getByTestId("do-now"));

  // completar directo desde la recomendación
  await page.getByTestId("do-now-complete").click();
  await expect(page.getByText("Tarea completada ✓").first()).toBeVisible();
  await expect(page.getByTestId("do-now-title")).not.toContainText(titulo);
});

test("la energía del día cambia la recomendación (baja→ligera, alta→profunda)", async ({ page }, info) => {
  const ligera = t(info, "Enviar acuse al notario");
  const pesada = t(info, "Redactar estrategia anual");
  const hoy = new Date().toLocaleDateString("en-CA");
  await login(page);
  // ambas con fecha de hoy para que compitan en igualdad y decida la energía
  await crearClasificada(page, ligera, { date: hoy }); // sugerencia: under_10 + low
  await crearClasificada(page, pesada, { date: hoy }); // sugerencia: over_60 + high

  await page.goto("/");
  await page.getByTestId("energy-baja").click();
  await expect(page.getByTestId("do-now-title")).toContainText(ligera);
  await expect(page.getByTestId("do-now-reasons")).toContainText("energía baja");

  await page.getByTestId("energy-alta").click();
  await expect(page.getByTestId("do-now-title")).toContainText(pesada);
  await expect(page.getByTestId("do-now-reasons")).toContainText("energía alta");
});

test("«Otra sugerencia» rota entre candidatas y abrir lleva al detalle", async ({ page }) => {
  await login(page);
  const titulo1 = await page.getByTestId("do-now-title").textContent();
  await page.getByTestId("do-now-other").click();
  const titulo2 = await page.getByTestId("do-now-title").textContent();
  expect(titulo2).not.toBe(titulo1);

  await page.getByTestId("do-now-open").click();
  await expect(page.getByTestId("card-detail")).toBeVisible();
  expect(page.url()).toContain("abrir=");
  await page.getByTestId("card-cancel").click();
});

test("alertas antiolvido: vencida, proyecto sin siguiente acción y tarea de hoy sin estimar", async ({ page }, info) => {
  const vencida = t(info, "Renovar el seguro del coche");
  const ayer = new Date(Date.now() - 86_400_000).toLocaleDateString("en-CA");
  await login(page);
  await crearClasificada(page, vencida, { date: ayer, skip: true });

  await page.goto("/");
  const alerts = page.getByTestId("forget-alerts");
  await expect(alerts).toBeVisible();

  // vencida: la más urgente, va primero y enlaza a la acción
  const alertaVencida = page.getByTestId("alert-tarea-vencida");
  await expect(alertaVencida).toBeVisible();
  await expect(alertaVencida).toContainText(/venció|vencidas/);

  // proyecto activo sin siguiente acción (los de las suites anteriores no la tienen)
  await expect(page.getByTestId("alert-proyecto-sin-accion").first()).toContainText("no tiene siguiente acción");

  // tarea de hoy sin duración o energía (la vencida de ayer no cuenta; las de hoy sí)
  await expect(page.getByTestId("alert-hoy-sin-estimar")).toBeVisible();
  await shot(page, "03-alertas", alerts);
  await shot(page, "01-hoy-completa");

  // la alerta lleva a la acción con un clic
  await alertaVencida.click();
  await expect(page.getByTestId("card-detail")).toBeVisible();
  await expect(page.getByTestId("card-title-input")).toHaveValue(vencida);
  // resolverla aquí mismo: quitarle la fecha y guardar
  await page.getByTestId("clear-date").click();
  await page.getByTestId("card-save").click();
  await expect(page.getByText("Tarea actualizada ✓").first()).toBeVisible();
  await page.goto("/");
  await expect(page.getByTestId("alert-tarea-vencida")).toHaveCount(0);
});

test("la recomendación nunca es una tarea bloqueada o en espera", async ({ page }, info) => {
  const bloqueada = t(info, "Tarea imposible ahora");
  await login(page);
  await crearClasificada(page, bloqueada, { skip: true });
  // bloquearla desde el detalle
  await page.getByTestId("task-open").filter({ hasText: bloqueada }).first().click();
  await page.getByLabel("Bloqueada por…").fill("esperando refacciones");
  await page.getByTestId("card-save").click();
  await expect(page.getByText("Tarea actualizada ✓").first()).toBeVisible();

  await page.goto("/");
  await expect(page.getByTestId("do-now-title")).not.toContainText(bloqueada);
  await page.getByTestId("do-now-other").click();
  await expect(page.getByTestId("do-now-title")).not.toContainText(bloqueada);
});
