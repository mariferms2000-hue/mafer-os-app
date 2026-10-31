import { test, expect, type Page } from "@playwright/test";
import fs from "fs";
import path from "path";
import { PASSWORD } from "./lib/credentials";
import { run, q } from "./lib/test-db";

/* Progreso por tareas — F2 (oct 2026): «✓ Hecho» en el Inbox.
 * ✓ Hecho = sí lo hice → tarea completada → progreso. Tarea, Evento, Archivar
 * y Eliminar siguen como antes y no suman. Deshacer devuelve la captura,
 * borra la tarea si es seguro y revoca el punto (y la recompensa, con la
 * lógica de F1). Si el progreso falla, la tarea queda hecha y el toast lo dice. */

test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const QA_DIR = path.join(__dirname, "..", "docs", "qa", "progreso-f2");
const P = "HECHO E2E";
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
async function shot(page: Page, name: string) {
  fs.mkdirSync(QA_DIR, { recursive: true });
  await page.screenshot({ path: path.join(QA_DIR, `${name}.png`), fullPage: false });
}

async function captura(id: string, content: string, extra: { projectId?: string; starter?: boolean } = {}) {
  await run(
    `INSERT INTO inbox_items (id, content, note, project_id, is_starter, created_at) VALUES ('${id}', '${P} ${content}', '', ${
      extra.projectId ? `'${extra.projectId}'` : "null"
    }, ${extra.starter ? "true" : "false"}, '${now}')`
  );
}
async function proyecto(pid: string) {
  await run(`INSERT INTO projects (id, title, created_at, updated_at) VALUES ('${pid}', '${P} Proyecto', '${now}', '${now}')`);
  await run(`INSERT INTO boards (id, project_id, title) VALUES ('${pid}-b', '${pid}', 'Tablero')`);
  for (const [i, k] of KINDS.entries()) {
    await run(`INSERT INTO columns (id, board_id, title, kind, position) VALUES ('${pid}-${k}', '${pid}-b', '${k}', '${k}', ${i})`);
  }
}
type ItemRow = { processed: boolean; converted_to: string | null };
const itemOf = async (id: string) =>
  (await q<ItemRow>(`SELECT processed, converted_to FROM inbox_items WHERE id = '${id}'`))[0] ?? null;
const cardIdOf = async (id: string) => (await itemOf(id))?.converted_to?.split(":")[1] ?? null;
type CardRow = { completed_at: string | null; project_id: string | null; column_id: string | null; is_starter: boolean; due_date: string | null };
const cardRow = async (cardId: string) =>
  (await q<CardRow>(`SELECT completed_at, project_id, column_id, is_starter, due_date FROM cards WHERE id = '${cardId}'`))[0] ?? null;
const credits = () => q<{ card_id: string; kind: string; reward_id: string | null }>(`SELECT card_id, kind, reward_id FROM progress_credits`);
const rewards = () => q<{ id: string; item: string }>(`SELECT id, item FROM garden_rewards`);
const bag = async () => {
  const [r] = await q<{ value: string }>(`SELECT value FROM settings WHERE key = 'progress_reward_bag'`);
  return r ? (JSON.parse(r.value) as string[]) : [];
};

/** La tarjeta de Inbox de una captura. */
const tarjeta = (page: Page, content: string) => page.getByTestId("inbox-item").filter({ hasText: `${P} ${content}` });

async function limpiar() {
  await run(`DELETE FROM progress_credits`);
  await run(`DELETE FROM garden_rewards`);
  await run(`DELETE FROM settings WHERE key = 'progress_reward_bag'`);
  await run(`DELETE FROM inbox_items WHERE content LIKE '${P}%'`);
  await run(`DELETE FROM cards WHERE title LIKE '${P}%'`);
  await run(`DELETE FROM projects WHERE title LIKE '${P}%'`);
}

test.beforeAll(async () => {
  await limpiar();
  await proyecto("hecho-p1");
});
test.afterAll(async () => {
  // por si la prueba de fallo se interrumpió con la tabla renombrada
  await run(`ALTER TABLE IF EXISTS progress_credits_off RENAME TO progress_credits`).catch(() => {});
  await limpiar();
});

