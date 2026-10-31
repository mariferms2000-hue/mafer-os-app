import { test, expect, type Page } from "@playwright/test";
import { PASSWORD } from "./lib/credentials";
import { run, q } from "./lib/test-db";

/* Progreso por tareas completadas — F1 (oct 2026). Sin interfaz nueva: comprueba
 * en la base que CADA camino real de completar/reabrir suma o quita el punto
 * una sola vez (detalle + Deshacer, menú del tablero, arrastrar a Terminado y
 * guardar el detalle en Terminado). La lógica fina (recompensas, bolsa,
 * previas, concurrencia) la cubre tests-db/progress-credit.test.ts. */

test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const P = "PROG E2E";
const now = new Date().toISOString();
const KINDS = ["backlog", "proximo", "proceso", "esperando", "bloqueado", "despues", "terminado"];

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  const confirm = page.getByLabel(/confirma/i);
  if (await confirm.count()) await confirm.fill(PASSWORD);
  await page.getByRole("button", { name: /entrar|crear|empezar/i }).click();
  await page.waitForURL("/");
}

async function proyecto(pid: string) {
  await run(`INSERT INTO projects (id, title, created_at, updated_at) VALUES ('${pid}', '${P} Proyecto', '${now}', '${now}')`);
  await run(`INSERT INTO boards (id, project_id, title) VALUES ('${pid}-b', '${pid}', 'Tablero')`);
  for (const [i, k] of KINDS.entries()) {
    await run(`INSERT INTO columns (id, board_id, title, kind, position) VALUES ('${pid}-${k}', '${pid}-b', '${k}', '${k}', ${i})`);
  }
}
async function tarea(id: string, title: string, pid?: string) {
  const where = pid ? `'${pid}', '${pid}-b', '${pid}-proximo'` : "null, null, null";
  await run(
    `INSERT INTO cards (id, title, project_id, board_id, column_id, created_at, updated_at) VALUES ('${id}', '${P} ${title}', ${where}, '${now}', '${now}')`
  );
}
const creditOf = async (id: string) =>
  (await q<{ kind: string; reward_id: string | null }>(`SELECT kind, reward_id FROM progress_credits WHERE card_id = '${id}'`))[0] ?? null;
const completedAt = async (id: string) =>
  (await q<{ completed_at: string | null }>(`SELECT completed_at FROM cards WHERE id = '${id}'`))[0]?.completed_at ?? null;

async function limpiar() {
  await run(`DELETE FROM progress_credits`);
  await run(`DELETE FROM garden_rewards`);
  await run(`DELETE FROM settings WHERE key = 'progress_reward_bag'`);
  await run(`DELETE FROM cards WHERE title LIKE '${P}%'`);
  await run(`DELETE FROM projects WHERE title LIKE '${P}%'`);
}

test.beforeAll(async () => {
  await limpiar();
  await proyecto("prog-p1");
});
test.afterAll(limpiar);

// Primero, con la barra vacía: si el arrastre fuera el tercer punto ganaría la
// recompensa, y un punto ya gastado se conserva al reabrir (regla aprobada).
test("tablero: arrastrar a Terminado suma; arrastrar de vuelta lo quita (con la barra vacía)", async ({ page }) => {
  await tarea("prog-drag", "Arrastrar", "prog-p1");
  await login(page);
  // ventana ancha: las 7 listas caben sin scroll (mismo patrón que z22)
  await page.setViewportSize({ width: 2600, height: 1000 });
  await page.goto("/proyectos/prog-p1");

  async function arrastrar(de: string, a: string) {
    const card = page.getByTestId(`column-${de}`).getByText(`${P} Arrastrar`);
    await expect(card).toBeVisible();
    const from = await card.boundingBox();
    const to = await page.getByTestId(`column-${a}`).boundingBox();
    if (!from || !to) throw new Error("No se pudieron medir los elementos");
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 + 30, from.y, { steps: 5 });
    await page.mouse.move(to.x + to.width / 2, to.y + 120, { steps: 15 });
    await page.mouse.up();
  }
  const enTerminado = page.getByTestId("column-terminado").getByText(`${P} Arrastrar`);

  await arrastrar("proximo", "terminado");
  await expect(enTerminado).toBeVisible({ timeout: 10_000 });
  await expect.poll(() => creditOf("prog-drag")).toMatchObject({ kind: "tarea" });
  // de vuelta hacia la izquierda: basta con que salga de Terminado (la lista
  // exacta donde cae depende de la geometría del arrastre)
  await arrastrar("terminado", "despues");
  await expect(enTerminado).toHaveCount(0, { timeout: 10_000 });
  await expect.poll(() => completedAt("prog-drag")).toBeNull();
  await expect.poll(() => creditOf("prog-drag")).toBeNull();
});

test("detalle: completar suma 1 punto; Deshacer lo quita; volver a completar suma una sola vez", async ({ page }) => {
  await tarea("prog-detalle", "Desde el detalle");
  await login(page);
  await page.goto("/tareas?abrir=prog-detalle");
  await page.getByTestId("card-complete").click();
  await expect.poll(() => creditOf("prog-detalle")).toMatchObject({ kind: "tarea", reward_id: null });

  await page.getByRole("button", { name: "Deshacer" }).first().click();
  await expect.poll(() => completedAt("prog-detalle")).toBeNull();
  await expect.poll(() => creditOf("prog-detalle")).toBeNull();

  await page.goto("/tareas?abrir=prog-detalle");
  await page.getByTestId("card-complete").click();
  await expect.poll(() => creditOf("prog-detalle")).toMatchObject({ kind: "tarea" });
  expect(await q(`SELECT 1 FROM progress_credits`)).toHaveLength(1);
});

test("tablero: completar desde el menú de la tarjeta suma el punto", async ({ page }) => {
  await tarea("prog-menu", "Desde el menú", "prog-p1");
  await login(page);
  await page.goto("/proyectos/prog-p1");
  await page.getByTestId("card-menu-prog-menu").click();
  await page.getByTestId("card-menu-complete-prog-menu").click();
  await expect.poll(() => creditOf("prog-menu")).toMatchObject({ kind: "tarea" });
});

test("detalle: guardar con la lista Terminado suma el punto", async ({ page }) => {
  await tarea("prog-guardar", "Guardar en Terminado", "prog-p1");
  await login(page);
  await page.goto("/tareas?abrir=prog-guardar");
  await page.getByTestId("state-terminado").click();
  await page.getByTestId("card-save").click();
  await expect.poll(() => completedAt("prog-guardar")).not.toBeNull();
  await expect.poll(() => creditOf("prog-guardar")).toMatchObject({ kind: "tarea" });
});

test("el tercer punto gana una recompensa y la barra vuelve a 0", async () => {
  // el arrastre se deshizo; detalle + menú + guardar = 3 puntos → 1 recompensa
  await expect.poll(async () => (await q(`SELECT id FROM garden_rewards`)).length).toBe(1);
  const [r] = await q<{ item: string }>(`SELECT item FROM garden_rewards`);
  expect(["agua", "fertilizante"]).toContain(r.item);
  expect(await q(`SELECT 1 FROM progress_credits WHERE reward_id IS NULL AND kind = 'tarea'`)).toHaveLength(0);
});
