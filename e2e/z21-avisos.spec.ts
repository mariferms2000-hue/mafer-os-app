import { test, expect, type Page } from "@playwright/test";
import fs from "fs";
import path from "path";
import { PASSWORD } from "./lib/credentials";
import { run, q } from "./lib/test-db";

/* Bloque 3 (oct 2026): «🔔 Avisarme» con el calendario «Mafer OS · Avisos».
 * Todo corre contra el SIMULADOR (GOOGLE_SIMULATED=1 en playwright.config):
 * los «eventos de Google» son filas sim_gcal_ev:* en settings de la base de
 * pruebas. Ninguna prueba habla con Google ni con datos reales. */

test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const QA_DIR = path.join(__dirname, "..", "docs", "qa", "avisos");
const P = "AVISOS E2E";

function hoyMx(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());
}
function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}
const MANANA = addDays(hoyMx(), 1);
const PASADO = addDays(hoyMx(), 2);

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  const confirm = page.getByLabel(/confirma/i);
  if (await confirm.count()) await confirm.fill(PASSWORD);
  await page.getByRole("button", { name: /entrar|crear|empezar/i }).click();
  await page.waitForURL("/");
}

type Sim = { id: string; calendarId: string; summary: string; start: string; lead: number | null; ref: string; aviso: boolean };
async function simEvents(): Promise<Sim[]> {
  const rows = await q<{ value: string }>("SELECT value FROM settings WHERE key LIKE 'sim_gcal_ev:%'");
  return rows.map((r) => JSON.parse(r.value));
}
const avisosDe = async (cardId: string) => (await simEvents()).filter((e) => e.calendarId === "sim-avisos" && e.ref === `card:${cardId}`);
async function row(cardId: string) {
  const r = await q<{ gcal_event_id: string | null; lead_minutes: number; last_error: string | null }>(
    `SELECT gcal_event_id, lead_minutes, last_error FROM card_reminders WHERE card_id = '${cardId}'`
  );
  return r[0] ?? null;
}
async function cardIdByTitle(title: string): Promise<string> {
  const r = await q<{ id: string }>(`SELECT id FROM cards WHERE title = '${title}'`);
  expect(r).toHaveLength(1);
  return r[0].id;
}
const setting = (key: string, value: string) =>
  `INSERT INTO settings (key, value, updated_at) VALUES ('${key}', '${value}', now()::text) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;

test.beforeAll(async () => {
  await run(`DELETE FROM cards WHERE title LIKE '${P}%'`);
  await run(`DELETE FROM card_reminders`);
  await run(`DELETE FROM settings WHERE key LIKE 'sim_gcal%' OR key IN ('avisos_activos', 'avisos_prueba', 'google_avisos_calendar_id', 'google_calendar_id')`);
});

test.afterAll(async () => {
  await run(`DELETE FROM cards WHERE title LIKE '${P}%'`);
  await run(`DELETE FROM card_reminders`);
  await run(`DELETE FROM settings WHERE key LIKE 'sim_gcal%' OR key IN ('avisos_activos', 'avisos_prueba', 'google_avisos_calendar_id', 'google_calendar_id')`);
});

test("sin activar, todo sigue como antes; el aviso de prueba y las dos comprobaciones abren la activación", async ({ page }) => {
  await login(page);
  // formulario de siempre: el selector anterior, sin «Avisarme»
  await page.goto("/tareas");
  await page.getByTestId("new-task").click();
  await page.getByTestId("new-task-more").click();
  await expect(page.getByLabel("Recordatorio", { exact: true })).toBeVisible();
  await expect(page.getByTestId("aviso-switch")).toHaveCount(0);

  await page.goto("/ajustes#avisos");
  const panel = page.getByTestId("avisos-panel");
  await expect(panel.getByTestId("avisos-simulado")).toBeVisible();
  await expect(panel.getByTestId("avisos-inactive")).toBeVisible({ timeout: 15_000 });

  await panel.getByTestId("avisos-test-create").click();
  await expect(panel.getByTestId("avisos-test-at")).toBeVisible({ timeout: 15_000 });
  const prueba = (await simEvents()).filter((e) => e.ref.startsWith("test:"));
  expect(prueba).toHaveLength(1);
  expect(prueba[0]).toMatchObject({ calendarId: "sim-avisos", lead: 0 });

  // activar exige confirmar el iPhone y Alexa
  const activar = panel.getByTestId("avisos-activate");
  await expect(activar).toBeDisabled();
  await panel.getByTestId("avisos-check-iphone").check();
  await expect(activar).toBeDisabled();
  await panel.getByTestId("avisos-check-alexa").check();
  await activar.click();
  await expect(panel.getByTestId("avisos-active")).toBeVisible({ timeout: 15_000 });

  await panel.getByTestId("avisos-test-delete").click();
  await expect(panel.getByTestId("avisos-test-at")).toHaveCount(0, { timeout: 15_000 });
  expect((await simEvents()).filter((e) => e.ref.startsWith("test:"))).toHaveLength(0);

  fs.mkdirSync(QA_DIR, { recursive: true });
  await panel.screenshot({ path: path.join(QA_DIR, "01-ajustes-activos.png") });
});

test("crear con aviso funciona desde el primer momento; con fecha y sin «Avisarme» no hay aviso", async ({ page }) => {
  await login(page);
  await page.goto("/tareas");

  // fecha y hora NO encienden el aviso
  await page.getByTestId("new-task").click();
  await page.getByTestId("new-task-title").fill(`${P} Sin aviso`);
  await page.getByTestId("new-task-more").click();
  await page.getByTestId("new-task-date").fill(MANANA);
  await page.getByTestId("new-task-time").fill("08:00");
  await expect(page.getByTestId("aviso-switch")).toHaveAttribute("aria-checked", "false");
  await page.getByTestId("new-task-save").click();
  await expect(page.getByText("Tarea creada ✓")).toBeVisible();
  expect(await row(await cardIdByTitle(`${P} Sin aviso`))).toBeNull();
  await page.goto("/tareas");

  // con aviso y sin hora: se proponen las 9:00
  await page.getByTestId("new-task").click();
  await page.getByTestId("new-task-title").fill(`${P} Pagar la renta`);
  await page.getByTestId("new-task-more").click();
  await page.getByTestId("new-task-date").fill(MANANA);
  await page.getByTestId("aviso-switch").click();
  await expect(page.getByTestId("new-task-time")).toHaveValue("09:00");
  await expect(page.getByTestId("aviso-proposed-time")).toBeVisible();
  await page.getByRole("radio", { name: "10 min antes" }).click();
  await page.getByRole("dialog").screenshot({ path: path.join(QA_DIR, "02-nueva-tarea-aviso.png") });
  await page.getByTestId("new-task-save").click();
  await expect(page.getByText("Tarea creada ✓")).toBeVisible();

  const id = await cardIdByTitle(`${P} Pagar la renta`);
  const r = await row(id);
  expect(r).toMatchObject({ lead_minutes: 10, last_error: null });
  const evs = await avisosDe(id);
  expect(evs).toHaveLength(1);
  expect(evs[0]).toMatchObject({ id: r!.gcal_event_id, summary: `🔔 ${P} Pagar la renta`, start: `${MANANA}T09:00:00`, lead: 10, aviso: true });
});

test("sin fecha no deja guardar con «Avisarme» encendido", async ({ page }) => {
  await login(page);
  await page.goto("/tareas");
  await page.getByTestId("new-task").click();
  await page.getByTestId("new-task-title").fill(`${P} Sin fecha`);
  await page.getByTestId("new-task-more").click();
  await page.getByTestId("aviso-switch").click();
  await expect(page.getByTestId("aviso-needs-date")).toBeVisible();
  await page.getByTestId("new-task-save").click();
  await expect(page.getByText(/necesito una fecha/).last()).toBeVisible();
  expect(await q(`SELECT id FROM cards WHERE title = '${P} Sin fecha'`)).toHaveLength(0);
});

test("editar actualiza el mismo evento; completar lo quita y Deshacer lo recrea, sin duplicados", async ({ page }) => {
  await login(page);
  const id = await cardIdByTitle(`${P} Pagar la renta`);
  const original = (await row(id))!.gcal_event_id;

  await page.goto(`/?abrir=${id}`);
  const detail = page.getByTestId("card-detail");
  await expect(detail.getByTestId("aviso-state-ok")).toBeVisible();
  await detail.getByLabel("Hora (opcional)").fill("11:15");
  await detail.getByTestId("card-due-input").fill(PASADO);
  await detail.getByRole("radio", { name: "1 hora antes" }).click();
  await detail.getByTestId("card-save").click();
  await expect(page.getByText("Tarea actualizada ✓")).toBeVisible();
  let evs = await avisosDe(id);
  expect(evs).toHaveLength(1);
  expect(evs[0]).toMatchObject({ id: original, start: `${PASADO}T11:15:00`, lead: 60 });

  // completar quita el aviso
  await page.goto(`/?abrir=${id}`);
  await page.getByTestId("card-complete").click();
  await expect(page.getByText("Tarea completada ✓")).toBeVisible();
  expect(await avisosDe(id)).toHaveLength(0);
  expect((await row(id))!.gcal_event_id).toBeNull(); // la preferencia se conserva

  // deshacer lo recrea, una sola vez
  await page.locator('[role="status"]').filter({ hasText: "Tarea completada" }).getByRole("button", { name: "Deshacer" }).click();
  await expect.poll(async () => (await avisosDe(id)).length).toBe(1);
  evs = await avisosDe(id);
  expect(evs[0]).toMatchObject({ start: `${PASADO}T11:15:00`, lead: 60 });
  expect((await row(id))!.gcal_event_id).toBe(evs[0].id);
});

test("archivar quita el aviso y restaurar lo devuelve; apagar «Avisarme» lo borra", async ({ page }) => {
  await login(page);
  const id = await cardIdByTitle(`${P} Pagar la renta`);

  await page.goto(`/?abrir=${id}`);
  await page.getByTestId("card-archive").click();
  await expect(page.getByText("Tarea archivada.")).toBeVisible();
  expect(await avisosDe(id)).toHaveLength(0);

  await page.goto("/tareas?v=archivadas");
  await page.getByText(`${P} Pagar la renta`).locator("..").getByRole("button", { name: /Restaurar/ }).click();
  await expect(page.getByText("Tarea restaurada del archivo.")).toBeVisible();
  await expect.poll(async () => (await avisosDe(id)).length).toBe(1);

  await page.goto(`/?abrir=${id}`);
  await page.getByTestId("aviso-switch").click();
  await page.getByTestId("card-save").click();
  await expect(page.getByText("Tarea actualizada ✓")).toBeVisible();
  expect(await avisosDe(id)).toHaveLength(0);
  expect(await row(id)).toBeNull();

  // y se vuelve a encender
  await page.goto(`/?abrir=${id}`);
  await page.getByTestId("aviso-switch").click();
  await page.getByTestId("card-save").click();
  await expect(page.getByText("Tarea actualizada ✓")).toBeVisible();
  expect(await avisosDe(id)).toHaveLength(1);
});

test("un fallo de Google se ve en la tarea, en Hoy y en Ajustes, y «Reparar avisos» lo arregla", async ({ page }) => {
  await login(page);
  const id = await cardIdByTitle(`${P} Pagar la renta`);
  await run(setting("sim_gcal_falla", "1"));

  await page.goto(`/?abrir=${id}`);
  await page.getByLabel("Hora (opcional)").fill("12:40");
  await page.getByTestId("card-save").click();
  await expect(page.getByText(/el aviso de Google no/)).toBeVisible();
  // el cambio de la tarea sí se guardó
  expect((await q<{ start_time: string }>(`SELECT start_time FROM cards WHERE id = '${id}'`))[0].start_time).toBe("12:40");
  expect((await row(id))!.last_error).toMatch(/simulado/);

  await page.goto("/");
  await expect(page.getByTestId("hoy-avisos-fallo")).toContainText("1 aviso no se pudo sincronizar");
  await page.goto(`/?abrir=${id}`);
  await expect(page.getByTestId("aviso-state-error")).toBeVisible();

  await page.goto("/ajustes#avisos");
  await expect(page.getByTestId("avisos-failure")).toContainText(`${P} Pagar la renta`);
  await page.getByTestId("avisos-panel").screenshot({ path: path.join(QA_DIR, "03-ajustes-fallo.png") });

  await page.getByTestId("avisos-sim-fail").uncheck();
  await expect(page.getByTestId("avisos-sim-fail")).not.toBeChecked();
  await page.getByTestId("avisos-repair").click();
  await expect(page.getByText(/Avisos reparados/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("avisos-failures")).toContainText("Ninguno");
  const evs = await avisosDe(id);
  expect(evs).toHaveLength(1);
  expect(evs[0].start).toBe(`${PASADO}T12:40:00`);
  await page.goto("/");
  await expect(page.getByTestId("hoy-avisos-fallo")).toHaveCount(0);
});

test("eliminar la tarea borra su aviso", async ({ page }) => {
  await login(page);
  const id = await cardIdByTitle(`${P} Pagar la renta`);
  await page.goto(`/?abrir=${id}`);
  await page.getByTestId("card-delete").click();
  await page.getByTestId("card-delete-confirm").click();
  await expect(page.getByText("Tarea eliminada.")).toBeVisible();
  expect(await avisosDe(id)).toHaveLength(0);
  expect(await row(id)).toBeNull();
});

test("revisión: muestra lo concreto sin cambiar nada y aplica SOLO lo aprobado", async ({ page }) => {
  const now = new Date().toISOString();
  const legacy = (cid: string, title: string, extra: string) =>
    `INSERT INTO cards (id, title, due_date, start_time, reminder, gcal_event_id, completed_at, created_at, updated_at) VALUES ('${cid}', '${P} ${title}', ${extra}, '${now}', '${now}')`;
  const sim = (eid: string, summary: string, start: string, ref: string) =>
    setting(`sim_gcal_ev:sim-mafer-os:${eid}`, JSON.stringify({ id: eid, calendarId: "sim-mafer-os", summary, start, end: null, lead: null, ref, aviso: false }));
  await run(setting("google_calendar_id", "sim-mafer-os"));
  await run(legacy("rv-mover", "Recordatorio viejo", `'${MANANA}', null, 'gcal-allday', 'old-1', null`));
  await run(legacy("rv-otro", "Otro recordatorio viejo", `'${MANANA}', '18:00', 'gcal-timed', 'old-2', null`));
  await run(legacy("rv-hecha", "Ya hecha", `'${MANANA}', '10:00', 'gcal-timed', 'old-3', '${now}'`));
  await run(sim("old-1", `${P} Recordatorio viejo`, MANANA, "card:rv-mover"));
  await run(sim("old-2", `${P} Otro recordatorio viejo`, `${MANANA}T18:00:00`, "card:rv-otro"));
  await run(sim("old-3", `${P} Ya hecha`, `${MANANA}T10:00:00`, "card:rv-hecha"));
  await run(sim("old-4", `${P} Tarea borrada`, `${MANANA}T08:00:00`, "card:no-existe"));
  await run(sim("old-5", `${P} Compromiso`, `${MANANA}T13:00:00`, "event:e-1"));
  await run(sim("old-6", `${P} Evento sin marca`, `${MANANA}T15:00:00`, ""));
  const antes = JSON.stringify(await simEvents());

  await login(page);
  await page.goto(`/?abrir=rv-mover`);
  await expect(page.getByTestId("aviso-legacy")).toBeVisible(); // no se ofrece el nuevo hasta revisarlo

  await page.goto("/ajustes#avisos");
  await page.getByTestId("avisos-review-load").click();
  const res = page.getByTestId("avisos-review-result");
  await expect(res).toBeVisible();
  // (otras pruebas de la suite pueden dejar sus propias tareas: se cuentan solo las de aquí)
  await expect(res.getByTestId("avisos-move").filter({ hasText: P })).toHaveCount(2);
  await expect(res.getByTestId("avisos-move").filter({ hasText: `${P} Recordatorio viejo ·` })).toContainText("se le pondrá 9:00");
  await expect(res.getByTestId("avisos-ghost").filter({ hasText: P })).toHaveCount(2);
  await expect(res).not.toContainText(`${P} Compromiso`);
  await expect(res).not.toContainText(`${P} Evento sin marca`);
  // revisar no cambió nada
  expect(JSON.stringify(await simEvents())).toBe(antes);
  await page.getByTestId("avisos-panel").screenshot({ path: path.join(QA_DIR, "04-revision.png") });

  // aprobar: mover uno y borrar un fantasma; el resto se queda
  await res.getByTestId("avisos-move").filter({ hasText: `${P} Recordatorio viejo ·` }).getByRole("checkbox").check();
  await res.getByTestId("avisos-ghost").filter({ hasText: "Ya hecha" }).getByRole("checkbox").check();
  await res.getByTestId("avisos-apply").click();
  await expect(res.getByTestId("avisos-apply-confirm")).toContainText("Se moverán 1 recordatorios y se eliminarán de Google 1 eventos fantasma");
  await res.getByTestId("avisos-apply-yes").click();
  await expect(page.getByTestId("avisos-outcome")).toContainText("1 recordatorios movidos, 1 eventos eliminados");

  const ids = (await simEvents()).map((e) => e.id);
  expect(ids).not.toContain("old-1"); // movido
  expect(ids).not.toContain("old-3"); // fantasma aprobado
  for (const keep of ["old-2", "old-4", "old-5", "old-6"]) expect(ids).toContain(keep);
  const nuevo = await avisosDe("rv-mover");
  expect(nuevo).toHaveLength(1);
  expect(nuevo[0]).toMatchObject({ start: `${MANANA}T09:00:00`, lead: 0 });
  const c = (await q<{ reminder: string | null; gcal_event_id: string | null; start_time: string | null }>(
    "SELECT reminder, gcal_event_id, start_time FROM cards WHERE id = 'rv-mover'"
  ))[0];
  expect(c).toEqual({ reminder: null, gcal_event_id: null, start_time: "09:00" });
  const intacta = (await q<{ reminder: string; gcal_event_id: string }>("SELECT reminder, gcal_event_id FROM cards WHERE id = 'rv-otro'"))[0];
  expect(intacta).toEqual({ reminder: "gcal-timed", gcal_event_id: "old-2" });

  // la tarea movida ya muestra «Avisarme» encendido
  await page.goto(`/?abrir=rv-mover`);
  await expect(page.getByTestId("aviso-switch")).toHaveAttribute("aria-checked", "true");
});

test("desactivar quita los avisos de Google y vuelve al formulario anterior", async ({ page }) => {
  await login(page);
  await page.goto("/ajustes#avisos");
  await page.getByTestId("avisos-off").click();
  await page.getByTestId("avisos-off-yes").click();
  await expect(page.getByTestId("avisos-inactive")).toBeVisible({ timeout: 15_000 });
  expect((await simEvents()).filter((e) => e.calendarId === "sim-avisos")).toHaveLength(0);
  // los recordatorios anteriores que no se aprobaron siguen ahí
  expect((await simEvents()).map((e) => e.id)).toContain("old-2");
  await page.goto("/tareas");
  await page.getByTestId("new-task").click();
  await page.getByTestId("new-task-more").click();
  await expect(page.getByLabel("Recordatorio", { exact: true })).toBeVisible();
});