test("✓ Hecho: crea la tarea completada, suma 1 punto, sale del Inbox y queda como hecha", async ({ page }) => {
  await captura("hecho-1", "Llamar al dentista");
  await captura("hecho-otra", "Otra captura pendiente");
  await login(page);
  await page.goto("/inbox");
  await expect(tarjeta(page, "Llamar al dentista").getByTestId("inbox-done")).toBeVisible();
  await shot(page, "01-inbox-escritorio");

  await tarjeta(page, "Llamar al dentista").getByTestId("inbox-done").click();
  await expect(page.getByText(/^Hecho ✓/)).toBeVisible();
  await expect(tarjeta(page, "Llamar al dentista")).toHaveCount(0);
  await shot(page, "02-hecho-toast-escritorio");

  expect(await itemOf("hecho-1")).toMatchObject({ processed: true });
  const cardId = (await cardIdOf("hecho-1"))!;
  expect(cardId).toBeTruthy();
  expect(await cardRow(cardId)).toMatchObject({ project_id: null, is_starter: false, due_date: null });
  expect((await cardRow(cardId))?.completed_at).not.toBeNull();
  expect(await credits()).toEqual([{ card_id: cardId, kind: "tarea", reward_id: null }]);

  await page.reload();
  await page.getByText(/Procesadas recientemente/).click();
  await expect(page.getByTestId("inbox-processed-done")).toHaveCount(1);
  await expect(page.getByTestId("inbox-processed-done")).toHaveText("hecha ✓");
  await shot(page, "03-procesadas-hecha");

  // y aparece en Tareas → Terminadas
  await page.goto("/tareas?v=terminadas");
  await expect(page.getByText(`${P} Llamar al dentista`)).toBeVisible();
});

test("Deshacer ✓ Hecho: la captura vuelve, la tarea se borra y el punto se quita", async ({ page }) => {
  await captura("hecho-2", "Pagar la luz");
  await login(page);
  await page.goto("/inbox");
  await tarjeta(page, "Pagar la luz").getByTestId("inbox-done").click();
  await expect(page.getByText(/^Hecho ✓/)).toBeVisible();
  await expect.poll(() => cardIdOf("hecho-2")).not.toBeNull();
  const cardId = (await cardIdOf("hecho-2"))!;
  expect((await credits()).map((c) => c.card_id)).toContain(cardId);

  await page.getByRole("button", { name: "Deshacer" }).first().click();
  await expect.poll(() => itemOf("hecho-2")).toEqual({ processed: false, converted_to: null });
  expect(await cardRow(cardId)).toBeNull();
  expect((await credits()).map((c) => c.card_id)).not.toContain(cardId);
  await expect(tarjeta(page, "Pagar la luz")).toBeVisible();
});

test("✓ Hecho con proyecto: la tarea queda en la lista Terminado de su tablero", async ({ page }) => {
  await captura("hecho-3", "Enviar propuesta", { projectId: "hecho-p1" });
  await login(page);
  await page.goto("/inbox");
  await tarjeta(page, "Enviar propuesta").getByTestId("inbox-done").click();
  await expect.poll(() => cardIdOf("hecho-3")).not.toBeNull();
  const card = await cardRow((await cardIdOf("hecho-3"))!);
  expect(card).toMatchObject({ project_id: "hecho-p1", column_id: "hecho-p1-terminado" });
  await page.goto("/proyectos/hecho-p1");
  await expect(page.getByTestId("column-terminado").getByText(`${P} Enviar propuesta`)).toBeVisible();
});

