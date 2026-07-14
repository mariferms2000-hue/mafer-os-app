import { test, expect, type Page, type Locator, type TestInfo } from "@playwright/test";
import fs from "fs";
import path from "path";

const QA_DIR = path.join(__dirname, "..", "docs", "qa", "phase-4b-projects");
const PASSWORD = "prueba-mafer-123";

test.describe.configure({ mode: "serial" });

const t = (info: TestInfo, name: string) => `${name} Z9R${info.retry}`;

async function shot(page: Page, name: string, locator?: Locator) {
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

async function crearProyecto(page: Page, nombre: string, next?: string) {
  await page.goto("/proyectos");
  await page.getByTestId("new-project").first().click();
  await page.getByTestId("new-project-title").fill(nombre);
  if (next) await page.getByTestId("new-project-next").fill(next);
  await page.getByTestId("new-project-save").click();
  await page.waitForURL(/\/proyectos\/.+/);
}

test("crear proyecto con siguiente acción opcional: nace como tarea real y se marca en el tablero", async ({ page }, info) => {
  const proyecto = t(info, "Guion del curso");
  const paso = t(info, "Escribir el índice");
  await login(page);
  await crearProyecto(page, proyecto, paso);

  // el bloque muestra la tarea, y la tarjeta existe en Próximo con la marca discreta
  await expect(page.getByTestId("next-action-title")).toContainText(paso);
  await expect(page.getByTestId("column-proximo").getByText(paso, { exact: true })).toBeVisible();
  await expect(page.getByTestId("board-next-chip")).toBeVisible();
});

test("sin siguiente acción: aviso claro y «Definir» crea una tarea nueva vinculada", async ({ page }, info) => {
  const proyecto = t(info, "Proyecto en blanco");
  const paso = t(info, "Primer paso definido");
  await login(page);
  await crearProyecto(page, proyecto);

  await expect(page.getByTestId("next-action-missing")).toContainText("Falta definir la siguiente acción.");
  await page.getByTestId("define-next-action").click();
  await expect(page.getByTestId("next-action-picker")).toBeVisible();
  await page.getByTestId("next-action-new-input").fill(paso);
  await page.getByTestId("next-action-create").click();
  await expect(page.getByText(`Siguiente acción creada: «${paso}» ✓`).first()).toBeVisible();
  await expect(page.getByTestId("next-action-title")).toContainText(paso);
  await expect(page.getByTestId("column-proximo").getByText(paso, { exact: true })).toBeVisible();
  // persiste tras refrescar
  await page.reload();
  await expect(page.getByTestId("next-action-title")).toContainText(paso);
});

test("elegir una tarea existente, cambiarla y quitarla", async ({ page }, info) => {
  const proyecto = t(info, "Proyecto en blanco"); // del test anterior
  const otra = t(info, "Otra tarea del tablero");
  await login(page);
  await page.goto("/proyectos");
  await page.getByText(proyecto, { exact: true }).first().click();
  await page.waitForURL(/\/proyectos\/.+/);

  // crear otra tarea en el tablero
  await page.getByTestId("quickadd-backlog").click();
  await page.getByTestId("quickadd-input-backlog").fill(otra);
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("column-backlog").getByText(otra, { exact: true })).toBeVisible();

  // cambiar: elegirla desde el selector
  await page.getByTestId("next-action-change").click();
  await page.getByTestId("next-action-picker").getByText(otra, { exact: true }).click();
  await expect(page.getByText(`Siguiente acción: «${otra}» ✓`).first()).toBeVisible();
  await expect(page.getByTestId("next-action-title")).toContainText(otra);

  // quitarla
  await page.getByTestId("next-action-remove").click();
  await expect(page.getByText("Siguiente acción quitada").first()).toBeVisible();
  await expect(page.getByTestId("next-action-missing")).toBeVisible();
});

