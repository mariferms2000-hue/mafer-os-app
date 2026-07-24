import { test, expect, type Page } from "@playwright/test";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

/** Fase 7E.3 — Explorar → Mi jardín: la vista de solo lectura del jardín.
 *  Se verifica contra la base de prueba: la planta actual con su identidad real
 *  (especie, seed, etapa, minutos), el estado vacío sereno, la cuadrícula de
 *  completadas más reciente primero con «Ver más», el SVG determinista y que
 *  Incubadora, Learn Fast, Journal e Inbox siguen intactos. Los fixtures de
 *  plantas completadas son aislados (ids z15-*) y se limpian al final. */

const QA_DIR = path.join(__dirname, "..", "docs", "qa", "phase-7e3-garden-view");
const PASSWORD = "prueba-mafer-123";
const TEST_DB = path.join(__dirname, ".test-db", "mafer-test.db");
const SPECIES = ["helecho", "monstera", "suculenta", "lavanda", "olivo"];
const SPECIES_LABEL: Record<string, string> = {
  helecho: "Helecho",
  monstera: "Monstera",
  suculenta: "Suculenta",
  lavanda: "Lavanda",
  olivo: "Olivo",
};

test.describe.configure({ mode: "serial" });

async function shot(page: Page, name: string) {
  fs.mkdirSync(QA_DIR, { recursive: true });
  await page.screenshot({ path: path.join(QA_DIR, `${name}.png`), fullPage: false });
}

/** Ejecuta SQL de lectura sobre la base de prueba y devuelve las filas. */
function q<T = Record<string, unknown>>(query: string): T[] {
  const out = execSync(
    `node --input-type=module --eval "
import Database from 'better-sqlite3';
const db = new Database(process.env.TEST_DB);
console.log('JSON<<' + JSON.stringify(db.prepare(process.env.SQL_Q).all()) + '>>JSON');
"`,
    { cwd: path.join(__dirname, ".."), env: { ...process.env, TEST_DB, SQL_Q: query } }
  ).toString();
  return JSON.parse(out.split("JSON<<")[1].split(">>JSON")[0]);
}

/** Ejecuta SQL de escritura (preparación de fixtures) sobre la base de prueba. */
function run(statement: string) {
  execSync(
    `node --input-type=module --eval "
import Database from 'better-sqlite3';
const db = new Database(process.env.TEST_DB);
db.exec(process.env.SQL_Q);
"`,
    { cwd: path.join(__dirname, ".."), env: { ...process.env, TEST_DB, SQL_Q: statement } }
  );
}

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  const confirm = page.getByLabel(/confirma/i);
  if (await confirm.count()) await confirm.fill(PASSWORD);
  await page.getByRole("button", { name: /entrar|crear|empezar/i }).click();
  await page.waitForURL("/");
}

/** Cierra como descartada cualquier sesión que otra suite haya dejado abierta. */
function discardLeftoverSessions() {
  run(
    `UPDATE focus_sessions SET finished_at = '${new Date().toISOString()}', outcome = 'descartada', credited_minutes = 0 WHERE finished_at IS NULL;`
  );
}

/** Retrasa el inicio de la fase de la sesión abierta (simula tiempo transcurrido). */
function backdateOpenSession(minutes: number) {
  const iso = new Date(Date.now() - minutes * 60_000).toISOString();
  run(`UPDATE focus_sessions SET phase_started_at = '${iso}' WHERE finished_at IS NULL;`);
}

/** Corre una sesión Arranque (5 min, sin descanso) hasta el cierre completo:
 *  hace nacer la planta actual cuando la suite corre aislada sobre base fresca. */
async function completeArranque(page: Page) {
  await page.goto("/?focus=1");
  await page.getByTestId("focus-preset-arranque").click();
  await page.getByTestId("focus-start").click();
  await expect(page.getByTestId("focus-clock")).toBeVisible();
  backdateOpenSession(6);
  await page.reload();
  await expect(page.getByTestId("focus-summary")).toContainText("Ciclo completo");
  await page.getByTestId("focus-back-app").click();
}

type PlantRow = {
  id: string;
  species: string;
  accumulated_minutes: number;
  visual_seed: number;
  renderer_version: number;
  completed_at: string | null;
};

const activePlant = () => q<PlantRow>("SELECT * FROM focus_plants WHERE completed_at IS NULL")[0];
const completedOrdered = () =>
  q<PlantRow>("SELECT * FROM focus_plants WHERE completed_at IS NOT NULL ORDER BY completed_at DESC");

/** 15 plantas completadas de fixture (ids z15-*), con identidad completa y
 *  fechas escalonadas EN EL PASADO: las reales de otras suites (más recientes)
 *  conservan su lugar al frente. Idempotente: se borra antes de insertar. */
