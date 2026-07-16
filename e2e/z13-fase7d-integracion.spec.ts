import { test, expect, type Page } from "@playwright/test";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

/** Fase 7D — integración del Jardín de enfoque con Hoy y las tareas.
 *  Nadie escribe ?focus=1: todos los accesos son botones reales. */

const QA_DIR = path.join(__dirname, "..", "docs", "qa", "phase-7d-focus-integration");
const PASSWORD = "prueba-mafer-123";
const TEST_DB = path.join(__dirname, ".test-db", "mafer-test.db");

test.describe.configure({ mode: "serial" });

async function shot(page: Page, name: string) {
  fs.mkdirSync(QA_DIR, { recursive: true });
  await page.screenshot({ path: path.join(QA_DIR, `${name}.png`), fullPage: false });
}

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  const confirm = page.getByLabel(/confirma/i);
  if (await confirm.count()) await confirm.fill(PASSWORD);
  await page.getByRole("button", { name: /entrar|crear|empezar/i }).click();
  await page.waitForURL("/");
}

function backdateOpenSession(minutes: number) {
  const iso = new Date(Date.now() - minutes * 60_000).toISOString();
  execSync(
    `node --input-type=module --eval "
import Database from 'better-sqlite3';
const db = new Database(process.env.TEST_DB);
db.prepare(\\"UPDATE focus_sessions SET phase_started_at = ? WHERE finished_at IS NULL\\").run('${iso}');
"`,
    { cwd: path.join(__dirname, ".."), env: { ...process.env, TEST_DB } }
  );
}

async function crearTarea(page: Page, titulo: string) {
  await page.goto("/tareas?v=todas");
  await page.getByTestId("new-task").click();
  await page.getByTestId("new-task-title").fill(titulo);
  await page.getByTestId("new-task-save").click();
  await page.getByTestId("classify-skip").click();
  await expect(page.getByTestId("task-groups").getByText(titulo).first()).toBeVisible();
}

async function terminarSesionAbierta(page: Page) {
  // desde cualquier estado activo: terminar antes y volver
  await page.getByTestId("focus-end-early").click();
  await expect(page.getByTestId("focus-summary")).toBeVisible();
  await page.getByTestId("focus-back-app").click();
  await expect(page.getByTestId("focus-overlay")).toHaveCount(0);
}

test("módulo de Hoy: abrir sin escribir la URL e iniciar Enfoque libre", async ({ page }) => {
  await login(page);
  const modulo = page.getByTestId("focus-module");
  await expect(modulo).toBeVisible();
  await expect(modulo).toContainText("Jardín de enfoque");
  await expect(modulo).toContainText(/de \d+ min para/);

  await page.getByTestId("focus-module-open").click();
  await expect(page.getByTestId("focus-overlay")).toBeVisible();
  expect(page.url()).toContain("focus=1");

  // Enfoque libre es el estado por defecto; inicia sesión vinculable pero libre
  await expect(page.getByTestId("focus-task")).toContainText("Enfoque libre");
  await page.getByTestId("focus-preset-arranque").click();
  await page.getByTestId("focus-start").click();
  await expect(page.getByTestId("focus-clock")).toBeVisible();
  await expect(page.getByTestId("focus-task")).toContainText("Enfoque libre");
});

test("indicador «En foco» en Hoy, reabrir con Volver, Escape y Atrás sin perder la sesión", async ({ page }) => {
  await login(page);

  // indicador con tiempo restante y Volver
  const modulo = page.getByTestId("focus-module");
  await expect(modulo).toContainText("En foco");
  await expect(page.getByTestId("focus-module-clock")).toHaveText(/^[0-5]?\d:\d{2}$/);
  await page.getByTestId("focus-module-open").click();
  await expect(page.getByTestId("focus-clock")).toBeVisible();

  // Escape cierra solo la vista
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("focus-overlay")).toHaveCount(0);
  await expect(page.getByTestId("focus-module")).toContainText("En foco");

  // Atrás cierra el overlay sin cancelar (el botón lo abrió con pushState)
  await page.getByTestId("focus-module-open").click();
  await expect(page.getByTestId("focus-overlay")).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId("focus-overlay")).toHaveCount(0);

  // X cierra solo la vista; la sesión sigue y se puede terminar bien
  await page.getByTestId("focus-module-open").click();
  await page.getByTestId("focus-close").click();
  await expect(page.getByTestId("focus-overlay")).toHaveCount(0);
  await page.getByTestId("focus-module-open").click();
  await expect(page.getByTestId("focus-clock")).toBeVisible();

  // enfoque libre: al terminar no hay decisión de tarea
  await page.getByTestId("focus-end-early").click();
  await expect(page.getByTestId("focus-summary")).toBeVisible();
  await expect(page.getByTestId("focus-task-decision")).toHaveCount(0);
  await page.getByTestId("focus-back-app").click();
});