test("completar la siguiente acción NO elige otra: avisa y ofrece elegir", async ({ page }, info) => {
  const proyecto = t(info, "Guion del curso");
  const paso = t(info, "Escribir el índice");
  await login(page);
  await page.goto("/proyectos");
  await page.getByText(proyecto, { exact: true }).first().click();
  await page.waitForURL(/\/proyectos\/.+/);

  await page.getByTestId("next-action-open").click();
  await expect(page.getByTestId("card-detail")).toBeVisible();
  await page.getByTestId("card-complete").click();
  await expect(page.getByText("Tarea completada ✓").first()).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("next-action-completed")).toContainText(`«${paso}» se completó ✓`);
  await expect(page.getByTestId("define-next-action")).toContainText("Elegir siguiente acción");
  // el listado también lo explica como alerta
  await page.goto("/proyectos");
  const tarjeta = page.locator("li", { has: page.getByText(proyecto, { exact: true }) }).first();
  await expect(tarjeta.getByTestId("card-alerts")).toContainText("elige otra");
});

test("tarjetas del listado: siguiente acción, progreso honesto y actividad humana", async ({ page }, info) => {
  const conAccion = t(info, "Proyecto en blanco"); // tiene «Primer paso definido»... fue quitada; volver a definirla
  const paso = t(info, "Paso visible en tarjeta");
  await login(page);
  await page.goto("/proyectos");
  await page.getByText(conAccion, { exact: true }).first().click();
  await page.waitForURL(/\/proyectos\/.+/);
  await page.getByTestId("define-next-action").click();
  await page.getByTestId("next-action-new-input").fill(paso);
  await page.getByTestId("next-action-create").click();
  await expect(page.getByTestId("next-action-title")).toContainText(paso);

  await page.goto("/proyectos");
  await shot(page, "01-proyectos");
  const tarjeta = page.locator("li", { has: page.getByText(conAccion, { exact: true }) }).first();
  await expect(tarjeta).toContainText(paso); // 2. siguiente acción
  await expect(tarjeta.getByTestId("task-progress")).toContainText(/\d+\/\d+ tareas/); // progreso honesto
  await expect(tarjeta.getByTestId("task-progress")).not.toContainText("%");
  await expect(tarjeta).toContainText("Actividad: Hoy"); // 7. última actividad humana
  await shot(page, "03-tarjeta-con-accion", tarjeta);

  const sinAccion = t(info, "Guion del curso"); // su acción se completó
  const tarjeta2 = page.locator("li", { has: page.getByText(sinAccion, { exact: true }) }).first();
  await expect(tarjeta2.getByTestId("card-alerts")).toBeVisible();
  await shot(page, "04-tarjeta-sin-accion", tarjeta2);
});

test("«Necesitan atención»: solo activos con problemas, ordenados por urgencia y explicados", async ({ page }, info) => {
  const urgente = t(info, "Con tarea vencida");
  const ayer = new Date(Date.now() - 86_400_000).toLocaleDateString("en-CA");
  await login(page);
  // proyecto con tarea vencida (lo más urgente)
  await crearProyecto(page, urgente, t(info, "Tarea que venció"));
  await page.getByTestId("next-action-open").click();
  await page.getByTestId("card-due-input").fill(ayer);
  await page.getByTestId("card-save").click();
  await expect(page.getByText("Tarea actualizada ✓").first()).toBeVisible();

  await page.goto("/proyectos");
  await page.getByTestId("pf-atencion").click();
  await expect(page).toHaveURL(/f=atencion/);
  await shot(page, "02-necesitan-atencion");

  // el más urgente (vencida) va primero y se explica
  const primera = page.locator("ul.grid > li").first();
  await expect(primera).toContainText(urgente);
  await expect(primera.getByTestId("card-alerts")).toContainText("vencida");

  // un proyecto sano no aparece: «Proyecto en blanco» tiene siguiente acción y actividad de hoy
  await expect(page.getByText(t(info, "Proyecto en blanco"), { exact: true })).toHaveCount(0);

  // persistencia de filtros tras refrescar
  await page.reload();
  await expect(page).toHaveURL(/f=atencion/);
  await expect(page.getByTestId("pf-atencion")).toHaveAttribute("aria-pressed", "true");
});