test("Tarea, Archivar y Eliminar siguen como antes y no suman", async ({ page }) => {
  await captura("hecho-tarea", "Comprar pilas");
  await captura("hecho-archivar", "Idea vieja");
  await captura("hecho-eliminar", "Nota repetida");
  const antes = (await credits()).length;
  await login(page);
  await page.goto("/inbox");

  // Tarea → tarea pendiente
  await tarjeta(page, "Comprar pilas").getByTestId("inbox-to-task").click();
  await tarjeta(page, "Comprar pilas").getByTestId("inbox-task-hoy").click();
  await expect.poll(() => cardIdOf("hecho-tarea")).not.toBeNull();
  expect((await cardRow((await cardIdOf("hecho-tarea"))!))?.completed_at).toBeNull();

  // Archivar
  await tarjeta(page, "Idea vieja").getByTestId("inbox-menu").click();
  await tarjeta(page, "Idea vieja").getByTestId("inbox-archive").click();
  await expect.poll(() => itemOf("hecho-archivar")).toEqual({ processed: true, converted_to: "archivado" });

  // Eliminar (con su confirmación de siempre)
  await tarjeta(page, "Nota repetida").getByTestId("inbox-menu").click();
  await tarjeta(page, "Nota repetida").getByTestId("inbox-delete").click();
  await tarjeta(page, "Nota repetida").getByTestId("inbox-delete-confirm").click();
  await expect.poll(() => itemOf("hecho-eliminar")).toBeNull();

  expect((await credits()).length).toBe(antes);
});

test("Evento abre el cuadro con Evento ya elegido; Procesar usa la sugerencia de la captura", async ({ page }) => {
  await captura("hecho-evento", "Cena con Ana");
  await run(`INSERT INTO inbox_items (id, content, note, type_hint, created_at) VALUES ('hecho-sugerida', '${P} Leer sobre fermentos', '', 'idea', '${now}')`);
  await login(page);
  await page.goto("/inbox");
  const panel = page.getByTestId("process-panel");

  await tarjeta(page, "Cena con Ana").getByTestId("inbox-to-event").click();
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId("type-evento")).toHaveAttribute("aria-checked", "true");
  await panel.getByRole("button", { name: "Cerrar" }).click();
  await expect(panel).toHaveCount(0);

  const sugerida = tarjeta(page, "Leer sobre fermentos");
  await expect(sugerida.getByTestId("inbox-process")).toHaveText("Procesar");
  await sugerida.getByTestId("inbox-process").click();
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId("type-idea")).toHaveAttribute("aria-checked", "true");
});

test("Deshacer no revierte nada si la tarea cambió después", async ({ page }) => {
  await captura("hecho-4", "Revisar contrato");
  await login(page);
  await page.goto("/inbox");
  await tarjeta(page, "Revisar contrato").getByTestId("inbox-done").click();
  await expect.poll(() => cardIdOf("hecho-4")).not.toBeNull();
  const cardId = (await cardIdOf("hecho-4"))!;
  // la tarea se editó después de crearse (cualquier guardado mueve updated_at)
  await run(`UPDATE cards SET updated_at = '${new Date(Date.now() + 1000).toISOString()}' WHERE id = '${cardId}'`);

  await page.getByRole("button", { name: "Deshacer" }).first().click();
  await expect(page.getByText("Ya no se puede deshacer: la tarea cambió.")).toBeVisible();
  expect(await cardRow(cardId)).not.toBeNull();
  expect(await itemOf("hecho-4")).toMatchObject({ processed: true, converted_to: `tarea:${cardId}` });
  expect((await credits()).map((c) => c.card_id)).toContain(cardId);
});

test("✓ Hecho que gana la recompensa: Deshacer la revoca y rehacer gana la MISMA", async ({ page }) => {
  // barra con 2 puntos: el siguiente ✓ Hecho es el tercero
  await run(`DELETE FROM progress_credits`);
  await run(`DELETE FROM garden_rewards`);
  await run(`DELETE FROM settings WHERE key = 'progress_reward_bag'`);
  for (const id of ["hecho-prev-a", "hecho-prev-b"]) {
    await run(`INSERT INTO cards (id, title, completed_at, created_at, updated_at) VALUES ('${id}', '${P} ${id}', '${now}', '${now}', '${now}')`);
    await run(`INSERT INTO progress_credits (card_id, kind, credited_at) VALUES ('${id}', 'tarea', '${now}')`);
  }
  await captura("hecho-5", "Tercera del día");
  await login(page);
  await page.goto("/inbox");
  await tarjeta(page, "Tercera del día").getByTestId("inbox-done").click();
  await expect.poll(async () => (await rewards()).length).toBe(1);
  const [won] = await rewards();
  const bagAfterWin = await bag();
  expect(await q(`SELECT 1 FROM progress_credits WHERE reward_id IS NULL AND kind = 'tarea'`)).toHaveLength(0);

  await page.getByRole("button", { name: "Deshacer" }).first().click();
  await expect.poll(async () => (await rewards()).length).toBe(0);
  expect(await bag()).toEqual([won.item, ...bagAfterWin]);
  const open = await q<{ card_id: string }>(`SELECT card_id FROM progress_credits WHERE reward_id IS NULL AND kind = 'tarea' ORDER BY card_id`);
  expect(open.map((c) => c.card_id)).toEqual(["hecho-prev-a", "hecho-prev-b"]);
  await expect(tarjeta(page, "Tercera del día")).toBeVisible();

  // rehacer: la misma recompensa
  await tarjeta(page, "Tercera del día").getByTestId("inbox-done").click();
  await expect.poll(async () => (await rewards()).length).toBe(1);
  expect((await rewards())[0].item).toBe(won.item);
  expect(await bag()).toEqual(bagAfterWin);
});

