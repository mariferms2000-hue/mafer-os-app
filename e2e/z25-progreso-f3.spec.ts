import { test, expect, type Page } from "@playwright/test";
import fs from "fs";
import path from "path";
import { PASSWORD } from "./lib/credentials";
import { run, q } from "./lib/test-db";

/* Progreso por tareas — F3 (oct 2026): barra hacia la próxima recompensa
 * (meta 3), toasts de progreso y recompensa, inventario en Mi jardín y la
 * barra compacta en el módulo del Jardín de enfoque de Hoy. Las recompensas
 * todavía no se usan. */

test.describe.configure({ mode: "serial" });
test.setTimeout(90_000);

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

const captura = (id: string, content: string) =>
  run(`INSERT INTO inbox_items (id, content, note, created_at) VALUES ('${id}', '${P} ${content}', '', '${now}')`);
const tarea = (id: string, title: string) =>
  run(`INSERT INTO cards (id, title, created_at, updated_at) VALUES ('${id}', '${P} ${title}', '${now}', '${now}')`);
const tarjeta = (page: Page, content: string) => page.getByTestId("inbox-item").filter({ hasText: `${P} ${content}` });
const rewards = () => q<{ id: string; item: string }>(`SELECT id, item FROM garden_rewards`);
const openPoints = async () =>
  (await q(`SELECT 1 FROM progress_credits WHERE kind = 'tarea' AND reward_id IS NULL`)).length;

async function limpiarProgreso() {
  await run(`DELETE FROM progress_credits`);
  await run(`DELETE FROM garden_rewards`);
  await run(`DELETE FROM settings WHERE key = 'progress_reward_bag'`);
}
async function limpiar() {
  await limpiarProgreso();
  await run(`DELETE FROM inbox_items WHERE content LIKE '${P}%'`);
  await run(`DELETE FROM cards WHERE title LIKE '${P}%'`);
}

test.beforeAll(limpiar);
test.afterAll(limpiar);

test("Jardín sin recompensas: barra en 0 de 3 y la invitación", async ({ page }) => {
  await login(page);
  await page.goto("/biblioteca/jardin");
  const box = page.getByTestId("garden-rewards");
  await expect(box).toBeVisible();
  await expect(box.getByTestId("garden-progress-text")).toHaveText("0 de 3 · próxima recompensa");
  await expect(box.getByTestId("garden-inventory-empty")).toHaveText("Completa 3 tareas para tu primera recompensa.");
  await box.scrollIntoViewIfNeeded();
  await shot(page, "01-jardin-vacio-claro");
});

