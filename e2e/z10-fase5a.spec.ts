import { test, expect, type Page, type Locator, type TestInfo } from "@playwright/test";
import fs from "fs";
import path from "path";

const QA_DIR = path.join(__dirname, "..", "docs", "qa", "phase-5a-reviews");
const PASSWORD = "prueba-mafer-123";

test.describe.configure({ mode: "serial" });

const t = (info: TestInfo, name: string) => `${name} Z10R${info.retry}`;

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

test("Hoy muestra el acceso compacto con UN solo aviso (semanal pendiente gana a diaria)", async ({ page }) => {
  await login(page);
  const nudge = page.getByTestId("review-nudge");
  await expect(nudge).toBeVisible();
  // ambas pendientes → el único CTA es el semanal
  await expect(nudge.getByTestId("start-semanal")).toBeVisible();
  await expect(nudge.getByTestId("start-diaria")).toHaveCount(0);
  await shot(page, "02-hoy-acceso", nudge);
  // «Haz esto ahora» sigue siendo el elemento principal
  await expect(page.getByTestId("do-now")).toBeVisible();

  await nudge.getByRole("link", { name: "Ver todo" }).click();
  await expect(page).toHaveURL(/\/revisiones/);
  await expect(page.getByTestId("center-diaria")).toBeVisible();
  await expect(page.getByTestId("center-semanal")).toBeVisible();
  await shot(page, "01-centro");
});

test("revisión diaria completa: inbox → tareas → prioridades → energía → cierre", async ({ page }, info) => {
  const captura = t(info, "Captura para la revisión");
  const vencida = t(info, "Pagar la luz");
  const ayer = new Date(Date.now() - 86_400_000).toLocaleDateString("en-CA");
  await login(page);

  // datos: una captura y una tarea vencida
  await page.goto("/inbox");
  await page.getByTestId("quickbar-input").fill(captura);
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("inbox-item").filter({ hasText: captura })).toHaveCount(1);
  await page.goto("/tareas?v=todas");
  await page.getByTestId("new-task").click();
  await page.getByTestId("new-task-title").fill(vencida);
  await page.getByTestId("new-task-more").click();
  await page.getByLabel("Fecha (opcional)").fill(ayer);
  await page.getByTestId("new-task-save").click();
  await page.getByTestId("classify-skip").click();

  // PASO 1 — Inbox
  await page.goto("/revisiones");
  await page.getByTestId("center-diaria").getByTestId("start-diaria").click();
  await expect(page.getByTestId("review-step-label")).toContainText("Paso 1 de 5");
  await expect(page.getByTestId("inbox-item").filter({ hasText: captura })).toBeVisible();
  await shot(page, "03-diaria-inbox");
  await page.getByTestId("review-next").click();

  // PASO 2 — Tareas (reprogramar la vencida)
  await expect(page.getByTestId("review-step-label")).toContainText("Paso 2 de 5");
  const fila = page.locator("div.card", { has: page.getByText(vencida, { exact: true }) }).first();
  await expect(fila).toContainText("Venció el");
  await fila.getByTestId("rt-manana").click();
  await expect(page.getByText("Reprogramada para mañana ✓").first()).toBeVisible();
  await page.getByTestId("review-next").click();

  // PASO 3 — Prioridades (cambiar si es posible)
  await expect(page.getByTestId("review-step-label")).toContainText("Paso 3 de 5");
  await expect(page.getByText("Tus 3 prioridades")).toBeVisible();
  const quitar = page.getByRole("button", { name: /^Quitar «/ });
  if ((await quitar.count()) > 0) {
    const n = await quitar.count();
    await quitar.first().click();
    await expect(quitar).toHaveCount(n - 1);
  }
  if (await page.getByTestId("pick-priority").isVisible().catch(() => false)) {
    await page.getByTestId("pick-priority").click();
    await page.getByTestId("priority-candidates").locator("button").first().click();
    await expect(page.getByText("Añadida a tus prioridades de hoy ✓").first()).toBeVisible();
  }
  await page.getByTestId("review-next").click();

  // PASO 4 — Energía
  await expect(page.getByTestId("review-step-label")).toContainText("Paso 4 de 5");
  await page.getByTestId("energy-media").click();
  await expect(page.getByText("He ajustado tus sugerencias para energía media").first()).toBeVisible();
  await page.getByTestId("review-next").click();

  // PASO 5 — Cierre
  await expect(page.getByTestId("review-step-label")).toContainText("Paso 5 de 5");
  await expect(page.getByTestId("daily-close")).toBeVisible();
  await shot(page, "04-diaria-cierre");
  await page.getByTestId("review-finish").click();
  await expect(page.getByText("Tu revisión quedó guardada.").first()).toBeVisible();
  await expect(page).toHaveURL(/\/revisiones/);
  await expect(page.getByTestId("review-history")).toContainText("diaria");
  await expect(page.getByTestId("review-history").getByText("completa").first()).toBeVisible();
  // hecha hoy: se puede repetir, pero ya no se insiste
  await expect(page.getByTestId("center-diaria")).toContainText("Hecha hoy");
});

