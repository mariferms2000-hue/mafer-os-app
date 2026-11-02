import { test, expect, type Page } from "@playwright/test";
import fs from "fs";
import path from "path";
import { PASSWORD } from "./lib/credentials";
import { run, q } from "./lib/test-db";

/* Progreso por tareas — F3 (oct 2026), dirección visual aprobada:
 * «Recompensas del jardín» como tarjeta propia (camino de 3 hitos + inventario
 * con fichas), toasts con el camino en miniatura para 1 y 2 de 3, tarjeta de
 * recompensa al llegar a 3, «Ver jardín» que hace brillar la ficha ganada una
 * vez, y nada de progreso en Hoy. Las recompensas todavía no se usan. */

test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

const QA_DIR = path.join(__dirname, "..", "docs", "qa", "progreso-f3");
const P = "F3 E2E";
const now = new Date().toISOString();

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  const confirm = page.getByLabel(/confirma/i);
  if (await confirm.count()) await confirm.fill(PASSWORD);
  await page.getByRole("button", { name: /entrar|crear|empezar/i }).click();
  await page.waitForURL("/");
}
async function shot(page: Page, name: string) {
  fs.mkdirSync(QA_DIR, { recursive: true });
  await page.screenshot({ path: path.join(QA_DIR, `${name}.png`), fullPage: false });
}
async function tema(page: Page, theme: "light" | "dark") {
  await page.evaluate((t) => localStorage.setItem("mafer-theme", t), theme);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}
const centrar = (page: Page, testid: string) =>
  page.getByTestId(testid).evaluate((el) => el.scrollIntoView({ block: "center" }));

const captura = (id: string, content: string) =>
  run(`INSERT INTO inbox_items (id, content, note, created_at) VALUES ('${id}', '${P} ${content}', '', '${now}')`);
const tarea = (id: string, title: string) =>
  run(`INSERT INTO cards (id, title, created_at, updated_at) VALUES ('${id}', '${P} ${title}', '${now}', '${now}')`);
/** n puntos ya en la barra (tareas completadas con su crédito). */
async function puntos(prefix: string, n: number) {
  for (let i = 0; i < n; i++) {
    const id = `${prefix}-${i}`;
    await run(`INSERT INTO cards (id, title, completed_at, created_at, updated_at) VALUES ('${id}', '${P} ${id}', '${now}', '${now}', '${now}')`);
    await run(`INSERT INTO progress_credits (card_id, kind, credited_at) VALUES ('${id}', 'tarea', '${now}')`);
  }
}
const tarjeta = (page: Page, content: string) => page.getByTestId("inbox-item").filter({ hasText: `${P} ${content}` });
const rewards = () => q<{ id: string; item: string }>(`SELECT id, item FROM garden_rewards`);
const openPoints = async () =>
  (await q(`SELECT 1 FROM progress_credits WHERE kind = 'tarea' AND reward_id IS NULL`)).length;
const label = (item: string) => (item === "agua" ? "Agua" : "Fertilizante");

async function limpiarProgreso() {
  await run(`DELETE FROM progress_credits`);
  await run(`DELETE FROM garden_rewards`);
  await run(`DELETE FROM settings WHERE key = 'progress_reward_bag'`);
  await run(`DELETE FROM cards WHERE title LIKE '${P}%'`);
}
async function limpiar() {
  await limpiarProgreso();
  await run(`DELETE FROM inbox_items WHERE content LIKE '${P}%'`);
}

test.beforeAll(limpiar);
test.afterAll(limpiar);

test("Hoy ya no muestra el progreso en el módulo del Jardín de enfoque", async ({ page }) => {
  await login(page);
  await expect(page.getByTestId("focus-module")).toBeVisible();
  await expect(page.getByTestId("focus-module").getByText(/próxima recompensa|de 3/)).toHaveCount(0);
});

