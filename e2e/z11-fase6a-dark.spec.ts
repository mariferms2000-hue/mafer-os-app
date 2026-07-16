import { test, expect, type Page, type Locator } from "@playwright/test";
import fs from "fs";
import path from "path";

const QA_DIR = path.join(__dirname, "..", "docs", "qa", "phase-6a-dark-system");
const PASSWORD = "prueba-mafer-123";

// Valores esperados de los tokens oscuros (globals.css) — si cambian los tokens,
// cambia aquí también (y en tests/contrast.test.ts, que valida los ratios WCAG).
const DARK_BG = "rgb(13, 16, 12)"; // --color-cream oscuro #0d100c (Fase 6B: carbón)
const DARK_SURFACE = "rgb(21, 26, 19)"; // --color-paper oscuro #151a13
const DARK_RAISED = "rgb(28, 35, 24)"; // --color-raised oscuro #1c2318
const DARK_SIDEBAR = "rgb(10, 12, 8)"; // --color-sidebar oscuro #0a0c08
const CHIP_ON_BG = "rgb(147, 175, 128)"; // --color-chip-on-bg oscuro #93af80
const CHIP_ON_FG = "rgb(19, 26, 14)"; // --color-chip-on-fg oscuro #131a0e
const LIGHT_BG = "rgb(247, 244, 238)"; // --color-cream claro #f7f4ee (Fase 6C: marfil limpio)

test.describe.configure({ mode: "serial" });

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

/** Entra con el tema oscuro ya persistido (como quien abre la app directamente en oscuro). */
async function loginDark(page: Page) {
  await page.addInitScript(() => localStorage.setItem("mafer-theme", "dark"));
  await login(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
}

const bodyBg = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test("barrido oscuro: todas las secciones usan el fondo bosque casi negro (capturas)", async ({ page }) => {
  await loginDark(page);

  const rutas: [string, string][] = [
    ["/", "01-hoy-oscuro"],
    ["/inbox", "02-inbox-oscuro"],
    ["/tareas", "03-tareas-oscuro"],
    ["/proyectos", "04-proyectos-oscuro"],
    ["/revisiones", "06-revisiones-oscuro"],
    ["/biblioteca", "07-biblioteca-oscuro"],
    ["/ajustes", "08-ajustes-oscuro"],
  ];
  for (const [ruta, captura] of rutas) {
    await page.goto(ruta);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await bodyBg(page), `fondo de ${ruta}`).toBe(DARK_BG);
    await shot(page, captura);
  }
});

test("tres niveles de profundidad: fondo, tarjeta y modal elevado son distintos", async ({ page }) => {
  await loginDark(page);

  // Nivel 1 vs nivel 2: el fondo y las tarjetas no son el mismo plano
  expect(await bodyBg(page)).toBe(DARK_BG);
  // ojo: en Hoy el primer .card es «Haz esto ahora», que vive en el nivel 3
  const card = page.locator(".card:not(.card-raised)").first();
  const cardBg = await card.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(cardBg).toBe(DARK_SURFACE);

  // «Haz esto ahora» vive en el nivel 3 con glow discreto
  const doNow = page.getByTestId("do-now");
  await expect(doNow).toBeVisible();
  const doNowCss = await doNow.evaluate((el) => {
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, shadow: s.boxShadow };
  });
  expect(doNowCss.bg).toBe(DARK_RAISED);
  expect(doNowCss.shadow).not.toBe("none");

  // Los modales también son nivel 3
  await page.goto("/tareas");
  await page.getByTestId("new-task").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const dialogBg = await dialog.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(dialogBg).toBe(DARK_RAISED);

  // El velo detrás oscurece (no es un velo lechoso claro)
  const overlay = page.locator(".overlay-screen").first();
  const overlayBg = await overlay.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(overlayBg).toContain("rgba(4, 6, 3");
});

