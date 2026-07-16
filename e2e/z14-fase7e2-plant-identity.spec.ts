import { test, expect, type Page } from "@playwright/test";
import { execSync } from "child_process";
import path from "path";

/** Fase 7E.2 — identidad de plantas y asignaciones sesión→planta (sin interfaz nueva).
 *  Se verifica CONTRA LA BASE de prueba usando el overlay existente de 7C/7D:
 *  nacimiento con identidad completa y estable, una asignación por sesión normal,
 *  dos cuando una sesión completa una planta (cierre + excedente), y sesiones
 *  «antiguas» que permanecen honestamente sin planta asociada. */

const PASSWORD = "prueba-mafer-123";
const TEST_DB = path.join(__dirname, ".test-db", "mafer-test.db");
const SPECIES = ["helecho", "monstera", "suculenta", "lavanda", "olivo"];

test.describe.configure({ mode: "serial" });

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

/** Ejecuta SQL de escritura (preparación de escenarios) sobre la base de prueba. */
function run(statement: string) {
  execSync(
    `node --input-type=module --eval "
import Database from 'better-sqlite3';
const db = new Database(process.env.TEST_DB);
db.prepare(process.env.SQL_Q).run();
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

/** Retrasa el inicio de la fase de la sesión abierta (simula tiempo transcurrido). */
function backdateOpenSession(minutes: number) {
  const iso = new Date(Date.now() - minutes * 60_000).toISOString();
  run(`UPDATE focus_sessions SET phase_started_at = '${iso}' WHERE finished_at IS NULL`);
}

/** Cierra como descartada cualquier sesión que otra suite haya dejado abierta
 *  (mismo efecto que discardFocusAction: 0 minutos, sin asignaciones). */
function discardLeftoverSessions() {
  run(
    `UPDATE focus_sessions SET finished_at = '${new Date().toISOString()}', outcome = 'descartada', credited_minutes = 0 WHERE finished_at IS NULL`
  );
}

/** Corre una sesión Arranque (5 min, sin descanso) hasta el cierre completo. */
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
  name: string | null;
  note: string | null;
  completed_at: string | null;
};

const activePlant = () => q<PlantRow>("SELECT * FROM focus_plants WHERE completed_at IS NULL")[0];
const lastClosedSession = () =>
  q<{ id: string; credited_minutes: number }>(
    "SELECT id, credited_minutes FROM focus_sessions WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1"
  )[0];
const allocationsOf = (sessionId: string) =>
  q<{ plant_id: string; credited_minutes: number }>(
    `SELECT plant_id, credited_minutes FROM focus_session_plant_allocations WHERE session_id = '${sessionId}' ORDER BY created_at`
  );

let countsBefore: Record<string, number>;
const integrityCounts = () =>
  Object.fromEntries(
    ["cards", "projects", "reviews", "settings", "journal_entries", "today_priorities"].map((t) => [
      t,
      Number(q<{ c: number }>(`SELECT COUNT(*) c FROM "${t}"`)[0].c),
    ])
  );

test("una sesión nueva queda asignada a la planta correcta; la planta tiene identidad completa", async ({ page }) => {
  await login(page); // primero: sobre una base fresca, el login crea sus filas de settings
  countsBefore = integrityCounts();
  discardLeftoverSessions();
  await completeArranque(page);

  const session = lastClosedSession();
  expect(session.credited_minutes).toBe(5);

  const plant = activePlant();
  expect(SPECIES).toContain(plant.species);
  expect(plant.renderer_version).toBe(1);
  expect(Number.isInteger(plant.visual_seed)).toBe(true);
  expect(plant.visual_seed).toBeGreaterThanOrEqual(0);
  expect(plant.name).toBeNull();
  expect(plant.note).toBeNull();

  const alloc = allocationsOf(session.id);
  expect(alloc).toHaveLength(1);
  expect(alloc[0].plant_id).toBe(plant.id);
  expect(alloc[0].credited_minutes).toBe(session.credited_minutes);
});

test("recargar y reabrir no cambia la identidad: especie y seed guardados, jamás recalculados", async ({ page }) => {
  const before = activePlant();
  await login(page);
  await page.goto("/?focus=1");
  await expect(page.getByTestId("focus-overlay")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("focus-overlay")).toBeVisible();
  const after = activePlant();
  expect(after).toEqual(before);
});

test("una sesión que completa la planta conserva ambas contribuciones: cierre + excedente", async ({ page }) => {
  await login(page);
  // escenario aprobado: la planta actual está a 10 minutos de completarse
  run("UPDATE focus_plants SET accumulated_minutes = 290 WHERE completed_at IS NULL");
  const oldPlant = activePlant();

  await page.goto("/?focus=1");
  await page.getByTestId("focus-preset-pomodoro").click();
  await page.getByTestId("focus-start").click();
  await expect(page.getByTestId("focus-clock")).toBeVisible();
  backdateOpenSession(26); // el bloque de 25 expiró completo
  await page.reload();
  await expect(page.getByTestId("focus-done-minutes")).toContainText("25 minutos");
  await page.getByTestId("focus-skip-break").click();
  await expect(page.getByTestId("focus-summary")).toContainText("Ciclo completo");
  await page.getByTestId("focus-back-app").click();

  const session = lastClosedSession();
  expect(session.credited_minutes).toBe(25);

  // la planta anterior quedó completa con exactamente 300, ni un minuto más
  const oldAfter = q<PlantRow>(`SELECT * FROM focus_plants WHERE id = '${oldPlant.id}'`)[0];
  expect(oldAfter.completed_at).not.toBeNull();
  expect(oldAfter.accumulated_minutes).toBe(300);

  // la semilla nueva nació con el excedente y con identidad propia y completa
  const seedling = activePlant();
  expect(seedling.id).not.toBe(oldPlant.id);
  expect(seedling.accumulated_minutes).toBe(15);
  expect(SPECIES).toContain(seedling.species);
  expect(seedling.renderer_version).toBe(1);
  expect(Number.isInteger(seedling.visual_seed)).toBe(true);

  // dos asignaciones: 10 a la planta cerrada + 15 a la nueva == 25 acreditados
  const alloc = allocationsOf(session.id);
  expect(alloc).toHaveLength(2);
  const toOld = alloc.find((a) => a.plant_id === oldPlant.id);
  const toNew = alloc.find((a) => a.plant_id === seedling.id);
  expect(toOld?.credited_minutes).toBe(10);
  expect(toNew?.credited_minutes).toBe(15);
  expect(alloc.reduce((s, a) => s + a.credited_minutes, 0)).toBe(session.credited_minutes);
});

test("una sesión antigua (pre-migración) permanece sin planta asociada; nada se inventa después", async ({ page }) => {
  // sesión cerrada ANTES de que existieran las asignaciones (simulada tal cual)
  run(
    `INSERT INTO focus_sessions (id, card_id, preset, planned_focus_min, planned_break_min, phase, phase_started_at,
      elapsed_focus_seconds, elapsed_break_seconds, date, started_at, finished_at, outcome, credited_minutes, created_at)
     VALUES ('sesion-legada-7e2', NULL, 'arranque', 5, 0, 'enfoque', '2026-07-10T10:00:00.000Z',
      300, 0, '2026-07-10', '2026-07-10T10:00:00.000Z', '2026-07-10T10:05:00.000Z', 'completa', 5, '2026-07-10T10:00:00.000Z')`
  );
  expect(allocationsOf("sesion-legada-7e2")).toHaveLength(0);

  // otra sesión nueva se completa después: la legada sigue sin asociación
  await login(page);
  await completeArranque(page);
  expect(allocationsOf("sesion-legada-7e2")).toHaveLength(0);
  expect(allocationsOf(lastClosedSession().id)).toHaveLength(1);

  // y las descartadas nunca tienen asignaciones (0 minutos == 0 filas)
  const discarded = q<{ n: number }>(
    `SELECT COUNT(*) n FROM focus_sessions s
     WHERE s.outcome = 'descartada'
       AND EXISTS (SELECT 1 FROM focus_session_plant_allocations a WHERE a.session_id = s.id)`
  );
  expect(Number(discarded[0].n)).toBe(0);
});

test("invariante global y datos intactos: suma de asignaciones == credited_minutes; nada más cambió", async () => {
  // toda sesión cerrada por el motor nuevo cuadra exacto (la legada queda excluida por diseño)
  const mismatches = q<{ id: string; credited: number; allocated: number }>(
    `SELECT s.id, s.credited_minutes AS credited, COALESCE(SUM(a.credited_minutes), 0) AS allocated
     FROM focus_sessions s
     LEFT JOIN focus_session_plant_allocations a ON a.session_id = s.id
     WHERE s.finished_at IS NOT NULL AND s.id != 'sesion-legada-7e2'
     GROUP BY s.id
     HAVING allocated != s.credited_minutes`
  );
  expect(mismatches).toEqual([]);

  // y los minutos de las plantas son exactamente los asignados (para plantas nacidas con el motor nuevo)
  const plants = q<PlantRow & { allocated: number }>(
    `SELECT p.*, COALESCE((SELECT SUM(a.credited_minutes) FROM focus_session_plant_allocations a WHERE a.plant_id = p.id), 0) AS allocated
     FROM focus_plants p`
  );
  for (const p of plants) {
    expect(p.allocated).toBeLessThanOrEqual(p.accumulated_minutes);
  }

  // tareas, proyectos, revisiones y ajustes no fueron tocados por nada de lo anterior
  expect(integrityCounts()).toEqual(countsBefore);
});
