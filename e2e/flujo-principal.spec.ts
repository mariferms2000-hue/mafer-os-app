import { test, expect, type Page } from "@playwright/test";
import fs from "fs";
import path from "path";

const QA_DIR = path.join(__dirname, "..", "..", "project-management", "qa", "stabilization-round");
const PASSWORD = "prueba-mafer-123";

test.describe.configure({ mode: "serial" });

async function shot(page: Page, name: string) {
  fs.mkdirSync(QA_DIR, { recursive: true });
  await page.screenshot({ path: path.join(QA_DIR, `${name}.png`), fullPage: true });
}

test("crear contraseña la primera vez e iniciar sesión", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  // Robusto ante reintentos: si la contraseña ya existe (intento previo), inicia sesión normal.
  const firstTime = await page.getByLabel("Confirma tu contraseña").isVisible();
  await shot(page, "01-login");
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  if (firstTime) {
    await page.getByLabel("Confirma tu contraseña").fill(PASSWORD);
    await page.getByRole("button", { name: "Crear y entrar" }).click();
  } else {
    await page.getByRole("button", { name: "Entrar" }).click();
  }
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Buen");
  await shot(page, "02-hoy-vacia");
});

test("rutas protegidas: sin sesión redirige a login", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto("/proyectos");
  await expect(page).toHaveURL(/\/login/);
  await ctx.close();
});

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("/");
}

test("captura al Inbox y conversión a tarea", async ({ page }, testInfo) => {
  // Texto único por intento para que los reintentos no choquen entre sí.
  const item = `Comprar regalo para mamá ${testInfo.retry}`;
  await login(page);
  await page.getByTestId("capture-fab").click();
  await page.getByTestId("fab-captura").click();
  await page.getByTestId("capture-input").fill(item);
  await page.getByTestId("capture-save").click();
  await expect(page.getByText("Capturado.")).toBeVisible();
  await page.getByRole("button", { name: "Cerrar" }).click();
  await page.goto("/inbox");
  const pendiente = page.getByTestId("inbox-item").filter({ hasText: item });
  await expect(pendiente).toHaveCount(1);
  await shot(page, "03-inbox");
  await pendiente.getByTestId("inbox-process").click();
  await expect(page.getByTestId("process-panel")).toBeVisible();
  await page.getByTestId("type-tarea").click();
  await shot(page, "03b-inbox-procesar");
  await page.getByTestId("process-submit").click();
  await expect(pendiente).toHaveCount(0, { timeout: 20_000 });
  await page.goto("/tareas?v=todas");
  await expect(page.getByText(item)).toBeVisible();
});

test("crear proyecto con tablero de 7 listas", async ({ page }) => {
  await login(page);
  await page.goto("/proyectos");
  await page.getByTestId("new-project").first().click();
  await page.getByTestId("new-project-title").fill("Proyecto de prueba E2E");
  await page.getByTestId("new-project-save").click();
  await page.waitForURL(/\/proyectos\/.+/);
  for (const col of ["backlog", "proximo", "proceso", "esperando", "bloqueado", "despues", "terminado"]) {
    await expect(page.getByTestId(`column-${col}`)).toBeVisible();
  }
  await shot(page, "04-tablero");
});

test("añadir tarjeta, editar detalle y completar", async ({ page }) => {
  await login(page);
  await page.goto("/proyectos");
  await page.getByText("Proyecto de prueba E2E").click();
  await page.waitForURL(/\/proyectos\/.+/);

  await page.getByTestId("quickadd-proximo").click();
  await page.getByTestId("quickadd-input-proximo").fill("Primera tarjeta");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("column-proximo").getByText("Primera tarjeta")).toBeVisible();

  await page.getByTestId("column-proximo").getByText("Primera tarjeta").click();
  await expect(page.getByTestId("card-detail")).toBeVisible();
  await page.getByTestId("dur-ten_to_30").click();
  await page.getByLabel("Bloqueada por…").fill("");
  await shot(page, "05-detalle-tarjeta");
  await page.getByTestId("card-save").click();
  await expect(page.getByTestId("card-detail")).not.toBeVisible();

  // el chip de duración aparece en la tarjeta
  await expect(page.getByTestId("column-proximo").getByText("10–30′")).toBeVisible();

  // completar desde el detalle → pasa a Terminado
  await page.getByTestId("column-proximo").getByText("Primera tarjeta").click();
  await page.getByTestId("card-complete").click();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("column-terminado").getByText("Primera tarjeta")).toBeVisible({ timeout: 10_000 });
});

test("drag & drop de tarjeta entre listas persiste", async ({ page }) => {
  await login(page);
  await page.goto("/proyectos");
  await page.getByText("Proyecto de prueba E2E").click();
  await page.waitForURL(/\/proyectos\/.+/);

  await page.getByTestId("quickadd-backlog").click();
  await page.getByTestId("quickadd-input-backlog").fill("Tarjeta arrastrable");
  await page.keyboard.press("Enter");
  const card = page.getByTestId("column-backlog").getByText("Tarjeta arrastrable");
  await expect(card).toBeVisible();

  const target = page.getByTestId("column-proceso");
  const from = await card.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error("No se pudieron medir los elementos");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 30, from.y, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + 120, { steps: 15 });
  await page.mouse.up();

  await expect(page.getByTestId("column-proceso").getByText("Tarjeta arrastrable")).toBeVisible({ timeout: 10_000 });
  // recargar: el orden persistió en la base
  await page.reload();
  await expect(page.getByTestId("column-proceso").getByText("Tarjeta arrastrable")).toBeVisible();
});