test("tres ✓ Hecho: los toasts muestran la barra y el tercero gana la recompensa", async ({ page }) => {
  for (const [i, t] of ["Uno", "Dos", "Tres"].entries()) await captura(`f3-${i}`, t);
  await login(page);
  await page.goto("/inbox");

  await tarjeta(page, "Uno").getByTestId("inbox-done").click();
  await expect(page.getByText("Hecho ✓ · ●○○ 1 de 3")).toBeVisible();
  await tarjeta(page, "Dos").getByTestId("inbox-done").click();
  await expect(page.getByText("Hecho ✓ · ●●○ 2 de 3")).toBeVisible();
  await shot(page, "02-inbox-progreso-claro");

  await tarjeta(page, "Tres").getByTestId("inbox-done").click();
  await expect(page.getByText(/^Hecho ✓ · Ganaste (Agua 💧|Fertilizante 🌱)$/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver en el jardín" }).first()).toBeVisible();
  await shot(page, "03-inbox-recompensa-claro");
  expect(await rewards()).toHaveLength(1);
  expect(await openPoints()).toBe(0);

  // la recompensa ya está en el inventario
  const [won] = await rewards();
  await page.goto("/biblioteca/jardin");
  await expect(page.getByTestId("garden-progress-text")).toHaveText("0 de 3 · próxima recompensa");
  await expect(page.getByTestId(`garden-inventory-${won.item}`)).toContainText("×1");
});

test("Deshacer el tercer completado revoca la recompensa y rehacer gana la misma", async ({ page }) => {
  await limpiarProgreso();
  for (const id of ["f3-prev-a", "f3-prev-b"]) {
    await run(`INSERT INTO cards (id, title, completed_at, created_at, updated_at) VALUES ('${id}', '${P} ${id}', '${now}', '${now}', '${now}')`);
    await run(`INSERT INTO progress_credits (card_id, kind, credited_at) VALUES ('${id}', 'tarea', '${now}')`);
  }
  await tarea("f3-tercera", "Tercera tarea");
  await login(page);

  await page.goto("/tareas?abrir=f3-tercera");
  await page.getByTestId("card-complete").click();
  await expect(page.getByText(/^Tarea completada ✓ · Ganaste (Agua 💧|Fertilizante 🌱)$/)).toBeVisible();
  await expect.poll(async () => (await rewards()).length).toBe(1);
  const [won] = await rewards();

  await page.getByRole("button", { name: "Deshacer" }).first().click();
  await expect(page.getByText("Recompensa deshecha · ●●○ 2 de 3")).toBeVisible();
  await expect.poll(async () => (await rewards()).length).toBe(0);
  expect(await openPoints()).toBe(2);

  await page.goto("/biblioteca/jardin");
  await expect(page.getByTestId("garden-progress-text")).toHaveText("2 de 3 · próxima recompensa");
  await expect(page.getByTestId("garden-inventory-empty")).toBeVisible();

  await page.goto("/tareas?abrir=f3-tercera");
  await page.getByTestId("card-complete").click();
  await expect.poll(async () => (await rewards()).length).toBe(1);
  expect((await rewards())[0].item).toBe(won.item);
});

test("capturas: inventario en el Jardín y barra en Hoy, escritorio e iPhone, claro y oscuro", async ({ page }) => {
  // estado fijo para las capturas: Agua ×3, Fertilizante ×1 y 2 de 3 en la barra
  await limpiarProgreso();
  for (const [i, item] of ["agua", "agua", "agua", "fertilizante"].entries()) {
    await run(`INSERT INTO garden_rewards (id, item, earned_at) VALUES ('f3-r${i}', '${item}', '${now}')`);
  }
  for (const id of ["f3-shot-a", "f3-shot-b"]) {
    await run(`INSERT INTO cards (id, title, completed_at, created_at, updated_at) VALUES ('${id}', '${P} ${id}', '${now}', '${now}', '${now}')`);
    await run(`INSERT INTO progress_credits (card_id, kind, credited_at) VALUES ('${id}', 'tarea', '${now}')`);
  }
  await login(page);

  for (const [vista, size] of [
    ["escritorio", { width: 1280, height: 800 }],
    ["iphone", { width: 390, height: 844 }],
  ] as const) {
    await page.setViewportSize(size);
    for (const theme of ["light", "dark"] as const) {
      const nombre = `${vista}-${theme === "light" ? "claro" : "oscuro"}`;

      await page.goto("/biblioteca/jardin");
      await tema(page, theme);
      const box = page.getByTestId("garden-rewards");
      await expect(box.getByTestId("garden-progress-text")).toHaveText("2 de 3 · próxima recompensa");
      await expect(box.getByTestId("garden-inventory-agua")).toHaveText("💧 Agua ×3");
      await expect(box.getByTestId("garden-inventory-fertilizante")).toHaveText("🌱 Fertilizante ×1");
      await expect(box.getByRole("button")).toHaveCount(0); // todavía no se usan
      await box.evaluate((el) => el.scrollIntoView({ block: "center" }));
      await shot(page, `04-jardin-${nombre}`);

      await page.goto("/");
      const mod = page.getByTestId("focus-module");
      await expect(mod.getByTestId("focus-module-rewards-text")).toHaveText("2 de 3 · próxima recompensa");
      await mod.evaluate((el) => el.scrollIntoView({ block: "center" }));
      await shot(page, `05-hoy-${nombre}`);
    }
  }
  await tema(page, "light");
});
