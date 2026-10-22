import { test, expect, type Page } from "@playwright/test";
import { run, q } from "./lib/test-db";
import { PASSWORD } from "./lib/credentials";

/* Pomodoro (oct 2026): el contador llega a 0:00 CON EL OVERLAY ABIERTO.
 * Error real: al acabar el enfoque, la app pedía «completar-enfoque», pero el
 * servidor ya había recuperado la sesión a «enfoque-listo» y rechazaba la
 * acción; la pantalla se quedaba en 0:00 y el siguiente botón mostraba
 * «Algo salió mal». Las pruebas de 7C solo cubrían el caso con la app cerrada
 * (recarga), no la cuenta regresiva en vivo. */

test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const TAREA = "POMODORO E2E Tarea vinculada";
const CARD_ID = "pomo-e2e-card";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  // sobre una base recién vaciada, el primer acceso pide confirmar la contraseña
  const confirm = page.getByLabel(/confirma/i);
  if (await confirm.count()) await confirm.fill(PASSWORD);
  await page.getByRole("button", { name: /entrar|crear|empezar/i }).click();
  await page.waitForURL("/");
}

/** Deja la fase actual a `secondsLeft` segundos de terminar y recarga: la cuenta
 *  regresiva llega a cero EN VIVO, con el overlay abierto. */
async function almostDone(page: Page, plannedMin: number, secondsLeft: number) {
  const iso = new Date(Date.now() - (plannedMin * 60 - secondsLeft) * 1000).toISOString();
  await run(`UPDATE focus_sessions SET phase_started_at = '${iso}' WHERE finished_at IS NULL`);
  await page.reload();
  await expect(page.getByTestId("focus-clock")).toBeVisible();
}

async function sinSesionAbierta() {
  await run(`UPDATE focus_sessions SET finished_at = '${new Date().toISOString()}', outcome = 'descartada', credited_minutes = 0 WHERE finished_at IS NULL`);
}

test.beforeAll(async () => {
  await sinSesionAbierta();
  const now = new Date().toISOString();
  await run(`DELETE FROM cards WHERE id = '${CARD_ID}'`);
  await run(`INSERT INTO cards (id, title, created_at, updated_at) VALUES ('${CARD_ID}', '${TAREA}', '${now}', '${now}')`);
});

test.afterAll(async () => {
  await sinSesionAbierta();
});

test("enfoque → 0:00 en vivo → descanso → 0:00 en vivo → ciclo completo, sin errores ni duplicados", async ({ page }) => {
  const errores: string[] = [];
  page.on("pageerror", (e) => errores.push(e.message));

  await login(page);
  const planta = await q<{ id: string; accumulated_minutes: number }>(
    "SELECT id, accumulated_minutes FROM focus_plants WHERE completed_at IS NULL LIMIT 1"
  );
  const antes = planta[0]?.accumulated_minutes ?? 0;

  await page.goto(`/?focus=1&ftarea=${CARD_ID}`);
  await page.getByTestId("focus-preset-pomodoro").click();
  await page.getByTestId("focus-start").click();
  await expect(page.getByTestId("focus-clock")).toBeVisible();
  await expect(page.getByTestId("focus-task")).toContainText(TAREA);

  // 1) el enfoque termina con el overlay abierto
  await almostDone(page, 25, 8);
  await expect(page.getByTestId("focus-done-minutes")).toContainText("25 minutos de enfoque", { timeout: 20_000 });

  // 2) «Descansar 5 min»
  await page.getByTestId("focus-start-break").click();
  await expect(page.getByTestId("focus-phrase")).toContainText("Respira");
  await expect(page.getByText("Algo salió mal")).toHaveCount(0);

  // 3) el descanso también termina en vivo y cierra el ciclo
  await almostDone(page, 5, 8);
  await expect(page.getByTestId("focus-summary")).toContainText("Ciclo completo", { timeout: 20_000 });
  await expect(page.getByTestId("focus-credited")).toContainText("25 min de enfoque abonados");

  // una sola sesión, con la tarea y los minutos justos; el jardín recibió 25 exactos
  const sesiones = await q<{ id: string; card_id: string; outcome: string; credited_minutes: number }>(
    `SELECT id, card_id, outcome, credited_minutes FROM focus_sessions WHERE card_id = '${CARD_ID}'`
  );
  expect(sesiones).toHaveLength(1);
  expect(sesiones[0]).toMatchObject({ card_id: CARD_ID, outcome: "completa", credited_minutes: 25 });
  const asign = await q<{ total: string }>(
    `SELECT COALESCE(SUM(credited_minutes), 0)::text AS total FROM focus_session_plant_allocations WHERE session_id = '${sesiones[0].id}'`
  );
  expect(Number(asign[0].total)).toBe(25);
  const despues = await q<{ total: string }>(
    `SELECT COALESCE(SUM(accumulated_minutes), 0)::text AS total FROM focus_plants WHERE id = '${planta[0]?.id ?? ""}' OR completed_at IS NULL`
  );
  expect(Number(despues[0].total)).toBe(antes + 25);

  // 4) siguiente ciclo: la tarea sigue elegida y empieza un enfoque nuevo
  await page.getByTestId("focus-task-continue").click();
  await page.getByTestId("focus-another").click();
  await page.getByTestId("focus-preset-pomodoro").click();
  await page.getByTestId("focus-start").click();
  await expect(page.getByTestId("focus-clock")).toHaveText(/^2[45]:\d{2}$/);
  await expect(page.getByTestId("focus-task")).toContainText(TAREA);

  expect(errores).toEqual([]);
});

test("pulsar Pausar o Terminar antes justo cuando el bloque ya terminó no rompe la pantalla", async ({ page }) => {
  await login(page);
  await page.goto(`/?focus=1`);
  await expect(page.getByTestId("focus-clock")).toBeVisible(); // la sesión del ciclo anterior sigue abierta
  // el tiempo se agotó en el servidor, pero la pantalla aún no se enteró
  const iso = new Date(Date.now() - 26 * 60_000).toISOString();
  await run(`UPDATE focus_sessions SET phase_started_at = '${iso}' WHERE finished_at IS NULL`);
  await page.getByTestId("focus-pause").click();
  await expect(page.getByTestId("focus-done-minutes")).toContainText("25 minutos de enfoque");
  await expect(page.getByText("Algo salió mal")).toHaveCount(0);

  // saltar el descanso cierra el ciclo una sola vez
  await page.getByTestId("focus-skip-break").click();
  await expect(page.getByTestId("focus-summary")).toContainText("Ciclo completo");
  const abiertas = await q("SELECT id FROM focus_sessions WHERE finished_at IS NULL");
  expect(abiertas).toHaveLength(0);
});

test("descanso en pausa → Terminar descanso cierra el ciclo", async ({ page }) => {
  await login(page);
  await page.goto(`/?focus=1`);
  await page.getByTestId("focus-preset-ligero").click();
  await page.getByTestId("focus-start").click();
  await expect(page.getByTestId("focus-clock")).toBeVisible();
  await almostDone(page, 15, 8);
  await expect(page.getByTestId("focus-done-minutes")).toContainText("15 minutos de enfoque", { timeout: 20_000 });
  await page.getByTestId("focus-start-break").click();
  await page.getByTestId("focus-pause").click();
  await expect(page.getByTestId("focus-phrase")).toContainText("Descanso en pausa");
  await page.getByTestId("focus-end-break").click();
  await expect(page.getByTestId("focus-summary")).toContainText("Ciclo completo");
  await expect(page.getByTestId("focus-credited")).toContainText("15 min de enfoque abonados");
});
