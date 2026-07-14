import { test, expect, type Page, type TestInfo } from "@playwright/test";
import fs from "fs";
import path from "path";

const QA_DIR = path.join(__dirname, "..", "docs", "qa", "phase-1-task-detail");
const PASSWORD = "prueba-mafer-123";

test.describe.configure({ mode: "serial" });

// En modo serial un fallo reintenta el archivo completo; los títulos llevan el número
// de intento para que los restos del intento anterior no choquen con el actual.
const t = (info: TestInfo, name: string) => `${name} R${info.retry}`;

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

async function ensureProject(page: Page, title: string) {
  await page.goto("/proyectos");
  if (await page.getByText(title, { exact: true }).first().isVisible().catch(() => false)) return;
  await page.getByTestId("new-project").first().click();
  await page.getByTestId("new-project-title").fill(title);
  await page.getByTestId("new-project-save").click();
  await page.waitForURL(/\/proyectos\/.+/);
}

async function createTask(page: Page, title: string, opts?: { date?: string }) {
  await page.goto("/tareas");
  await page.getByTestId("new-task").click();
  await page.getByTestId("new-task-title").fill(title);
  if (opts?.date) await page.getByLabel("Fecha (opcional)").fill(opts.date);
  await page.getByTestId("new-task-save").click();
  await expect(page.getByTestId("task-groups").getByText(title, { exact: true })).toBeVisible();
}

function openFromList(page: Page, title: string) {
  return page.getByTestId("task-open").filter({ hasText: title }).first().click();
}

const toast = (page: Page, text: string) => page.getByText(text).first();

test("preparación: proyectos MACA Medical Journey y Proyecto Beta", async ({ page }) => {
  await login(page);
  await ensureProject(page, "MACA Medical Journey");
  await ensureProject(page, "Proyecto Beta");
});

test("abrir desde Tareas, editar título y descripción, y sobrevivir al refresh", async ({ page }, info) => {
  const base = t(info, "Tarea detalle base");
  const editada = t(info, "Tarea detalle editada");
  await login(page);
  await createTask(page, base);
  await openFromList(page, base);
  await expect(page.getByTestId("card-detail")).toBeVisible();
  await shot(page, "01-detalle-desktop");

  await page.getByTestId("card-title-input").fill(editada);
  await page.getByTestId("card-desc-input").fill("Descripción escrita desde el detalle.");
  await page.getByTestId("card-save").click();
  await expect(toast(page, "Tarea actualizada ✓")).toBeVisible();
  await expect(page.getByTestId("card-detail")).toHaveCount(0);
  await expect(page.getByTestId("task-groups").getByText(editada, { exact: true })).toBeVisible();

  // los cambios persisten tras refrescar
  await page.reload();
  await expect(page.getByTestId("task-groups").getByText(editada, { exact: true })).toBeVisible();
  await openFromList(page, editada);
  await expect(page.getByTestId("card-desc-input")).toHaveValue("Descripción escrita desde el detalle.");
  await page.getByTestId("card-cancel").click();
});

test("abrir desde Hoy", async ({ page }, info) => {
  const titulo = t(info, "Tarea de hoy detalle");
  const hoy = new Date().toLocaleDateString("en-CA");
  await login(page);
  await createTask(page, titulo, { date: hoy });
  await page.goto("/");
  await openFromList(page, titulo);
  await expect(page.getByTestId("card-detail")).toBeVisible();
  await expect(page.getByTestId("card-title-input")).toHaveValue(titulo);
});

test("abrir desde el tablero de un proyecto", async ({ page }, info) => {
  const tarjeta = t(info, "Tarjeta detalle tablero");
  await login(page);
  await page.goto("/proyectos");
  await page.getByText("MACA Medical Journey", { exact: true }).first().click();
  await page.waitForURL(/\/proyectos\/.+/);
  await page.getByTestId("quickadd-backlog").click();
  await page.getByTestId("quickadd-input-backlog").fill(tarjeta);
  await page.keyboard.press("Enter");
  await page.getByTestId("column-backlog").getByText(tarjeta, { exact: true }).click();
  await expect(page.getByTestId("card-detail")).toBeVisible();
  await expect(page.getByTestId("card-title-input")).toHaveValue(tarjeta);
});