test("sidebar oscura con superficie propia e ítem activo distinguible", async ({ page }) => {
  await loginDark(page);

  const aside = page.locator("aside");
  const asideBg = await aside.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(asideBg).toBe(DARK_SIDEBAR);

  // El ítem activo (Hoy) tiene fondo propio + acento lateral; los inactivos no
  const activo = aside.locator(".nav-active");
  await expect(activo).toHaveCount(1);
  const activoCss = await activo.evaluate((el) => {
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, shadow: s.boxShadow };
  });
  expect(activoCss.bg).not.toBe(asideBg);
  expect(activoCss.shadow).toContain("inset");

  await page.goto("/tareas");
  await expect(aside.locator(".nav-active")).toHaveText(/Tareas/);
});

test("chips y filtros activos legibles en oscuro (verde luminoso + texto oscuro)", async ({ page }) => {
  await loginDark(page);
  await page.goto("/tareas");

  const activo = page.getByTestId("view-ahora");
  await expect(activo).toHaveAttribute("aria-pressed", "true");
  const css = await activo.evaluate((el) => {
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, fg: s.color };
  });
  expect(css.bg).toBe(CHIP_ON_BG);
  expect(css.fg).toBe(CHIP_ON_FG);

  // el resto de vistas no compiten (siguen siendo discretas)
  const inactivo = page.getByTestId("view-hoy");
  expect(await inactivo.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(CHIP_ON_BG);
});

test("abrir directamente en oscuro: sin flash blanco y meta theme-color coherente", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("mafer-theme", "dark"));
  await page.goto("/login", { waitUntil: "commit" });
  // apenas hay documento, el tema ya está aplicado (script inline en <head>)
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const meta = await page.evaluate(
    () => document.querySelector('meta[name="theme-color"]')?.getAttribute("content") ?? null
  );
  expect(meta).toBe("#0d100c"); // Fase 6B: carbón casi negro
  await page.waitForLoadState("load");
  expect(await bodyBg(page)).toBe(DARK_BG);
});

test("modo automático sigue al sistema y sobrevive al refresh", async ({ page }) => {
  await login(page);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/ajustes");
  await page.getByTestId("theme-auto").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await bodyBg(page)).toBe(DARK_BG);

  // el sistema cambia a claro → la app le sigue
  await page.emulateMedia({ colorScheme: "light" });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await bodyBg(page)).toBe(LIGHT_BG);

  // de vuelta a oscuro + refresh: persiste sin pasar por blanco
  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await bodyBg(page)).toBe(DARK_BG);
});

test("detalle de tarea en oscuro: modal elevado y legible (captura)", async ({ page }, info) => {
  const titulo = `Tarea oscura Z11R${info.retry}`;
  await loginDark(page);
  await page.goto("/tareas?v=todas");
  await page.getByTestId("new-task").click();
  await page.getByTestId("new-task-title").fill(titulo);
  await page.getByTestId("new-task-save").click();
  await page.getByTestId("classify-skip").click();

  await page.getByText(titulo, { exact: true }).first().click();
  const detalle = page.getByTestId("card-detail");
  await expect(detalle).toBeVisible();
  expect(await detalle.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(DARK_RAISED);
  await shot(page, "05-detalle-tarea-oscuro");
  await page.getByTestId("card-cancel").click();

  // limpieza: eliminarla para no ensuciar corridas siguientes
  await page.getByText(titulo, { exact: true }).first().click();
  await page.getByTestId("card-delete").click();
  await page.getByTestId("card-delete-confirm").click();
  await expect(page.getByText(titulo, { exact: true })).toHaveCount(0);
});

test("modo claro intacto (comparación) e iPad en oscuro (capturas)", async ({ page }) => {
  // claro: la identidad aprobada no cambia
  await login(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await bodyBg(page)).toBe(LIGHT_BG);
  // tarjeta normal (el primer .card de Hoy es el hero, que vive en el nivel elevado)
  const chip = page.locator(".card:not(.card-raised)").first();
  expect(await chip.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(255, 254, 251)");
  await shot(page, "09-hoy-claro-comparacion");

  // iPad (1024×1366) en oscuro
  await page.setViewportSize({ width: 1024, height: 1366 });
  await page.goto("/ajustes");
  await page.getByTestId("theme-dark").click();
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await bodyBg(page)).toBe(DARK_BG);
  await shot(page, "10-ipad-oscuro");

  // dejar el tema en claro para el resto de suites
  await page.goto("/ajustes");
  await page.getByTestId("theme-light").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
