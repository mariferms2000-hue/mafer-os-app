import { test, expect } from "@playwright/test";

const PASSWORD = "prueba-mafer-123";

/** Estrés de drag & drop en WebKit (motor de Safari): antes crasheaba el renderer
 *  («This page couldn't load»). Este test protege contra regresiones. */
test("safari/webkit: estrés de drag & drop sin crash", async ({ page }) => {
  let crashed = false;
  const pageErrors: string[] = [];
  page.on("crash", () => (crashed = true));
  page.on("pageerror", (e) => pageErrors.push(e.message));

  await page.goto("/login");
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("/");

  // proyecto propio para el estrés
  await page.goto("/proyectos");
  const existing = page.getByText("Estrés Safari", { exact: true });
  if (await existing.isVisible().catch(() => false)) {
    await existing.click();
  } else {
    await page.getByTestId("new-project").first().click();
    await page.getByTestId("new-project-title").fill("Estrés Safari");
    await page.getByTestId("new-project-save").click();
  }
  await page.waitForURL(/\/proyectos\/.+/);

  for (let i = 1; i <= 4; i++) {
    const name = `Safari ${i}`;
    if (await page.getByTestId("board").getByText(name, { exact: true }).isVisible().catch(() => false)) continue;
    await page.getByTestId("quickadd-backlog").click();
    await page.getByTestId("quickadd-input-backlog").fill(name);
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("column-backlog").getByText(name, { exact: true })).toBeVisible();
  }

  const cols = ["proximo", "proceso", "esperando", "backlog"];
  for (let round = 0; round < 3; round++) {
    for (let i = 1; i <= 4; i++) {
      const card = page.getByTestId("board").getByText(`Safari ${i}`, { exact: true }).first();
      const target = page.getByTestId(`column-${cols[(i + round) % cols.length]}`);
      const from = await card.boundingBox();
      const to = await target.boundingBox();
      if (!from || !to) continue;
      await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
      await page.mouse.down();
      await page.mouse.move(to.x + to.width / 2, to.y + 110, { steps: 6 });
      await page.mouse.up();
      await page.waitForTimeout(120);
    }
  }
  await page.waitForTimeout(1200);

  expect(crashed, "el proceso de WebKit no debe crashear").toBe(false);
  expect(page.url()).toContain("/proyectos/");
  await expect(page.getByTestId("board")).toBeVisible();

  // persistencia tras recarga: las 4 tarjetas siguen existiendo
  await page.reload();
  for (let i = 1; i <= 4; i++) {
    await expect(page.getByTestId("board").getByText(`Safari ${i}`, { exact: true }).first()).toBeVisible();
  }
  // El registro del service worker sobre http puede fallar en WebKit de pruebas; no es un error de la app.
  const relevantes = pageErrors.filter((e) => !e.includes("sw.js"));
  expect(relevantes, `errores de página: ${relevantes.join(" | ")}`).toHaveLength(0);
});

test("safari/webkit: abrir el detalle de una tarjeta, editar y guardar", async ({ page }, testInfo) => {
  const titulo = `Detalle Safari R${testInfo.retry}`;
  const editado = `Detalle Safari editada R${testInfo.retry}`;

  await page.goto("/login");
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("/");

  await page.goto("/proyectos");
  await page.getByText("Estrés Safari", { exact: true }).click();
  await page.waitForURL(/\/proyectos\/.+/);
  await page.getByTestId("quickadd-backlog").click();
  await page.getByTestId("quickadd-input-backlog").fill(titulo);
  await page.keyboard.press("Enter");

  await page.getByTestId("column-backlog").getByText(titulo, { exact: true }).click();
  await expect(page.getByTestId("card-detail")).toBeVisible();
  await expect(page.getByTestId("card-title-input")).toHaveValue(titulo);

  await page.getByTestId("card-title-input").fill(editado);
  await page.getByTestId("card-save").click();
  await expect(page.getByText("Tarea actualizada ✓").first()).toBeVisible();
  await expect(page.getByTestId("card-detail")).toHaveCount(0);
  await expect(page.getByTestId("board").getByText(editado, { exact: true })).toBeVisible();
});

test("safari/webkit: chips de duración y energía en el detalle", async ({ page }, testInfo) => {
  const titulo = `Chips Safari R${testInfo.retry}`;

  await page.goto("/login");
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("/");

  await page.goto("/tareas?v=todas");
  await page.getByTestId("new-task").click();
  await page.getByTestId("new-task-title").fill(titulo);
  await page.getByTestId("new-task-save").click();
  // clasificación opcional en WebKit
  await expect(page.getByTestId("classify-step")).toBeVisible();
  await page.getByTestId("dur-ten_to_30").click();
  await page.getByTestId("energy-medium").click();
  await page.getByTestId("classify-confirm").click();
  await expect(page.getByText("Clasificación guardada ✓").first()).toBeVisible();

  // editar los chips desde el detalle y persistir tras recargar
  await page.getByTestId("task-open").filter({ hasText: titulo }).first().click();
  await expect(page.getByTestId("dur-ten_to_30")).toHaveAttribute("aria-checked", "true");
  await page.getByTestId("dur-over_60").click();
  await page.getByTestId("energy-high").click();
  await page.getByTestId("card-save").click();
  await expect(page.getByText("Tarea actualizada ✓").first()).toBeVisible();
  await page.reload();
  await page.getByTestId("task-open").filter({ hasText: titulo }).first().click();
  await expect(page.getByTestId("dur-over_60")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("energy-high")).toHaveAttribute("aria-checked", "true");
});