test("«Haz esto ahora»: Enfocarme abre con la tarea correcta y dos clics bastan", async ({ page }) => {
  await crearTareaSiFalta(page);
  await page.goto("/");
  const titulo = ((await page.getByTestId("do-now-title").textContent()) ?? "").trim();
  expect(titulo.length).toBeGreaterThan(0);

  await page.getByTestId("do-now-focus").click(); // clic 1
  await expect(page.getByTestId("focus-overlay")).toBeVisible();
  await expect(page.getByTestId("focus-task")).toContainText(titulo);

  await page.getByTestId("focus-start").click(); // clic 2 → sesión vinculada corriendo
  await expect(page.getByTestId("focus-clock")).toBeVisible();
  await expect(page.getByTestId("focus-task")).toContainText(titulo);

  // con sesión activa, el hero ofrece volver — no crear otra
  await page.goto("/");
  await expect(page.getByTestId("do-now-focus")).toContainText("Volver al enfoque");
  await page.getByTestId("do-now-focus").click();
  await expect(page.getByTestId("focus-clock")).toBeVisible();
  await terminarSesionAbierta(page);
});

async function crearTareaSiFalta(page: Page) {
  await login(page);
  await page.goto("/tareas?v=todas");
  if ((await page.getByTestId("task-groups").count()) === 0) {
    await crearTarea(page, "Tarea de enfoque 7D");
  }
}

test("detalle de tarea: Enfocar esta tarea preselecciona; nunca dos sesiones a la vez", async ({ page }, testInfo) => {
  const segunda = `Segunda tarea 7D R${testInfo.retry}`;
  const tercera = `Tercera tarea 7D R${testInfo.retry}`;
  await login(page);
  await crearTarea(page, segunda);

  // sin sesión: el detalle preselecciona la tarea
  await page.getByTestId("task-groups").getByText(segunda).first().click();
  await expect(page.getByTestId("card-detail")).toBeVisible();
  await page.getByTestId("card-focus").click();
  await expect(page.getByTestId("focus-overlay")).toBeVisible();
  await expect(page.getByTestId("focus-task")).toContainText(segunda);

  // inicia sesión vinculada
  await page.getByTestId("focus-preset-ligero").click();
  await page.getByTestId("focus-start").click();
  await expect(page.getByTestId("focus-clock")).toBeVisible();

  // con esa sesión viva, enfocar OTRA tarea avisa y no sustituye nada
  await page.getByTestId("focus-close").click();
  await page.keyboard.press("Escape"); // cerrar también el detalle
  await page.goto("/tareas?v=todas");
  await crearTarea(page, tercera);
  await page.getByTestId("task-groups").getByText(tercera).first().click();
  await page.getByTestId("card-focus").click();
  await expect(page.getByTestId("focus-overlay")).toBeVisible();
  await expect(page.getByTestId("focus-conflict")).toContainText(tercera);
  await expect(page.getByTestId("focus-clock")).toBeVisible(); // sigue la sesión original

  // solo hay UNA sesión abierta en la base
  const salida = execSync(
    `node --input-type=module --eval "
import Database from 'better-sqlite3';
const db = new Database(process.env.TEST_DB);
console.log('ABIERTAS=' + db.prepare('SELECT COUNT(*) c FROM focus_sessions WHERE finished_at IS NULL').get().c);
"`,
    { cwd: path.join(__dirname, ".."), env: { ...process.env, TEST_DB } }
  ).toString();
  const abiertas = Number(/ABIERTAS=(\d+)/.exec(salida)?.[1] ?? "-1");
  expect(abiertas).toBe(1);

  // cerrarla correctamente deja elegir la nueva (queda preseleccionada)
  await terminarSesionAbierta(page);
});

test("cierre con decisión: «Sigue en curso» no toca la tarea", async ({ page }) => {
  await login(page);
  await page.goto("/");
  const titulo = ((await page.getByTestId("do-now-title").textContent()) ?? "").trim();
  await page.getByTestId("do-now-focus").click();
  await page.getByTestId("focus-preset-pomodoro").click();
  await page.getByTestId("focus-start").click();
  await expect(page.getByTestId("focus-clock")).toBeVisible();

  backdateOpenSession(30);
  await page.reload();
  await expect(page.getByTestId("focus-done-minutes")).toBeVisible();
  await page.getByTestId("focus-skip-break").click();

  const decision = page.getByTestId("focus-task-decision");
  await expect(decision).toBeVisible();
  await expect(decision).toContainText(titulo.slice(0, 20));
  await page.getByTestId("focus-task-continue").click();
  await expect(page.getByTestId("focus-task-decided")).toContainText("sigue en curso");
  await shot(page, "05-cierre-decision-claro");
  await page.getByTestId("focus-back-app").click();

  // la tarea sigue abierta (no se completó sola)
  await page.goto("/tareas?v=todas");
  await expect(page.getByTestId("task-groups").getByText(titulo.slice(0, 25)).first()).toBeVisible();
});