test("Retomar proyecto con datos completos: contexto y una acción principal", async ({ page }, info) => {
  const proyecto = t(info, "Proyecto en blanco");
  const enProceso = t(info, "Tarea a medio camino");
  await login(page);
  await page.goto("/proyectos");
  await page.getByText(proyecto, { exact: true }).first().click();
  await page.waitForURL(/\/proyectos\/.+/);

  // algo en proceso para «dónde me quedé»
  await page.getByTestId("quickadd-proceso").click();
  await page.getByTestId("quickadd-input-proceso").fill(enProceso);
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("column-proceso").getByText(enProceso, { exact: true })).toBeVisible();

  const url = page.url().split("?")[0];
  await page.goto(`${url}?retomar=1`);
  const panel = page.getByTestId("resume-panel");
  await expect(panel).toBeVisible();
  await expect(page.getByTestId("where-i-was")).toContainText(`Estabas trabajando en «${enProceso}»`);
  await expect(page.getByTestId("resume-cta")).toContainText("Continuar con:");
  await shot(page, "05-retomar", panel);

  // abrir la tarea de la siguiente acción desde Retomar
  await page.getByTestId("resume-open-task").click();
  await expect(page.getByTestId("card-detail")).toBeVisible();
  await page.getByTestId("card-cancel").click();

  // ver tablero desde Retomar (ancla)
  await expect(panel.getByRole("link", { name: "Ver tablero" })).toHaveAttribute("href", "#tablero");

  // editar siguiente acción desde Retomar abre el selector
  await page.getByTestId("resume-edit-next").click();
  await expect(page.getByTestId("next-action-picker")).toBeVisible();
  await shot(page, "06-selector-siguiente", page.getByTestId("next-action-picker"));
  await page.mouse.click(10, 10); // clic fuera cierra el selector
  await expect(page.getByTestId("next-action-picker")).toHaveCount(0);
});

test("Retomar con datos incompletos: honesto, sin inventar resumen", async ({ page }, info) => {
  const vacio = t(info, "Proyecto vacío");
  await login(page);
  await crearProyecto(page, vacio);
  const url = page.url().split("?")[0];
  await page.goto(`${url}?retomar=1`);
  await expect(page.getByTestId("where-i-was-empty")).toContainText("No hay suficiente actividad registrada");
  await expect(page.getByTestId("resume-no-next")).toContainText("todavía no tiene una próxima acción concreta");
  await expect(page.getByTestId("define-next-action-resume")).toBeVisible();
});

test("«Contexto para retomar»: nota manual editable que persiste", async ({ page }, info) => {
  const vacio = t(info, "Proyecto vacío");
  const nota = "Retomar por la sección 2; falta confirmar fechas con la clínica.";
  await login(page);
  await page.goto("/proyectos");
  await page.getByText(vacio, { exact: true }).first().click();
  await page.waitForURL(/\/proyectos\/.+/);
  await page.goto(`${page.url().split("?")[0]}?retomar=1`);

  await page.getByTestId("resume-note-edit").click();
  await page.getByTestId("resume-note-input").fill(nota);
  await page.getByTestId("resume-note-save").click();
  await expect(page.getByText("Contexto guardado ✓").first()).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("resume-note")).toContainText(nota);
});

test("modo oscuro: página de proyecto legible", async ({ page }, info) => {
  const proyecto = t(info, "Proyecto en blanco");
  await login(page);
  await page.goto("/ajustes");
  await page.getByTestId("theme-dark").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.goto("/proyectos");
  await page.getByText(proyecto, { exact: true }).first().click();
  await page.waitForURL(/\/proyectos\/.+/);
  await page.goto(`${page.url().split("?")[0]}?retomar=1`);
  await expect(page.getByTestId("next-action-block")).toBeVisible();
  await expect(page.getByTestId("resume-panel")).toBeVisible();
  await shot(page, "08-proyecto-oscuro");
  await page.goto("/ajustes");
  await page.getByTestId("theme-light").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("marcar la siguiente acción como prioridad de Hoy e integración con Hoy", async ({ page }, info) => {
  const proyecto = t(info, "Proyecto en blanco");
  await login(page);
  await page.goto("/proyectos");
  await page.getByText(proyecto, { exact: true }).first().click();
  await page.waitForURL(/\/proyectos\/.+/);
  await page.getByTestId("next-action-block").getByTestId("mark-priority").click();
  await expect(
    page.getByText(/Añadida a tus prioridades|Ya está en tus prioridades|prioridades están llenas/).first()
  ).toBeVisible();

  // Hoy: la siguiente acción del proyecto aparece en «Siguiente paso por proyecto»
  const paso = t(info, "Paso visible en tarjeta");
  await page.goto("/");
  await expect(page.getByText(paso).first()).toBeVisible();
  // y los proyectos sin siguiente acción alimentan las alertas antiolvido
  await expect(page.getByTestId("alert-proyecto-sin-accion").first()).toBeVisible();
});
