import { test, expect, type Page } from "@playwright/test";
import fs from "fs";
import path from "path";
import { PASSWORD } from "./lib/credentials";

const QA_DIR = path.join(__dirname, "..", "..", "project-management", "qa", "stabilization-round");

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

test("nueva tarea desde la página Tareas (con opciones avanzadas)", async ({ page }) => {
  await login(page);
  await page.goto("/tareas?v=todas");
  await page.getByTestId("new-task").click();
  await page.getByTestId("new-task-title").fill("Tarea creada desde Tareas");
  await page.getByTestId("new-task-more").click();
  await page.getByLabel("Etiquetas (separadas por coma)").fill("prueba, estabilización");
  await page.getByTestId("new-task-save").click();
  // paso 2: clasificación opcional — duración larga y energía alta para el trabajo profundo
  await expect(page.getByTestId("classify-step")).toBeVisible();
  await page.getByTestId("dur-over_60").click();
  await page.getByTestId("energy-high").click();
  await page.getByTestId("classify-confirm").click();
  await expect(page.getByText("Clasificación guardada ✓")).toBeVisible();
  await expect(page.getByTestId("task-groups").getByText("Tarea creada desde Tareas")).toBeVisible();
  await shot(page, "20-tareas-pagina");
});

test("completar muestra toast con Deshacer, y deshacer funciona", async ({ page }) => {
  await login(page);
  await page.goto("/tareas?v=todas");
  await expect(page.getByTestId("task-groups").getByText("Tarea creada desde Tareas").first()).toBeVisible();
  await page.getByRole("button", { name: "Completar «Tarea creada desde Tareas»" }).first().click();

  // feedback claro, sin alertas nativas
  await expect(page.getByText("Tarea completada ✓")).toBeVisible();
  await shot(page, "21-toast-completada");

  // aparece en terminadas
  await page.getByRole("link", { name: "Ver en terminadas" }).click();
  await expect(page).toHaveURL(/v=terminadas/);
  await expect(page.getByTestId("task-groups").getByText("Tarea creada desde Tareas").first()).toBeVisible();
  await shot(page, "22-terminadas");

  // reabrir desde terminadas (equivalente a deshacer en cualquier momento)
  await page.getByRole("button", { name: "Reabrir «Tarea creada desde Tareas»" }).first().click();
  // esperar a que el servidor confirme antes de navegar (si no, la navegación cortaba la acción)
  await expect(page.getByText("Tarea reabierta — volvió a Próximo.").first()).toBeVisible();
  await page.goto("/tareas?v=todas");
  await expect(page.getByTestId("task-groups").getByText("Tarea creada desde Tareas").first()).toBeVisible();
});

test("deshacer inmediato desde el toast", async ({ page }) => {
  await login(page);
  await page.goto("/tareas?v=todas");
  await page.getByRole("button", { name: "Completar «Tarea creada desde Tareas»" }).first().click();
  await expect(page.getByText("Tarea completada ✓")).toBeVisible();
  await page.getByRole("button", { name: "Deshacer" }).click();
  // esperar a que la acción llegue al servidor: recargar en el mismo instante la cortaba
  await page.waitForLoadState("networkidle");
  // sigue (o vuelve a estar) en abiertas tras refrescar
  await page.reload();
  await expect(page.getByTestId("task-groups").getByText("Tarea creada desde Tareas").first()).toBeVisible();
});

test("los filtros se recuerdan al navegar entre secciones", async ({ page }) => {
  await login(page);
  // Tareas ya no vive en la navegación principal (Fase 2) — la sección de
  // referencia para esta prueba pasa a ser Proyectos, que sigue en el menú
  // y también acepta un filtro por query param.
  await page.goto("/proyectos?f=terminados");
  await expect(page).toHaveURL(/f=terminados/);
  // ir a otra sección y volver por la navegación principal
  await page.getByRole("navigation", { name: "Navegación principal" }).first().getByRole("link", { name: "Hoy" }).click();
  await page.waitForURL("/");
  await page.getByRole("navigation", { name: "Navegación principal" }).first().getByRole("link", { name: "Proyectos" }).click();
  await expect(page).toHaveURL(/f=terminados/);
});

