import { test, expect, type Page } from "@playwright/test";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

/** Fase 7C — overlay mínimo de Focus Garden (?focus=1).
 *  El tiempo real se simula retrasando phase_started_at en la base de prueba
 *  (la fuente de verdad son los timestamps, así que el motor lo recupera solo). */

const QA_DIR = path.join(__dirname, "..", "docs", "qa", "phase-7c-focus-overlay");
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
  // primera vez sobre una base fresca: el login pide confirmación
  const confirm = page.getByLabel(/confirma/i);
  if (await confirm.count()) await confirm.fill(PASSWORD);
  await page.getByRole("button", { name: /entrar|crear|empezar/i }).click();
  await page.waitForURL("/");
}

/** Retrasa el inicio de la fase actual N minutos (como si el tiempo hubiera pasado). */
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

async function discardOpen(page: Page) {
  await page.getByTestId("focus-discard").click();
  await page.getByTestId("focus-discard-confirm").click();
  await expect(page.getByTestId("focus-summary")).toBeVisible();
}

test("abrir con ?focus=1: estado listo, cerrar y volver a abrir sin perder nada", async ({ page }) => {
  await login(page);
  await page.goto("/?focus=1");
  const overlay = page.getByTestId("focus-overlay");
  await expect(overlay).toBeVisible();
  await expect(overlay).toContainText("Jardín de enfoque");
  await expect(page.getByTestId("focus-task")).toContainText("Enfoque libre");
  await expect(page.getByTestId("focus-preset-pomodoro")).toBeVisible();
  await expect(overlay.locator("[data-stage='semilla']")).toBeVisible();

  // cerrar visualmente limpia la URL; reabrir funciona
  await page.getByTestId("focus-close").click();
  await expect(page.getByTestId("focus-overlay")).toHaveCount(0);
  expect(page.url()).not.toContain("focus=1");
  await page.goto("/?focus=1");
  await expect(page.getByTestId("focus-overlay")).toBeVisible();
});

test("cada preset inicia con su duración planeada", async ({ page }) => {
  await login(page);
  await page.goto("/?focus=1");
  const casos: [string, RegExp][] = [
    ["arranque", /^[45]:\d{2}$/],
    ["ligero", /^1[45]:\d{2}$/],
    ["pomodoro", /^2[45]:\d{2}$/],
    ["profundo", /^4[45]:\d{2}$/],
  ];
  for (const [preset, re] of casos) {
    await page.getByTestId(`focus-preset-${preset}`).click();
    await page.getByTestId("focus-start").click();
    await expect(page.getByTestId("focus-clock")).toHaveText(re);
    await discardOpen(page);
    await page.getByTestId("focus-another").click();
    await expect(page.getByTestId("focus-start")).toBeVisible();
  }
});

test("personalizado: inválido se acota a [5, 90] y válido inicia", async ({ page }) => {
  await login(page);
  await page.goto("/?focus=1");
  await page.getByTestId("focus-preset-personalizado").click();
  const input = page.getByTestId("focus-custom-min");
  await input.fill("200");
  await input.blur();
  await expect(input).toHaveValue("90");
  await input.fill("1");
  await input.blur();
  await expect(input).toHaveValue("5");

  await input.fill("30");
  await page.getByTestId("focus-custom-break").check();
  await page.getByTestId("focus-start").click();
  await expect(page.getByTestId("focus-clock")).toHaveText(/^(30:00|29:5\d)$/);
  await discardOpen(page);
  await page.getByTestId("focus-another").click();
});

test("pausar congela el contador y reanudar continúa; terminar antes conserva minutos", async ({ page }) => {
  await login(page);
  await page.goto("/?focus=1");
  await page.getByTestId("focus-preset-pomodoro").click();
  await page.getByTestId("focus-start").click();
  await expect(page.getByTestId("focus-clock")).toBeVisible();

  await page.getByTestId("focus-pause").click();
  await expect(page.getByTestId("focus-phrase")).toContainText("está bien parar");
  const frozen = await page.getByTestId("focus-clock").textContent();
  await page.waitForTimeout(1500);
  await expect(page.getByTestId("focus-clock")).toHaveText(frozen!);

  await page.getByTestId("focus-resume").click();
  await expect(page.getByTestId("focus-phrase")).toContainText("Una cosa a la vez");

  await page.getByTestId("focus-end-early").click();
  await expect(page.getByTestId("focus-summary")).toBeVisible();
  await expect(page.getByTestId("focus-summary")).toContainText("Sesión guardada");
  await expect(page.getByTestId("focus-credited")).toContainText(/\d+ min de enfoque abonados/);
  await page.getByTestId("focus-back-app").click();
  await expect(page.getByTestId("focus-overlay")).toHaveCount(0);
});

test("recarga durante la sesión: recupera desde timestamps y acredita lo real al terminar antes", async ({ page }) => {
  await login(page);
  await page.goto("/?focus=1");
  await page.getByTestId("focus-preset-pomodoro").click();
  await page.getByTestId("focus-start").click();
  await expect(page.getByTestId("focus-clock")).toBeVisible();

  // como si hubieran pasado 10 minutos con Safari cerrado
  backdateOpenSession(10);
  await page.reload();
  await expect(page.getByTestId("focus-overlay")).toBeVisible();
  await expect(page.getByTestId("focus-clock")).toHaveText(/^1[45]:\d{2}$/); // ~15:00 restantes

  await page.getByTestId("focus-end-early").click();
  await expect(page.getByTestId("focus-credited")).toContainText(/(10|11) min de enfoque abonados/);
  await page.getByTestId("focus-back-app").click();
});