test("asignar una tarea sin proyecto a MACA Medical Journey y verla en su tablero", async ({ page }, info) => {
  const editada = t(info, "Tarea detalle editada");
  await login(page);
  await page.goto("/tareas");
  await openFromList(page, editada);
  await expect(page.getByTestId("project-none")).toHaveAttribute("aria-checked", "true");

  await page.getByRole("radio", { name: "MACA Medical Journey" }).click();
  // al elegir proyecto se cargan sus listas y Backlog queda seleccionada por defecto
  await expect(page.getByTestId("state-backlog")).toHaveAttribute("aria-checked", "true");
  await shot(page, "02-selector-proyecto");
  await page.getByTestId("card-save").click();
  await expect(toast(page, "Tarea actualizada ✓")).toBeVisible();

  // aparece en el tablero del proyecto, en Backlog
  await page.goto("/proyectos");
  await page.getByText("MACA Medical Journey", { exact: true }).first().click();
  await page.waitForURL(/\/proyectos\/.+/);
  await expect(page.getByTestId("column-backlog").getByText(editada, { exact: true })).toBeVisible();
  await shot(page, "05-tarea-en-proyecto");

  // en Tareas ya no está en «Sin proyecto», y no se duplicó
  await page.goto("/tareas");
  await expect(page.getByTestId("task-groups").getByText(editada, { exact: true })).toHaveCount(1);
  const grupoMaca = page.getByTestId("task-groups").locator("section", { hasText: "MACA Medical Journey" });
  await expect(grupoMaca.getByText(editada, { exact: true })).toBeVisible();
});

test("cambiar la tarea de MACA a Proyecto Beta conservando sus datos", async ({ page }, info) => {
  const editada = t(info, "Tarea detalle editada");
  await login(page);
  await page.goto("/tareas");
  await openFromList(page, editada);
  await page.getByRole("radio", { name: "Proyecto Beta" }).click();
  await expect(page.getByTestId("state-backlog")).toHaveAttribute("aria-checked", "true");
  await page.getByTestId("card-save").click();
  await expect(toast(page, "Tarea actualizada ✓")).toBeVisible();

  // está en el tablero de Beta y ya no en el de MACA
  await page.goto("/proyectos");
  await page.getByText("Proyecto Beta", { exact: true }).first().click();
  await page.waitForURL(/\/proyectos\/.+/);
  await expect(page.getByTestId("column-backlog").getByText(editada, { exact: true })).toBeVisible();
  await page.goto("/proyectos");
  await page.getByText("MACA Medical Journey", { exact: true }).first().click();
  await page.waitForURL(/\/proyectos\/.+/);
  await expect(page.getByTestId("board").getByText(editada, { exact: true })).toHaveCount(0);

  // conservó la descripción
  await page.goto("/tareas");
  await openFromList(page, editada);
  await expect(page.getByTestId("card-desc-input")).toHaveValue("Descripción escrita desde el detalle.");
  await page.getByTestId("card-cancel").click();
});

test("quitar la tarea del proyecto (Sin proyecto)", async ({ page }, info) => {
  const editada = t(info, "Tarea detalle editada");
  await login(page);
  await page.goto("/tareas");
  await openFromList(page, editada);
  await page.getByTestId("project-none").click();
  await page.getByTestId("card-save").click();
  await expect(toast(page, "Tarea actualizada ✓")).toBeVisible();

  const grupoSin = page.getByTestId("task-groups").locator("section", { hasText: "Sin proyecto" });
  await expect(grupoSin.getByText(editada, { exact: true })).toBeVisible();
  await expect(page.getByTestId("task-groups").getByText(editada, { exact: true })).toHaveCount(1);
  // fuera del tablero de Beta
  await page.goto("/proyectos");
  await page.getByText("Proyecto Beta", { exact: true }).first().click();
  await page.waitForURL(/\/proyectos\/.+/);
  await expect(page.getByTestId("board").getByText(editada, { exact: true })).toHaveCount(0);
});