test("calendario: vista Día con horario y persistencia de vista", async ({ page }) => {
  await login(page);
  await page.goto("/calendario");
  await page.getByTestId("vista-dia").click();
  await expect(page.getByTestId("day-view")).toBeVisible();
  await expect(page.getByText("07:00")).toBeVisible();
  await shot(page, "23-calendario-dia");
  await page.getByTestId("vista-semana").click();
  await expect(page).toHaveURL(/vista=semana/);
  await shot(page, "24-calendario-semana");
  // salir y volver por navegación: conserva la vista
  await page.getByRole("navigation", { name: "Navegación principal" }).first().getByRole("link", { name: "Hoy" }).click();
  await page.waitForURL("/");
  await page.getByRole("navigation", { name: "Navegación principal" }).first().getByRole("link", { name: "Calendario" }).click();
  await expect(page).toHaveURL(/vista=semana/);
});

test("tema oscuro, claro y automático", async ({ page }) => {
  await login(page);
  await page.goto("/ajustes");
  await page.getByTestId("theme-dark").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await shot(page, "25-ajustes-oscuro");
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await shot(page, "26-hoy-oscuro");
  await page.goto("/proyectos");
  await page.getByText("Proyecto de prueba E2E").click();
  await page.waitForURL(/\/proyectos\/.+/);
  await shot(page, "27-tablero-oscuro");
  // persistencia tras recarga
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  // automático respeta el sistema (emulamos preferencia clara)
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/ajustes");
  await page.getByTestId("theme-auto").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.getByTestId("theme-light").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("la energía del día vive dentro de «Haz esto ahora» y Hoy ya no lista trabajo profundo", async ({ page }) => {
  await login(page);
  const doNow = page.getByTestId("do-now");
  await doNow.getByTestId("energy-alta").click();
  await expect(page.getByText("He ajustado tus sugerencias para energía alta")).toBeVisible();
  // Bloque 2: el trabajo profundo es una vista de Tareas, no un bloque de Hoy
  await expect(page.getByTestId("deep-work-list")).toHaveCount(0);
  await shot(page, "28-hoy-energia-alta");
  await doNow.getByTestId("energy-baja").click();
  await expect(page.getByText("He ajustado tus sugerencias para energía baja")).toBeVisible();
});

test("Agentes y Skills se retiraron de la interfaz: sus enlaces llevan a la Biblioteca", async ({ page }) => {
  await login(page);
  await page.goto("/biblioteca/agentes");
  await page.waitForURL("/biblioteca");
  await expect(page.getByRole("heading", { level: 1, name: "Biblioteca" })).toBeVisible();
  await page.goto("/biblioteca/skills");
  await page.waitForURL("/biblioteca");
  await expect(page.getByText("Agentes", { exact: true })).toHaveCount(0);
});

test("FAB abre menú claro con las 6 acciones", async ({ page }) => {
  await login(page);
  await page.getByTestId("capture-fab").click();
  for (const t of ["fab-captura", "fab-tarea", "fab-proyecto", "fab-evento", "fab-journal", "fab-idea"]) {
    await expect(page.getByTestId(t)).toBeVisible();
  }
  await shot(page, "29-fab-menu");
  await page.getByTestId("fab-tarea").click();
  await expect(page.getByRole("dialog", { name: "Nueva tarea" })).toBeVisible();
  await page.getByRole("button", { name: "Cerrar" }).click();
});

test("mi sistema de IA muestra flujos reales", async ({ page }) => {
  await login(page);
  await page.goto("/biblioteca");
  await expect(page.getByTestId("flow-card").first()).toContainText("Crear contenido para MACA");
  await expect(page.getByTestId("flow-card").first()).toContainText("/maca-crear-contenido");
  await shot(page, "30-mi-sistema-ia");
});