test("Jardín con 0, 1 y 2 de 3: camino, título, frase e inventario vacío", async ({ page }) => {
  await login(page);
  const casos = [
    { n: 0, hint: "Tres tareas para tu próxima recompensa." },
    { n: 1, hint: "Dos más para tu próxima recompensa." },
    { n: 2, hint: "Una más para tu próxima recompensa." },
  ];
  for (const { n, hint } of casos) {
    await limpiarProgreso();
    await puntos(`f3-c${n}`, n);
    await page.goto("/biblioteca/jardin");
    const box = page.getByTestId("garden-rewards");
    await expect(box.getByRole("heading", { name: "Recompensas del jardín" })).toBeVisible();
    await expect(box.getByTestId("garden-path")).toHaveAttribute("data-count", String(n));
    await expect(box.getByTestId("garden-path")).toHaveAttribute("aria-label", `Progreso: ${n} de 3 tareas`);
    await expect(box.getByTestId("garden-progress-text")).toHaveText(`${n} de 3 tareas`);
    await expect(box.getByTestId("garden-progress-hint")).toHaveText(hint);
    // inventario vacío: las dos fichas en 0 y la invitación
    await expect(box.getByTestId("garden-inventory-agua")).toHaveAttribute("data-count", "0");
    await expect(box.getByTestId("garden-inventory-fertilizante")).toHaveAttribute("data-count", "0");
    await expect(box.getByTestId("garden-inventory-empty")).toHaveText("Completa 3 tareas para tu primera recompensa.");
    await expect(box.getByRole("button")).toHaveCount(0); // todavía no se usan
    await centrar(page, "garden-rewards");
    await shot(page, `01-jardin-${n}de3-claro`);
  }
});

test("1 y 2 de 3: toast con el camino; 3 de 3: tarjeta de recompensa; «Ver jardín» hace brillar la ficha", async ({ page }) => {
  await limpiarProgreso();
  for (const [i, t] of ["Uno", "Dos", "Tres"].entries()) await captura(`f3-${i}`, t);
  await login(page);
  await page.goto("/inbox");

  await tarjeta(page, "Uno").getByTestId("inbox-done").click();
  const t1 = page.locator('[role="status"]').filter({ hasText: "1 de 3" }).last();
  await expect(t1).toContainText("Hecho ✓");
  await expect(t1.getByTestId("toast-progress")).toContainText("Progreso del jardín");

  await tarjeta(page, "Dos").getByTestId("inbox-done").click();
  const t2 = page.locator('[role="status"]').filter({ hasText: "2 de 3" }).last();
  await expect(t2.getByTestId("toast-path")).toHaveAttribute("data-count", "2");
  await page.waitForTimeout(600); // la hoja nueva ya brotó
  await shot(page, "02-toast-2de3-claro");

  await tarjeta(page, "Tres").getByTestId("inbox-done").click();
  const card = page.getByTestId("reward-card");
  await expect(card).toBeVisible();
  await expect.poll(async () => (await rewards()).length).toBe(1);
  const [won] = await rewards();
  await expect(card.getByTestId("reward-card-title")).toHaveText(`Ganaste ${label(won.item)}`);
  await expect(card).toContainText("Hecho ✓");
  await expect(card).toContainText("Ya está en tus recompensas del jardín.");
  await expect(card.getByRole("button", { name: "Deshacer" })).toBeVisible();
  await expect(card.getByTestId("reward-card-path")).toHaveAttribute("data-count", "3");
  await page.waitForTimeout(1400); // entrada + pulso del ícono terminados
  await shot(page, "03-recompensa-escritorio-claro");
  expect(await openPoints()).toBe(0);

  // «Ver jardín»: la ficha ganada brilla una vez y el parámetro desaparece de la URL
  await card.getByTestId("reward-card-garden").click();
  await page.waitForURL(/\/biblioteca\/jardin/);
  const ficha = page.getByTestId(`garden-inventory-${won.item}`);
  await expect(ficha).toHaveClass(/garden-tile-glow/);
  await expect(ficha).toHaveAttribute("data-count", "1");
  await page.waitForTimeout(650); // en el punto más visible del brillo
  await shot(page, "04-jardin-brillo-claro");
  await expect.poll(() => new URL(page.url()).searchParams.has("recompensa")).toBe(false);
  await page.reload();
  await expect(page.getByTestId(`garden-inventory-${won.item}`)).not.toHaveClass(/garden-tile-glow/);
});