test("salir a mitad, continuar desde Hoy y conservar el paso tras refrescar", async ({ page }) => {
  await login(page);
  await page.goto("/revisiones");
  // segunda vez el mismo día: permitido
  await page.getByTestId("center-diaria").getByTestId("start-diaria").click();
  await expect(page.getByTestId("review-step-label")).toContainText("Paso 1 de 5");
  await page.getByTestId("review-next").click();
  await expect(page.getByTestId("review-step-label")).toContainText("Paso 2 de 5");

  // salir
  await page.getByTestId("review-exit").click();
  await page.waitForURL("/");
  const nudge = page.getByTestId("review-nudge");
  await expect(nudge.getByTestId("nudge-cta")).toContainText("Continuar");
  await shot(page, "07-continuar", nudge);

  // continuar → vuelve al paso 2
  await nudge.getByTestId("nudge-cta").click();
  await expect(page.getByTestId("review-step-label")).toContainText("Paso 2 de 5");
  // refrescar conserva el paso
  await page.reload();
  await expect(page.getByTestId("review-step-label")).toContainText("Paso 2 de 5");
  // entrar sin ?paso también retoma donde iba (como al reabrir el navegador)
  await page.goto("/revisiones/diaria");
  await expect(page.getByTestId("review-step-label")).toContainText("Paso 2 de 5");
});

test("reiniciar pide confirmación y no revierte; «Dar por terminada» cierra como incompleta", async ({ page }) => {
  await login(page);
  await page.goto("/revisiones");
  await page.getByTestId("reset-diaria").click();
  await expect(page.getByText("Lo ya hecho no se revierte. ¿Reiniciar?")).toBeVisible();
  await page.getByTestId("reset-confirm-diaria").click();
  await expect(page.getByTestId("review-step-label")).toContainText("Paso 1 de 5");

  // la sesión reiniciada quedó en el historial como incompleta
  await page.goto("/revisiones");
  await expect(page.getByTestId("review-history").getByText("incompleta").first()).toBeVisible();

  // dar por terminada la nueva sesión a la mitad
  await page.getByTestId("finish-early-diaria").click();
  await expect(page.getByText("Tu revisión quedó guardada.").first()).toBeVisible();
  await expect(page.getByTestId("center-diaria").getByTestId("start-diaria")).toBeVisible();
});