test("safari/webkit: «Haz esto ahora» y alertas antiolvido funcionan", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("/");

  await expect(page.getByTestId("do-now")).toBeVisible();
  await expect(page.getByTestId("do-now-reasons")).toContainText("Porque");
  await expect(page.getByTestId("forget-alerts")).toBeVisible();

  // abrir la recomendación lleva al detalle editable
  await page.getByTestId("do-now-open").click();
  await expect(page.getByTestId("card-detail")).toBeVisible();
  await page.getByTestId("card-cancel").click();
  await expect(page.getByTestId("card-detail")).toHaveCount(0);
});

test("safari/webkit: siguiente acción y Retomar proyecto", async ({ page }, testInfo) => {
  const proyecto = `Proyecto Safari 4B R${testInfo.retry}`;
  const paso = `Paso Safari 4B R${testInfo.retry}`;

  await page.goto("/login");
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("/");

  await page.goto("/proyectos");
  await page.getByTestId("new-project").first().click();
  await page.getByTestId("new-project-title").fill(proyecto);
  await page.getByTestId("new-project-next").fill(paso);
  await page.getByTestId("new-project-save").click();
  await page.waitForURL(/\/proyectos\/.+/);

  await expect(page.getByTestId("next-action-title")).toContainText(paso);
  await page.getByTestId("next-action-change").click();
  await expect(page.getByTestId("next-action-picker")).toBeVisible();
  await page.mouse.click(10, 10);
  await expect(page.getByTestId("next-action-picker")).toHaveCount(0);

  await page.goto(`${page.url().split("?")[0]}?retomar=1`);
  await expect(page.getByTestId("resume-panel")).toBeVisible();
  await expect(page.getByTestId("resume-cta")).toContainText("Continuar con:");
});

test("safari/webkit: página Tareas simple — vistas, Filtrar y Agrupar", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("/");

  await page.goto("/tareas");
  await expect(page.getByTestId("view-ahora")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("task-groups").locator("section")).toHaveCount(0);

  await page.getByTestId("open-filters").click();
  await expect(page.getByTestId("filters-panel")).toBeVisible();
  await page.getByTestId("cancel-filters").click();

  await page.getByTestId("view-todas").click();
  await expect(page).toHaveURL(/v=todas/);
  await page.getByTestId("open-group").click();
  await page.getByTestId("group-proyecto").click();
  await expect(page).toHaveURL(/agrupar=proyecto/);
  await expect(page.getByTestId("open-group")).toContainText("Por proyecto");
  await page.getByTestId("open-group").click();
  await page.getByTestId("group-ninguno").click();
  await expect(page).not.toHaveURL(/agrupar=/);
});

test("safari/webkit: prioridad con feedback y toast legible en modo oscuro", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("/");

  // marcar prioridad desde «Haz esto ahora» SIEMPRE responde algo (toast o selector)
  await page.getByTestId("do-now").getByTestId("mark-priority").click();
  await expect(
    page.getByText(/Añadida a tus prioridades|Ya está en tus prioridades|prioridades están llenas/).first()
  ).toBeVisible();

  // toast en oscuro: superficie bosque, texto crema
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
  await toast.getByRole("button", { name: "Deshacer" }).click();
  await page.goto("/ajustes");
  await page.getByTestId("theme-light").click();
});

test("safari/webkit: clic físico en una fila de Tareas abre el detalle y persiste", async ({ page }, testInfo) => {
  const titulo = `Clic real Safari R${testInfo.retry}`;

  await page.goto("/login");
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("/");

  await page.goto("/tareas?v=todas");
  await page.getByTestId("new-task").click();
  await page.getByTestId("new-task-title").fill(titulo);
  await page.getByTestId("new-task-save").click();
  await expect(page.getByTestId("classify-step")).toBeVisible();
  await page.getByTestId("classify-skip").click();
  await expect(page.getByTestId("task-groups").getByText(titulo, { exact: true })).toBeVisible();

  // clic con el mouse en el centro del cuerpo de la fila
  const fila = page.getByTestId("task-open").filter({ hasText: titulo }).first();
  await fila.scrollIntoViewIfNeeded();
  const box = await fila.boundingBox();
  if (!box) throw new Error("No se pudo medir la fila");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

  await expect(page.getByTestId("card-detail")).toBeVisible();
  await expect(page.getByTestId("card-title-input")).toHaveValue(titulo);
  expect(page.url()).toContain("abrir=");

  await page.getByTestId("card-title-input").fill(`${titulo} editada`);
  await page.getByTestId("card-save").click();
  await expect(page.getByText("Tarea actualizada ✓").first()).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("task-groups").getByText(`${titulo} editada`, { exact: true })).toBeVisible();
});