test("elegir una prioridad del día en Hoy", async ({ page }) => {
  await login(page);
  await page.getByTestId("pick-priority").click();
  await page.getByTestId("priority-candidates").getByText("Comprar regalo para mamá").first().click();
  await expect(page.locator("ol").getByText("Comprar regalo para mamá").first()).toBeVisible();
  await shot(page, "06-hoy-con-prioridad");
});

test("journal: crear, escribir y guardar", async ({ page }) => {
  await login(page);
  await page.goto("/explorar/journal");
  await page.getByTestId("new-journal-input").fill("Mi primera reflexión");
  await page.getByTestId("new-journal-save").click();
  await page.waitForURL(/\/explorar\/journal\/.+/);
  await page.getByTestId("journal-body").fill("Hoy construí mi sistema operativo personal.");
  await page.getByTestId("journal-save").click();
  await expect(page.getByText("Guardado")).toBeVisible();
  await page.goto("/explorar/journal");
  await expect(page.getByTestId("journal-list").getByText("Mi primera reflexión")).toBeVisible();
  await shot(page, "07-journal");
});

test("learn fast: crear tema y editarlo", async ({ page }) => {
  await login(page);
  await page.goto("/explorar/learn-fast");
  await page.getByTestId("new-learning-input").fill("Storytelling E2E");
  await page.getByTestId("new-learning-save").click();
  await page.waitForURL(/\/explorar\/learn-fast\/.+/);
  await page.getByLabel("¿Por qué me importa?").fill("Para vender sin sentirme vendedora.");
  await page.getByLabel("Estado").selectOption("activo");
  await page.getByTestId("learning-save").click();
  await page.goto("/explorar/learn-fast");
  await expect(page.getByText("Storytelling E2E")).toBeVisible();
});

test("incubadora: crear idea", async ({ page }) => {
  await login(page);
  await page.goto("/explorar");
  await page.getByTestId("new-idea-input").fill("Idea incubada de prueba");
  await page.getByTestId("new-idea-save").click();
  await expect(page.getByTestId("idea-list").getByText("Idea incubada de prueba")).toBeVisible();
});

test("prompts: crear y copiar al portapapeles", async ({ page }) => {
  await login(page);
  await page.goto("/biblioteca/prompts");
  await page.getByText("Nuevo prompt").click();
  await page.getByTestId("new-prompt-title").fill("Prompt E2E");
  await page.getByTestId("new-prompt-body").fill("Contenido del prompt de prueba");
  await page.getByTestId("new-prompt-save").click();
  await expect(page.getByTestId("prompt-list").getByText("Prompt E2E")).toBeVisible();
  const card = page.getByTestId("prompt-card").filter({ hasText: "Prompt E2E" });
  await card.getByTestId("prompt-copy").click();
  await expect(card.getByText("Copiado")).toBeVisible();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toBe("Contenido del prompt de prueba");
});

test("recomendador de IA responde con reglas", async ({ page }) => {
  await login(page);
  await page.goto("/biblioteca");
  await page.getByTestId("recommender-input").fill("Necesito diseñar un carrusel para MACA");
  await page.getByTestId("recommender-go").click();
  const result = page.getByTestId("recommender-result");
  await expect(result).toContainText("Canva");
  await expect(result).toContainText("/maca-crear-contenido");
  await shot(page, "08-recomendador");
});

test("calendario: crear evento y verlo en la vista", async ({ page }) => {
  await login(page);
  await page.goto("/calendario");
  await page.getByTestId("new-event").click();
  await page.getByTestId("event-title").fill("Reunión de prueba");
  const hoy = new Date();
  const iso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
  await page.getByTestId("event-date").fill(iso);
  await page.getByTestId("event-save").click();
  await page.goto("/calendario?vista=agenda");
  await expect(page.getByText("Reunión de prueba")).toBeVisible();
  await shot(page, "09-calendario-agenda");
});

test("búsqueda global encuentra entidades", async ({ page }) => {
  await login(page);
  await page.goto("/buscar?q=prueba");
  const results = page.getByTestId("search-results");
  await expect(results).toContainText("Proyecto de prueba E2E");
  await expect(results).toContainText("Reunión de prueba");
});

test("export JSON descarga datos válidos", async ({ page }) => {
  await login(page);
  const res = await page.request.get("/api/export/json");
  expect(res.ok()).toBeTruthy();
  const json = await res.json();
  expect(json.app).toBe("Mafer OS");
  expect(json.counts.projects).toBeGreaterThan(0);
  expect(json.data.cards.length).toBeGreaterThan(0);
});

test("logout cierra la sesión", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "Salir" }).click();
  await page.waitForURL(/\/login/);
  await page.goto("/proyectos");
  await expect(page).toHaveURL(/\/login/);
});