test("revisión semanal completa: proyectos → tareas → incubadora → learn fast → recursos → próxima semana", async ({ page }, info) => {
  const recurso = t(info, "Guía de certificación");
  await login(page);

  // dato: un recurso pendiente (vía conversión del Inbox)
  await page.goto("/inbox");
  await page.getByTestId("quickbar-input").fill(recurso);
  await page.keyboard.press("Enter");
  const item = page.getByTestId("inbox-item").filter({ hasText: recurso });
  await item.getByTestId("inbox-process").click();
  await page.getByTestId("type-recurso").click();
  await page.getByTestId("process-submit").click();
  await expect(page.getByText("Convertido en recurso ✓").first()).toBeVisible();

  // PASO 1 — Proyectos
  await page.goto("/revisiones");
  await page.getByTestId("center-semanal").getByTestId("start-semanal").click();
  await expect(page.getByTestId("review-step-label")).toContainText("Paso 1 de 6");
  await expect(page.getByTestId("rp-mantener").first()).toBeVisible(); // hay proyectos que piden atención
  await shot(page, "05-semanal-proyectos");
  await page.getByTestId("rp-mantener").first().click(); // mantener activo (decisión válida)
  await page.getByTestId("review-next").click();

  // PASO 2 — Tareas
  await expect(page.getByTestId("review-step-label")).toContainText("Paso 2 de 6");
  await expect(page.getByTestId("rt-mantener").first()).toBeVisible();
  await page.getByTestId("rt-semana").first().click(); // reprogramar +7 días
  await expect(page.getByText("Reprogramada a la próxima semana ✓").first()).toBeVisible();
  await page.getByTestId("review-next").click();

  // PASO 3 — Incubadora (nada se convierte solo)
  await expect(page.getByTestId("review-step-label")).toContainText("Paso 3 de 6");
  await expect(page.getByTestId("ri-mantener").first()).toBeVisible();
  await page.getByTestId("ri-mantener").first().click();
  await expect(page.getByText("Sigue incubando, revisada hoy ✓").first()).toBeVisible();
  await page.getByTestId("review-next").click();

  // PASO 4 — Learn Fast (pausar o reactivar, según su estado)
  await expect(page.getByTestId("review-step-label")).toContainText("Paso 4 de 6");
  await expect(page.getByTestId("rl-abrir").first()).toBeVisible();
  if (await page.getByTestId("rl-pausar").first().isVisible().catch(() => false)) {
    await page.getByTestId("rl-pausar").first().click();
    await expect(page.getByText("Tema pausado ✓").first()).toBeVisible();
  } else {
    await page.getByTestId("rl-reactivar").first().click();
    await expect(page.getByText("Tema reactivado ✓").first()).toBeVisible();
  }
  await page.getByTestId("review-next").click();

  // PASO 5 — Recursos
  await expect(page.getByTestId("review-step-label")).toContainText("Paso 5 de 6");
  const filaRec = page.locator("div.card", { has: page.getByText(recurso) }).first();
  await filaRec.getByTestId("rr-revisado").click();
  await expect(page.getByText("Marcado como revisado ✓").first()).toBeVisible();
  await page.getByTestId("review-next").click();

  // PASO 6 — Próxima semana (nada se marca solo)
  await expect(page.getByTestId("review-step-label")).toContainText("Paso 6 de 6");
  await expect(page.getByTestId("weekly-close")).toBeVisible();
  await expect(page.getByTestId("suggested-priorities")).toContainText("tú decides");
  await shot(page, "06-semana-preparada");
  await page.getByTestId("review-finish").click();
  await expect(page.getByText("Semana preparada ✓ Tu revisión quedó guardada.").first()).toBeVisible();
  await expect(page).toHaveURL(/\/revisiones/);
  await expect(page.getByTestId("center-semanal")).toContainText("Hecha esta semana");

  // Hoy: sin avisos pendientes, solo el acceso con sus estados
  await page.goto("/");
  const nudge = page.getByTestId("review-nudge");
  await expect(nudge.getByText("Hecha hoy")).toBeVisible();
  await expect(nudge.getByText("Hecha esta semana")).toBeVisible();
  await expect(nudge.getByTestId("nudge-cta")).toHaveCount(0);
});

test("semanal: salir y continuar conserva el paso", async ({ page }) => {
  await login(page);
  await page.goto("/revisiones");
  await page.getByTestId("center-semanal").getByTestId("start-semanal").click();
  await expect(page.getByTestId("review-step-label")).toContainText("Paso 1 de 6");
  await page.getByTestId("review-next").click();
  await expect(page.getByTestId("review-step-label")).toContainText("Paso 2 de 6");
  await page.getByTestId("review-exit").click();
  await page.waitForURL("/");
  await expect(page.getByTestId("review-nudge").getByTestId("nudge-cta")).toContainText("Continuar");
  await page.getByTestId("review-nudge").getByTestId("nudge-cta").click();
  await expect(page.getByTestId("review-step-label")).toContainText("Paso 2 de 6");
  // cerrar limpio para no dejar sesión abierta
  await page.goto("/revisiones");
  await page.getByTestId("finish-early-semanal").click();
  await expect(page.getByText("Tu revisión quedó guardada.").first()).toBeVisible();
});

test("Ajustes: día preferido de la revisión semanal", async ({ page }) => {
  await login(page);
  await page.goto("/ajustes");
  await page.getByTestId("weekly-day-select").selectOption("1");
  await expect(page.getByText("Preferencia guardada ✓").first()).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("weekly-day-select")).toHaveValue("1");
  // el centro lo refleja
  await page.goto("/revisiones");
  await expect(page.getByTestId("center-semanal")).toContainText("lunes");
  // volver a «cualquier día» para no condicionar otras pruebas
  await page.goto("/ajustes");
  await page.getByTestId("weekly-day-select").selectOption("");
  await expect(page.getByText("Preferencia guardada ✓").first()).toBeVisible();
});

test("modo oscuro: el asistente de revisión es legible", async ({ page }) => {
  await login(page);
  await page.goto("/ajustes");
  await page.getByTestId("theme-dark").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.goto("/revisiones");
  await expect(page.getByTestId("center-diaria")).toBeVisible();
  await shot(page, "08-oscuro");
  await page.goto("/ajustes");
  await page.getByTestId("theme-light").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