test("cambiar el estado (lista) desde el detalle", async ({ page }, info) => {
  const tarjeta = t(info, "Tarjeta detalle tablero");
  await login(page);
  await page.goto("/proyectos");
  await page.getByText("MACA Medical Journey", { exact: true }).first().click();
  await page.waitForURL(/\/proyectos\/.+/);
  await page.getByTestId("column-backlog").getByText(tarjeta, { exact: true }).click();
  await expect(page.getByTestId("card-detail")).toBeVisible();
  await page.getByTestId("state-proceso").click();
  await page.getByTestId("card-save").click();
  await expect(toast(page, "Tarea actualizada ✓")).toBeVisible();
  await expect(page.getByTestId("column-proceso").getByText(tarjeta, { exact: true })).toBeVisible();
  // persiste tras recargar
  await page.reload();
  await expect(page.getByTestId("column-proceso").getByText(tarjeta, { exact: true })).toBeVisible();
});

test("añadir, editar y quitar la fecha", async ({ page }, info) => {
  const editada = t(info, "Tarea detalle editada");
  await login(page);
  await page.goto("/tareas");
  await openFromList(page, editada);
  await page.getByTestId("card-due-input").fill("2026-08-01");
  await page.getByTestId("card-save").click();
  await expect(page.getByTestId("card-detail")).toHaveCount(0);
  await expect(page.getByTestId("task-groups").getByText("2026-08-01")).toBeVisible();

  await openFromList(page, editada);
  await expect(page.getByTestId("card-due-input")).toHaveValue("2026-08-01");
  await page.getByTestId("card-due-input").fill("2026-09-15");
  await page.getByTestId("card-save").click();
  await expect(page.getByTestId("card-detail")).toHaveCount(0);
  await expect(page.getByTestId("task-groups").getByText("2026-09-15")).toBeVisible();

  await openFromList(page, editada);
  await page.getByTestId("clear-date").click();
  await page.getByTestId("card-save").click();
  await expect(page.getByTestId("card-detail")).toHaveCount(0);
  await expect(page.getByTestId("task-groups").getByText("2026-09-15")).toHaveCount(0);
});

test("checklist: añadir, marcar, editar y persistir", async ({ page }, info) => {
  const editada = t(info, "Tarea detalle editada");
  await login(page);
  await page.goto("/tareas");
  await openFromList(page, editada);

  await page.getByTestId("checklist-add-input").fill("Paso uno");
  await page.keyboard.press("Enter");
  await page.getByTestId("checklist-add-input").fill("Paso dos");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("checklist").locator("li")).toHaveCount(2);

  await page.getByRole("checkbox", { name: "Marcar «Paso uno»" }).check();
  await shot(page, "03-checklist");
  // editar el texto de un elemento
  await page.getByLabel("Editar «Paso dos»").fill("Paso dos revisado");
  await page.keyboard.press("Enter");

  // cerrar (la checklist se guarda sola) y verificar tras recargar
  await page.getByTestId("card-close").click();
  await page.reload();
  await openFromList(page, editada);
  await expect(page.getByRole("checkbox", { name: "Marcar «Paso uno»" })).toBeChecked();
  await expect(page.getByLabel("Editar «Paso dos revisado»")).toBeVisible();
  await page.getByTestId("card-cancel").click();
});

test("completar y reabrir desde el detalle", async ({ page }, info) => {
  const ciclo = t(info, "Tarea ciclo completo");
  await login(page);
  await createTask(page, ciclo);
  await openFromList(page, ciclo);
  await page.getByTestId("card-complete").click();
  await expect(toast(page, "Tarea completada ✓")).toBeVisible();
  await expect(page.getByTestId("card-detail")).toHaveCount(0);

  await page.goto("/tareas?f=terminadas");
  await openFromList(page, ciclo);
  await expect(page.getByTestId("card-detail")).toBeVisible();
  await expect(page.getByText(/Terminada el \d{4}-\d{2}-\d{2}/)).toBeVisible();
  await page.getByTestId("card-complete").click(); // ahora dice «Reabrir»
  await expect(toast(page, "Tarea reabierta — volvió a Próximo.")).toBeVisible();
  await page.goto("/tareas");
  await expect(page.getByTestId("task-groups").getByText(ciclo, { exact: true })).toBeVisible();
});