test("Deshacer desde la tarjeta revoca la recompensa y rehacer gana la misma", async ({ page }) => {
  await limpiarProgreso();
  await puntos("f3-prev", 2);
  await tarea("f3-tercera", "Tercera tarea");
  await login(page);

  await page.goto("/tareas?abrir=f3-tercera");
  await page.getByTestId("card-complete").click();
  const card = page.getByTestId("reward-card");
  await expect(card).toBeVisible();
  await expect(card).toContainText("Tarea completada ✓");
  await expect.poll(async () => (await rewards()).length).toBe(1);
  const [won] = await rewards();

  await card.getByRole("button", { name: "Deshacer" }).click();
  const undone = page.locator('[role="status"]').filter({ hasText: "Recompensa deshecha" });
  await expect(undone).toBeVisible();
  await expect(undone.getByTestId("toast-progress")).toContainText("2 de 3");
  await expect.poll(async () => (await rewards()).length).toBe(0);
  expect(await openPoints()).toBe(2);

  await page.goto("/biblioteca/jardin");
  await expect(page.getByTestId("garden-progress-text")).toHaveText("2 de 3 tareas");
  await expect(page.getByTestId("garden-inventory-empty")).toBeVisible();

  await page.goto("/tareas?abrir=f3-tercera");
  await page.getByTestId("card-complete").click();
  await expect.poll(async () => (await rewards()).length).toBe(1);
  expect((await rewards())[0].item).toBe(won.item);
});

test("capturas: inventario con recursos y tarjeta de recompensa, escritorio e iPhone, claro y oscuro", async ({ page }) => {
  await login(page);
  for (const [vista, size] of [
    ["escritorio", { width: 1280, height: 800 }],
    ["iphone", { width: 390, height: 844 }],
  ] as const) {
    await page.setViewportSize(size);
    for (const theme of ["light", "dark"] as const) {
      const nombre = `${vista}-${theme === "light" ? "claro" : "oscuro"}`;

      // inventario con recursos: Agua ×3, Fertilizante ×1, y 2 de 3 en el camino
      await limpiarProgreso();
      for (const [i, item] of ["agua", "agua", "agua", "fertilizante"].entries()) {
        await run(`INSERT INTO garden_rewards (id, item, earned_at) VALUES ('f3-r${i}', '${item}', '${now}')`);
      }
      await puntos("f3-shot", 2);
      await page.goto("/biblioteca/jardin");
      await tema(page, theme);
      const box = page.getByTestId("garden-rewards");
      await expect(box.getByTestId("garden-inventory-agua")).toHaveAttribute("data-count", "3");
      await expect(box.getByTestId("garden-inventory-fertilizante")).toHaveAttribute("data-count", "1");
      await expect(box.getByTestId("garden-inventory-note")).toHaveText("Toca una planta con sed para regarla, o una completada para fertilizarla.");
      await centrar(page, "garden-rewards");
      await shot(page, `05-inventario-${nombre}`);

      // la tarjeta de recompensa (el tercer completado)
      await tarea("f3-foto", "Tarea para la foto");
      await page.goto("/tareas?abrir=f3-foto");
      await page.getByTestId("card-complete").click();
      await expect(page.getByTestId("reward-card")).toBeVisible();
      await page.waitForTimeout(1400);
      await shot(page, `06-recompensa-${nombre}`);
    }
  }
  await tema(page, "light");
});