function seedCompletedFixtures() {
  const rows: string[] = [];
  for (let i = 0; i < 15; i++) {
    const day = String(1 + i).padStart(2, "0");
    rows.push(
      `('z15-planta-${String(i + 1).padStart(2, "0")}', '${SPECIES[i % SPECIES.length]}', 150, ${1000003 * (i + 1)}, 1, NULL, NULL, '2026-05-${day}T09:00:00.000Z', '2026-06-${day}T09:00:00.000Z')`
    );
  }
  run(
    `DELETE FROM focus_plants WHERE id LIKE 'z15-%';
     INSERT INTO focus_plants (id, species, accumulated_minutes, visual_seed, renderer_version, name, note, started_at, completed_at)
     VALUES ${rows.join(",")};`
  );
}

/** Restaura cualquier respaldo pendiente (reintentos a medias) y borra fixtures:
 *  la base queda exactamente como la dejaron las suites anteriores. */
function cleanFixtures() {
  run(
    `CREATE TABLE IF NOT EXISTS _z15_respaldo AS SELECT * FROM focus_plants WHERE 0;
     INSERT INTO focus_plants SELECT * FROM _z15_respaldo WHERE id NOT IN (SELECT id FROM focus_plants);
     DROP TABLE _z15_respaldo;
     DELETE FROM focus_plants WHERE id LIKE 'z15-%';`
  );
}

test.afterAll(() => cleanFixtures());

test("la pestaña «Mi jardín» existe en Explorar y muestra la planta actual real", async ({ page }) => {
  await login(page);
  discardLeftoverSessions();
  if (!activePlant()) await completeArranque(page); // base fresca: la primera sesión hace nacer la planta

  // llegar sin escribir la URL: Explorar → pestaña Mi jardín
  await page.goto("/explorar");
  await page.getByRole("link", { name: "Mi jardín" }).click();
  await page.waitForURL("/explorar/jardin");
  await expect(page.getByRole("heading", { name: "Mi jardín" })).toBeVisible();

  // la planta actual refleja exactamente lo guardado en la base
  const plant = activePlant();
  expect(plant).toBeTruthy();
  await expect(page.getByTestId("garden-current-species")).toHaveText(SPECIES_LABEL[plant.species]);
  await expect(page.getByTestId("garden-current-progress")).toContainText(`${plant.accumulated_minutes} de `);
  const art = page.getByTestId("garden-current").locator("svg[data-species]");
  await expect(art).toHaveAttribute("data-species", plant.species);
  await expect(art).toHaveAttribute("data-seed", String(plant.visual_seed));
});

test("estado vacío sereno cuando no hay plantas completadas (con respaldo restaurado intacto)", async ({ page }) => {
  // aparta las completadas reales a una tabla de respaldo para simular el jardín
  // vacío; recovery-safe: si un intento anterior quedó a medias, primero restaura
  run(
    `CREATE TABLE IF NOT EXISTS _z15_respaldo AS SELECT * FROM focus_plants WHERE 0;
     INSERT INTO focus_plants SELECT * FROM _z15_respaldo WHERE id NOT IN (SELECT id FROM focus_plants);
     DELETE FROM _z15_respaldo;
     INSERT INTO _z15_respaldo SELECT * FROM focus_plants WHERE completed_at IS NOT NULL;
     DELETE FROM focus_plants WHERE completed_at IS NOT NULL;`
  );
  const before = q<{ n: number }>("SELECT COUNT(*) n FROM _z15_respaldo")[0].n;

  await login(page);
  await page.goto("/explorar/jardin");
  await expect(page.getByText("Tu jardín está esperando su primera planta.")).toBeVisible();
  await expect(page.getByTestId("garden-grid")).toHaveCount(0);
  await shot(page, "05-jardin-vacio-claro");

  // el estado vacío también invita a enfocarse: abre el overlay existente
  await page.getByTestId("garden-empty-focus").click();
  await expect(page.getByTestId("focus-overlay")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("focus-overlay")).toHaveCount(0);

  // restaurar fila a fila: nada se pierde por simular el vacío
  run(
    `INSERT INTO focus_plants SELECT * FROM _z15_respaldo;
     DROP TABLE _z15_respaldo;`
  );
  expect(Number(q<{ n: number }>("SELECT COUNT(*) n FROM focus_plants WHERE completed_at IS NOT NULL")[0].n)).toBe(
    Number(before)
  );
});

test("cuadrícula: más reciente primero, 12 iniciales y «Ver más» solo cuando corresponde", async ({ page }) => {
  seedCompletedFixtures();
  const all = completedOrdered();
  expect(all.length).toBeGreaterThan(12);

  await login(page);
  await page.goto("/explorar/jardin");

  // 12 primeras en orden: la más reciente encabeza la cuadrícula
  const cards = page.getByTestId("garden-plant");
  await expect(cards).toHaveCount(12);
  for (const [i, p] of all.slice(0, 12).entries()) {
    const svg = cards.nth(i).locator("svg");
    await expect(svg).toHaveAttribute("data-species", p.species);
    await expect(svg).toHaveAttribute("data-seed", String(p.visual_seed));
  }
  await expect(cards.first()).toContainText(SPECIES_LABEL[all[0].species]);
  await expect(cards.first()).toContainText("150 min de enfoque");

  // «Ver más» dice cuántas faltan, y al expandir muestra todas y desaparece
  const more = page.getByTestId("garden-more");
  await expect(more).toContainText(`(${all.length - 12} restantes)`);
  await more.click();
  await expect(cards).toHaveCount(all.length);
  await expect(page.getByTestId("garden-more")).toHaveCount(0);
});