test("cierre con decisión: «La terminé» reutiliza completar con Deshacer; «Abrir tarea» abre el detalle", async ({ page }, testInfo) => {
  const titulo = `Tarea para terminar 7D R${testInfo.retry}`;
  await login(page);
  await page.goto("/tareas?v=todas");
  await crearTarea(page, titulo);
  await page.getByTestId("task-groups").getByText(titulo).first().click();
  await page.getByTestId("card-focus").click();
  await expect(page.getByTestId("focus-task")).toContainText(titulo);
  await page.getByTestId("focus-preset-arranque").click();
  await page.getByTestId("focus-start").click();
  await expect(page.getByTestId("focus-clock")).toBeVisible();

  await page.getByTestId("focus-end-early").click();
  await expect(page.getByTestId("focus-task-decision")).toBeVisible();
  await page.getByTestId("focus-task-complete").click();

  // toast con Deshacer disponible (mismo flujo que completar en cualquier lista)
  const toast = page.locator('[role="status"]', { hasText: "Tarea completada" }).first();
  await expect(toast).toBeVisible();
  await expect(toast.getByRole("button", { name: "Deshacer" })).toBeVisible();
  await expect(page.getByTestId("focus-task-decided")).toContainText("Tarea completada");

  // deshacer regresa la decisión a pendiente
  await toast.getByRole("button", { name: "Deshacer" }).click();
  await expect(page.getByTestId("focus-task-decision")).toBeVisible();

  // «Abrir tarea» cierra el overlay y abre el detalle correcto
  await page.getByTestId("focus-task-open").click();
  await expect(page.getByTestId("focus-overlay")).toHaveCount(0);
  await expect(page.getByTestId("card-detail")).toBeVisible();
  await expect(page.getByTestId("card-detail")).toHaveAttribute("aria-label", `Detalle de «${titulo}»`);
  await page.getByTestId("card-cancel").click();
});

test("Inbox no cambió: sin módulo de enfoque y con su captura de siempre", async ({ page }) => {
  await login(page);
  await page.goto("/inbox");
  await expect(page.getByTestId("focus-module")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /inbox/i })).toBeVisible();
  await expect(page.getByTestId("capture-fab")).toBeVisible();
});

test("capturas: Hoy sin y con sesión, accesos y iPhone (oscuro y claro)", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("mafer-theme", "dark"));
  await login(page);
  await page.waitForTimeout(400);
  await shot(page, "01-hoy-sin-sesion-oscuro");

  // acceso desde el hero con la tarea correcta
  await page.getByTestId("do-now-focus").click();
  await expect(page.getByTestId("focus-overlay")).toBeVisible();
  await page.waitForTimeout(300);
  await shot(page, "02-acceso-haz-esto-ahora-oscuro");
  await page.getByTestId("focus-start").click();
  await expect(page.getByTestId("focus-clock")).toBeVisible();
  await page.getByTestId("focus-close").click();

  // Hoy con sesión activa (módulo «En foco»)
  await page.goto("/");
  await expect(page.getByTestId("focus-module")).toContainText("En foco");
  await page.waitForTimeout(400);
  await shot(page, "03-hoy-en-foco-oscuro");

  // iPhone: módulo compacto y overlay con scroll interno
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.waitForTimeout(400);
  await shot(page, "06-hoy-iphone-oscuro");
  await page.getByTestId("focus-module-open").click();
  await expect(page.getByTestId("focus-overlay")).toBeVisible();
  await page.waitForTimeout(300);
  await shot(page, "07-overlay-iphone-oscuro");
  await terminarSesionAbierta(page);
});

test("capturas: claro (Hoy y acceso desde detalle)", async ({ page }) => {
  await login(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.waitForTimeout(400);
  await shot(page, "04-hoy-sin-sesion-claro");

  await page.goto("/tareas?v=todas");
  await page.getByTestId("task-groups").locator("[data-testid='task-open']").first().click();
  await expect(page.getByTestId("card-detail")).toBeVisible();
  await page.getByTestId("card-focus").click();
  await expect(page.getByTestId("focus-overlay")).toBeVisible();
  await page.waitForTimeout(300);
  await shot(page, "08-acceso-detalle-claro");
  await page.getByTestId("focus-close").click();
});