test("una captura de ejemplo crea una tarea de ejemplo, que no suma", async ({ page }) => {
  await captura("hecho-starter", "Ejemplo de captura", { starter: true });
  const antes = (await credits()).length;
  await login(page);
  await page.goto("/inbox");
  await tarjeta(page, "Ejemplo de captura").getByTestId("inbox-done").click();
  await expect(page.getByText(/^Hecho ✓/)).toBeVisible();
  const cardId = (await cardIdOf("hecho-starter"))!;
  expect(await cardRow(cardId)).toMatchObject({ is_starter: true });
  expect((await credits()).length).toBe(antes);
});

test("si el progreso falla, la tarea queda hecha y el toast lo dice", async ({ page }) => {
  await captura("hecho-falla", "Cuando falla el progreso");
  await login(page);
  await page.goto("/inbox");
  // fallo real del progreso: su tabla deja de existir un momento
  await run(`ALTER TABLE progress_credits RENAME TO progress_credits_off`);
  try {
    await tarjeta(page, "Cuando falla el progreso").getByTestId("inbox-done").click();
    await expect(page.getByText("✓ Hecho. No se pudo actualizar el progreso.")).toBeVisible();
    await shot(page, "04-hecho-sin-progreso");
  } finally {
    await run(`ALTER TABLE progress_credits_off RENAME TO progress_credits`);
  }
  const cardId = (await cardIdOf("hecho-falla"))!;
  expect((await cardRow(cardId))?.completed_at).not.toBeNull();
  expect(await itemOf("hecho-falla")).toMatchObject({ processed: true });
  expect((await credits()).map((c) => c.card_id)).not.toContain(cardId);
});

test("iPhone: ✓ Hecho cabe junto a las demás salidas, claro y oscuro", async ({ page }) => {
  await captura("hecho-movil", "Recoger el paquete en la oficina de correos");
  await login(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/inbox");
  const card = tarjeta(page, "Recoger el paquete");
  await expect(card.getByTestId("inbox-done")).toBeVisible();
  // las cuatro salidas caben dentro de la tarjeta, sin desbordarla
  const box = (await card.boundingBox())!;
  for (const id of ["inbox-done", "inbox-to-task", "inbox-to-event", "inbox-process"]) {
    const b = (await card.getByTestId(id).boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(box.x);
    expect(b.x + b.width).toBeLessThanOrEqual(box.x + box.width);
  }
  await card.scrollIntoViewIfNeeded();
  await shot(page, "05-inbox-iphone-claro");

  // Eliminar sigue en el menú, en rojo y con confirmación
  await card.getByTestId("inbox-menu").click();
  await expect(card.getByTestId("inbox-delete")).toBeVisible();
  await shot(page, "06-menu-eliminar-iphone");
  await card.getByTestId("inbox-menu").click();

  await page.addInitScript(() => localStorage.setItem("mafer-theme", "dark"));
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await tarjeta(page, "Recoger el paquete").scrollIntoViewIfNeeded();
  await shot(page, "07-inbox-iphone-oscuro");
  await page.evaluate(() => localStorage.setItem("mafer-theme", "light"));
});