test("el SVG es determinista: recargar produce exactamente los mismos trazos", async ({ page }) => {
  await login(page);
  await page.goto("/explorar/jardin");
  const firstCardSvg = () => page.getByTestId("garden-plant").first().locator("svg").innerHTML();
  const currentSvg = () => page.getByTestId("garden-current").locator("svg[data-species]").innerHTML();

  const [card1, cur1] = [await firstCardSvg(), await currentSvg()];
  await page.reload();
  await expect(page.getByTestId("garden-plant").first()).toBeVisible();
  expect(await firstCardSvg()).toBe(card1);
  expect(await currentSvg()).toBe(cur1);
});

test("«Enfocarme» abre el overlay existente; cerrarlo devuelve al jardín sin tocar nada", async ({ page }) => {
  await login(page);
  await page.goto("/explorar/jardin");
  // «Enfocarme» vive dentro de la tarjeta clickeable de la planta actual: el clic
  // no debe burbujear y abrir también el popup de detalle de la planta.
  await page.getByTestId("garden-focus").click();
  await expect(page.getByTestId("focus-overlay")).toBeVisible();
  expect(page.url()).toContain("focus=1");
  await expect(page.getByTestId("plant-detail-modal")).toHaveCount(0);

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("focus-overlay")).toHaveCount(0);
  expect(page.url()).toContain("/explorar/jardin");
  await expect(page.getByTestId("garden-current")).toBeVisible();
  await expect(page.getByTestId("plant-detail-modal")).toHaveCount(0);
});

test("desde Hoy: el enlace discreto «Ver mi jardín» llega a la vista, con y sin sesión", async ({ page }) => {
  await login(page);
  const link = page.getByTestId("focus-module-garden-link");
  await expect(link).toContainText(/jardín/i);
  await link.click();
  await page.waitForURL("/explorar/jardin");
  await expect(page.getByRole("heading", { name: "Mi jardín" })).toBeVisible();

  // con sesión activa, el módulo «En foco» conserva el enlace (la base real tiene
  // una sesión abierta: sin esto, el jardín quedaría inalcanzable desde Hoy)
  await page.getByTestId("garden-focus").click();
  await page.getByTestId("focus-preset-arranque").click();
  await page.getByTestId("focus-start").click();
  await expect(page.getByTestId("focus-clock")).toBeVisible();
  await page.getByTestId("focus-close").click();
  await page.goto("/");
  await expect(page.getByTestId("focus-module")).toContainText("En foco");
  await page.getByTestId("focus-module-garden-link").click();
  await page.waitForURL("/explorar/jardin");

  // terminar antes desde el overlay: la base queda sin sesiones abiertas
  await page.getByTestId("garden-focus").click();
  await expect(page.getByTestId("focus-clock")).toBeVisible();
  await page.getByTestId("focus-end-early").click();
  await expect(page.getByTestId("focus-summary")).toBeVisible();
  await page.getByTestId("focus-back-app").click();
  await expect(page.getByTestId("focus-overlay")).toHaveCount(0);
});

test("Incubadora, Learn Fast, Journal e Inbox siguen intactos", async ({ page }) => {
  await login(page);
  await page.goto("/explorar");
  await expect(page.getByRole("heading", { name: /incubadora/i })).toBeVisible();
  await page.goto("/explorar/learn-fast");
  await expect(page.getByRole("heading", { name: /learn fast/i })).toBeVisible();
  await page.goto("/explorar/journal");
  await expect(page.getByRole("heading", { name: /journal/i })).toBeVisible();
  await page.goto("/inbox");
  await expect(page.getByRole("heading", { name: /inbox/i })).toBeVisible();
  await expect(page.getByTestId("capture-fab")).toBeVisible();
});

test("capturas: oscuro en escritorio y iPhone", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("mafer-theme", "dark"));
  await login(page);
  await page.goto("/explorar/jardin");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByTestId("garden-plant").first()).toBeVisible();
  await page.waitForTimeout(400);
  await shot(page, "01-jardin-oscuro");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByTestId("garden-current")).toBeVisible();
  await page.waitForTimeout(400);
  await shot(page, "03-jardin-iphone-oscuro");
});

test("capturas: claro (jardín y enlace desde Hoy)", async ({ page }) => {
  await login(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.goto("/explorar/jardin");
  await expect(page.getByTestId("garden-plant").first()).toBeVisible();
  await page.waitForTimeout(400);
  await shot(page, "02-jardin-claro");

  // Hoy con el enlace discreto visible, en claro
  await page.goto("/");
  await expect(page.getByTestId("focus-module-garden-link")).toBeVisible();
  await page.waitForTimeout(400);
  await shot(page, "04-hoy-enlace-jardin-claro");
});