test("cancelar descarta los cambios", async ({ page }, info) => {
  const editada = t(info, "Tarea detalle editada");
  await login(page);
  await page.goto("/tareas");
  await openFromList(page, editada);
  await page.getByTestId("card-title-input").fill("Título que no debe guardarse");
  await page.getByTestId("card-cancel").click();
  await expect(page.getByTestId("card-detail")).toHaveCount(0);
  await expect(page.getByTestId("task-groups").getByText(editada, { exact: true })).toBeVisible();
  await expect(page.getByTestId("task-groups").getByText("Título que no debe guardarse")).toHaveCount(0);
});

test("cerrar con cambios sin guardar muestra advertencia (sin alertas nativas)", async ({ page }, info) => {
  const editada = t(info, "Tarea detalle editada");
  await login(page);
  await page.goto("/tareas");
  await openFromList(page, editada);
  await page.getByTestId("card-title-input").fill("Cambio sin guardar");

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("unsaved-warning")).toBeVisible();
  await page.getByTestId("keep-editing").click();
  await expect(page.getByTestId("unsaved-warning")).toHaveCount(0);
  await expect(page.getByTestId("card-detail")).toBeVisible();

  await page.keyboard.press("Escape");
  await page.getByTestId("discard-changes").click();
  await expect(page.getByTestId("card-detail")).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("task-groups").getByText(editada, { exact: true })).toBeVisible();
  await expect(page.getByTestId("task-groups").getByText("Cambio sin guardar")).toHaveCount(0);
});

test("archivar desde el detalle", async ({ page }, info) => {
  const archivar = t(info, "Tarea para archivar");
  await login(page);
  await createTask(page, archivar);
  await openFromList(page, archivar);
  await page.getByTestId("card-archive").click();
  await expect(toast(page, "Tarea archivada.")).toBeVisible();
  await page.goto("/tareas?f=archivadas");
  await expect(page.getByTestId("task-groups").getByText(archivar, { exact: true })).toBeVisible();
});

test("eliminar desde el detalle pide confirmación", async ({ page }, info) => {
  const eliminar = t(info, "Tarea para eliminar");
  await login(page);
  await createTask(page, eliminar);
  await openFromList(page, eliminar);
  await page.getByTestId("card-delete").click();
  await expect(page.getByTestId("card-delete-confirm")).toBeVisible();
  await expect(page.getByTestId("card-detail")).toBeVisible(); // aún no borra
  await page.getByTestId("card-delete-confirm").click();
  await expect(page.getByTestId("card-detail")).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("task-groups").getByText(eliminar, { exact: true })).toHaveCount(0);
});

test("arrastrar una tarjeta no abre el detalle", async ({ page }, info) => {
  const tarjeta = t(info, "Tarjeta detalle tablero");
  await login(page);
  await page.goto("/proyectos");
  await page.getByText("MACA Medical Journey", { exact: true }).first().click();
  await page.waitForURL(/\/proyectos\/.+/);
  const card = page.getByTestId("column-proceso").getByText(tarjeta, { exact: true });
  const target = page.getByTestId("column-proximo");
  const from = await card.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error("No se pudieron medir los elementos");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 - 30, from.y, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + 110, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByTestId("column-proximo").getByText(tarjeta, { exact: true })).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(400);
  await expect(page.getByTestId("card-detail")).toHaveCount(0);
});