test("bloque expirado con el navegador cerrado: estado honesto, descanso y saltar", async ({ page }) => {
  await login(page);
  await page.goto("/?focus=1");
  await page.getByTestId("focus-preset-pomodoro").click();
  await page.getByTestId("focus-start").click();
  await expect(page.getByTestId("focus-clock")).toBeVisible();

  backdateOpenSession(40); // más que los 25 planeados
  await page.reload();
  // honesto: «enfoque listo», acreditando SOLO lo planeado
  await expect(page.getByTestId("focus-done-minutes")).toContainText("25 minutos de enfoque");

  // iniciar el descanso y luego saltarlo cierra el ciclo
  await page.getByTestId("focus-start-break").click();
  await expect(page.getByTestId("focus-clock")).toHaveText(/^[45]:\d{2}$/);
  await expect(page.getByTestId("focus-phrase")).toContainText("Respira");
  await page.getByTestId("focus-skip-break").click();
  await expect(page.getByTestId("focus-summary")).toContainText("Ciclo completo");
  await expect(page.getByTestId("focus-credited")).toContainText("25 min de enfoque abonados");
  // 10-11 del test anterior + 25 = ≥35 acumulados → la planta ya es brote
  await expect(page.getByTestId("focus-summary")).toContainText("Brote");
  await page.getByTestId("focus-back-app").click();
});

test("Arranque (sin descanso) cierra el ciclo completo directamente", async ({ page }) => {
  await login(page);
  await page.goto("/?focus=1");
  await page.getByTestId("focus-preset-arranque").click();
  await page.getByTestId("focus-start").click();
  await expect(page.getByTestId("focus-clock")).toBeVisible();
  backdateOpenSession(6);
  await page.reload();
  await expect(page.getByTestId("focus-summary")).toContainText("Ciclo completo");
  await expect(page.getByTestId("focus-credited")).toContainText("5 min de enfoque abonados");
  await page.getByTestId("focus-back-app").click();
});

test("cerrar el overlay no termina la sesión; Escape también cierra sin cancelar", async ({ page }) => {
  await login(page);
  await page.goto("/?focus=1");
  await page.getByTestId("focus-preset-ligero").click();
  await page.getByTestId("focus-start").click();
  await expect(page.getByTestId("focus-clock")).toBeVisible();

  // cerrar con la X: la sesión sigue viva
  await page.getByTestId("focus-close").click();
  await expect(page.getByTestId("focus-overlay")).toHaveCount(0);
  await page.goto("/?focus=1");
  await expect(page.getByTestId("focus-clock")).toHaveText(/^1[45]:\d{2}$/);

  // Escape: cierra visualmente, la sesión continúa
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("focus-overlay")).toHaveCount(0);
  await page.goto("/?focus=1");
  await expect(page.getByTestId("focus-clock")).toBeVisible();

  await discardOpen(page);
  await page.getByTestId("focus-back-app").click();
});

test("navegación por teclado: el foco queda dentro del diálogo", async ({ page }) => {
  await login(page);
  await page.goto("/?focus=1");
  await expect(page.getByTestId("focus-overlay")).toBeVisible();

  // recorrer con Tab más veces que botones visibles: el foco nunca sale
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press("Tab");
    const inside = await page.evaluate(() => {
      const dialog = document.querySelector('[data-testid="focus-overlay"]');
      return dialog ? dialog.contains(document.activeElement) : false;
    });
    expect(inside, `Tab #${i + 1} se salió del diálogo`).toBe(true);
  }
  // y se puede empezar con Enter desde el botón primario
  await page.getByTestId("focus-start").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("focus-clock")).toBeVisible();
  await discardOpen(page);
  await page.getByTestId("focus-back-app").click();
});

test("capturas: oscuro (listo, enfoque, pausado, completado)", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("mafer-theme", "dark"));
  await login(page);
  await page.goto("/?focus=1");
  await expect(page.getByTestId("focus-overlay")).toBeVisible();
  await page.waitForTimeout(300);
  await shot(page, "01-listo-oscuro");

  await page.getByTestId("focus-preset-pomodoro").click();
  await page.getByTestId("focus-start").click();
  await expect(page.getByTestId("focus-clock")).toBeVisible();
  await page.waitForTimeout(300);
  await shot(page, "02-enfoque-oscuro");

  await page.getByTestId("focus-pause").click();
  await expect(page.getByTestId("focus-phrase")).toContainText("está bien parar");
  await shot(page, "03-pausado-oscuro");
  await page.getByTestId("focus-resume").click();

  backdateOpenSession(30);
  await page.reload();
  await expect(page.getByTestId("focus-done-minutes")).toBeVisible();
  await page.waitForTimeout(300);
  await shot(page, "04-completado-oscuro");
  await page.getByTestId("focus-skip-break").click();
  await expect(page.getByTestId("focus-summary")).toBeVisible();
  await page.waitForTimeout(300);
  await shot(page, "07-cierre-oscuro");
  await page.getByTestId("focus-back-app").click();
});

test("capturas: claro (listo, enfoque) — el tema por defecto", async ({ page }) => {
  await login(page);
  await page.goto("/?focus=1");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.getByTestId("focus-overlay")).toBeVisible();
  await page.waitForTimeout(300);
  await shot(page, "05-listo-claro");
  await page.getByTestId("focus-preset-ligero").click();
  await page.getByTestId("focus-start").click();
  await expect(page.getByTestId("focus-clock")).toBeVisible();
  await page.waitForTimeout(300);
  await shot(page, "06-enfoque-claro");
  await discardOpen(page);
  await page.getByTestId("focus-back-app").click();
});