test("el círculo de completar no abre el modal", async ({ page }, info) => {
  const ciclo = t(info, "Tarea ciclo completo");
  await login(page);
  await page.goto("/tareas");
  await page.getByRole("button", { name: `Completar «${ciclo}»` }).first().click();
  await expect(toast(page, "Tarea completada ✓")).toBeVisible();
  await expect(page.getByTestId("card-detail")).toHaveCount(0);
  await page.getByRole("button", { name: "Deshacer" }).first().click();
});

test("clic físico en el centro de la fila abre el detalle y la URL lleva ?abrir=", async ({ page }, info) => {
  const titulo = t(info, "Tarea clic real");
  await login(page);
  await createTask(page, titulo);

  // clic con el mouse en el centro geométrico del cuerpo de la fila (como lo haría Mafer)
  const fila = page.getByTestId("task-open").filter({ hasText: titulo }).first();
  await fila.scrollIntoViewIfNeeded();
  const box = await fila.boundingBox();
  if (!box) throw new Error("No se pudo medir la fila");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

  await expect(page.getByTestId("card-detail")).toBeVisible();
  await expect(page.getByTestId("card-title-input")).toHaveValue(titulo);
  expect(page.url()).toContain("abrir=");
  const urlAbierta = page.url();

  // editar, guardar: el parámetro se limpia y seguimos en Tareas
  await page.getByTestId("card-title-input").fill(`${titulo} editada`);
  await page.getByTestId("card-save").click();
  await expect(toast(page, "Tarea actualizada ✓")).toBeVisible();
  await expect(page.getByTestId("card-detail")).toHaveCount(0);
  expect(page.url()).not.toContain("abrir=");
  expect(page.url()).toContain("/tareas");

  // refrescar: el cambio persiste
  await page.reload();
  await expect(page.getByTestId("task-groups").getByText(`${titulo} editada`, { exact: true })).toBeVisible();

  // URL directa con ?abrir= recupera y abre la tarea (sin pantalla vacía)
  await page.goto(urlAbierta);
  await expect(page.getByTestId("card-detail")).toBeVisible();
  await expect(page.getByTestId("card-title-input")).toHaveValue(`${titulo} editada`);
  await page.getByTestId("card-cancel").click();
  await expect(page.getByTestId("card-detail")).toHaveCount(0);
  expect(page.url()).not.toContain("abrir=");
});

test("menú «⋯» de la fila ofrece Abrir tarea como respaldo", async ({ page }, info) => {
  const editada = t(info, "Tarea detalle editada");
  await login(page);
  await page.goto("/tareas");
  const fila = page.locator("li", { has: page.getByTestId("task-open").filter({ hasText: editada }) }).first();
  await fila.getByTestId("task-menu").click();
  await fila.getByTestId("task-menu-open").click();
  await expect(page.getByTestId("card-detail")).toBeVisible();
  expect(page.url()).toContain("abrir=");
  await page.getByTestId("card-cancel").click();
});

test("Ajustes muestra la versión en ejecución (commit, fecha del build y entorno)", async ({ page }) => {
  await login(page);
  await page.goto("/ajustes");
  const version = page.getByTestId("version-info");
  await expect(version).toBeVisible();
  await expect(version).toContainText(/Versión [0-9a-f]{7}/);
  await expect(version).toContainText("compilada el");
  await expect(version).toContainText("entorno: producción");
});

test("convertir captura en tarea ofrece abrirla al momento", async ({ page }, info) => {
  const texto = t(info, "Captura convertible");
  await login(page);
  await page.goto("/inbox");
  await page.getByTestId("quickbar-input").fill(texto);
  await page.keyboard.press("Enter");
  const item = page.getByTestId("inbox-item").filter({ hasText: texto });
  await item.getByTestId("inbox-process").click();
  await page.getByTestId("type-tarea").click();
  await page.getByTestId("process-submit").click();
  await expect(toast(page, "Convertida en tarea ✓")).toBeVisible();
  await page.getByRole("button", { name: "Abrir tarea" }).click();
  await expect(page.getByTestId("card-detail")).toBeVisible();
  await expect(page.getByTestId("card-title-input")).toHaveValue(texto);
});
