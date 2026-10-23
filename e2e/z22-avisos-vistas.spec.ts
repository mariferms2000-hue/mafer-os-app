import { test, expect, type Page } from "@playwright/test";
import { PASSWORD } from "./lib/credentials";
import { run, q } from "./lib/test-db";

/* Bloque 3 (oct 2026): los avisos siguen a la tarea desde TODAS las vistas
 * (Hoy, tablero, Pomodoro, Revisiones), al eliminar un proyecto, y no dejan
 * duplicados ni huérfanos. Simulador (GOOGLE_SIMULATED=1): nada llega a Google. */

test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);

const P = "AVV E2E";
function hoyMx(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());
}
function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}
const HOY = hoyMx();
const MANANA = addDays(HOY, 1);
const AYER = addDays(HOY, -1);
const now = new Date().toISOString();

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  const confirm = page.getByLabel(/confirma/i);
  if (await confirm.count()) await confirm.fill(PASSWORD);
  await page.getByRole("button", { name: /entrar|crear|empezar/i }).click();
  await page.waitForURL("/");
}

type Sim = { id: string; calendarId: string; start: string; ref: string; aviso: boolean };
async function simEvents(): Promise<Sim[]> {
  const rows = await q<{ value: string }>("SELECT value FROM settings WHERE key LIKE 'sim_gcal_ev:%'");
  return rows.map((r) => JSON.parse(r.value));
}
const avisosDe = async (cardId: string) => (await simEvents()).filter((e) => e.calendarId === "sim-avisos" && e.ref === `card:${cardId}`);
const rowOf = async (cardId: string) =>
  (await q<{ gcal_event_id: string | null }>(`SELECT gcal_event_id FROM card_reminders WHERE card_id = '${cardId}'`))[0] ?? null;
const setting = (key: string, value: string) =>
  `INSERT INTO settings (key, value, updated_at) VALUES ('${key}', '${value}', now()::text) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
const simAviso = (eid: string, cardId: string, start: string) =>
  setting(`sim_gcal_ev:sim-avisos:${eid}`, JSON.stringify({ id: eid, calendarId: "sim-avisos", summary: "x", start, end: null, lead: 0, ref: `card:${cardId}`, aviso: true }));

const KINDS = ["backlog", "proximo", "proceso", "esperando", "bloqueado", "despues", "terminado"];
async function proyecto(pid: string, title: string) {
  await run(`INSERT INTO projects (id, title, created_at, updated_at) VALUES ('${pid}', '${P} ${title}', '${now}', '${now}')`);
  await run(`INSERT INTO boards (id, project_id, title) VALUES ('${pid}-b', '${pid}', 'Tablero')`);
  for (const [i, k] of KINDS.entries()) {
    await run(`INSERT INTO columns (id, board_id, title, kind, position) VALUES ('${pid}-${k}', '${pid}-b', '${k}', '${k}', ${i})`);
  }
}
async function tareaConAviso(id: string, title: string, due: string, time: string, pid?: string) {
  const where = pid ? `'${pid}', '${pid}-b', '${pid}-proximo'` : "null, null, null";
  await run(
    `INSERT INTO cards (id, title, due_date, start_time, project_id, board_id, column_id, created_at, updated_at) VALUES ('${id}', '${P} ${title}', '${due}', '${time}', ${where}, '${now}', '${now}')`
  );
  await run(`INSERT INTO card_reminders (card_id, lead_minutes, created_at, updated_at) VALUES ('${id}', 0, '${now}', '${now}')`);
}

async function limpiar() {
  await run(`DELETE FROM card_reminders WHERE card_id LIKE 'avv-%'`);
  await run(`DELETE FROM cards WHERE title LIKE '${P}%'`);
  await run(`DELETE FROM projects WHERE title LIKE '${P}%'`);
  await run(`DELETE FROM settings WHERE key LIKE 'sim_gcal%' OR key IN ('avisos_activos', 'google_avisos_calendar_id')`);
}

test.beforeAll(async () => {
  await limpiar();
  await run(setting("avisos_activos", "1"));
  await proyecto("avv-p1", "Proyecto tablero");
  await proyecto("avv-p2", "Proyecto a borrar");
  await tareaConAviso("avv-hoy", "Desde Hoy", HOY, "23:30");
  await tareaConAviso("avv-menu", "Menú del tablero", MANANA, "10:00", "avv-p1");
  await tareaConAviso("avv-drag", "Arrastrar a Terminado", MANANA, "11:00", "avv-p1");
  await tareaConAviso("avv-focus", "Desde el Pomodoro", MANANA, "12:00");
  await tareaConAviso("avv-rev", "Vencida con aviso", AYER, "10:00");
  await tareaConAviso("avv-borra1", "Del proyecto 1", MANANA, "08:00", "avv-p2");
  await tareaConAviso("avv-borra2", "Del proyecto 2", MANANA, "08:30", "avv-p2");
  // ninguna sesión de enfoque abierta de otras pruebas
  await run(`UPDATE focus_sessions SET finished_at = '${now}', outcome = 'descartada', credited_minutes = 0 WHERE finished_at IS NULL`);
});

test.afterAll(limpiar);

test("«Reparar avisos» crea lo que falta; una fecha ya pasada no estrena evento", async ({ page }) => {
  await login(page);
  await page.goto("/ajustes#avisos");
  await page.getByTestId("avisos-repair").click();
  await expect(page.getByText(/Avisos reparados/)).toBeVisible({ timeout: 20_000 });
  for (const id of ["avv-hoy", "avv-menu", "avv-drag", "avv-focus", "avv-borra1", "avv-borra2"]) {
    expect(await avisosDe(id), id).toHaveLength(1);
  }
  expect(await avisosDe("avv-rev")).toHaveLength(0);
});

test("completar desde la agenda de Hoy quita el aviso; Deshacer lo devuelve una vez", async ({ page }) => {
  await login(page);
  await page.getByTestId("agenda-today").getByRole("button", { name: `Completar «${P} Desde Hoy»` }).click();
  await expect.poll(async () => (await avisosDe("avv-hoy")).length).toBe(0);
  await page.locator('[role="status"]').filter({ hasText: "Tarea completada" }).getByRole("button", { name: "Deshacer" }).click();
  await expect.poll(async () => (await avisosDe("avv-hoy")).length).toBe(1);
});

test("tablero: completar desde el menú y arrastrar a Terminado quitan el aviso", async ({ page }) => {
  await login(page);
  await page.goto("/proyectos/avv-p1");
  await page.getByTestId("card-menu-avv-menu").click();
  await page.getByTestId("card-menu-complete-avv-menu").click();
  await expect.poll(async () => (await avisosDe("avv-menu")).length).toBe(0);

  // ventana ancha: las 7 listas caben sin scroll y se puede soltar en Terminado
  await page.setViewportSize({ width: 2600, height: 1000 });
  await page.reload();
  const card = page.getByTestId("column-proximo").getByText(`${P} Arrastrar a Terminado`);
  await expect(card).toBeVisible();
  const target = page.getByTestId("column-terminado");
  const from = await card.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error("No se pudieron medir los elementos");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 30, from.y, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + 120, { steps: 15 });
  await page.mouse.up();
  await expect(page.getByTestId("column-terminado").getByText(`${P} Arrastrar a Terminado`)).toBeVisible({ timeout: 10_000 });
  await expect.poll(async () => (await avisosDe("avv-drag")).length).toBe(0);
});

test("Pomodoro: «La terminé» quita el aviso", async ({ page }) => {
  await login(page);
  await page.goto("/?abrir=avv-focus");
  await page.getByTestId("card-focus").click();
  await expect(page.getByTestId("focus-task")).toContainText(`${P} Desde el Pomodoro`);
  await page.getByTestId("focus-preset-arranque").click();
  await page.getByTestId("focus-start").click();
  await expect(page.getByTestId("focus-clock")).toBeVisible();
  await page.getByTestId("focus-end-early").click();
  await page.getByTestId("focus-task-complete").click();
  await expect.poll(async () => (await avisosDe("avv-focus")).length).toBe(0);
});

test("Revisiones: reprogramar una vencida para mañana estrena su aviso", async ({ page }) => {
  await login(page);
  await page.goto("/revisiones");
  await page.getByTestId("center-diaria").getByTestId("start-diaria").click();
  await page.getByTestId("review-next").click(); // Paso 1 → Paso 2 (tareas)
  await expect(page.getByTestId("review-step-label")).toContainText("Paso 2 de 5");
  const fila = page.locator("div.card", { has: page.getByText(`${P} Vencida con aviso`, { exact: true }) }).first();
  await fila.getByTestId("rt-manana").click();
  await expect(page.getByText("Reprogramada para mañana ✓").first()).toBeVisible();
  const evs = await avisosDe("avv-rev");
  expect(evs).toHaveLength(1);
  expect(evs[0].start).toBe(`${MANANA}T10:00:00`);
});

test("eliminar un proyecto borra los avisos de sus tareas", async ({ page }) => {
  await login(page);
  await page.goto("/proyectos/avv-p2");
  await page.getByTestId("edit-project").click();
  await page.getByRole("button", { name: "Eliminar", exact: true }).click();
  await page.getByRole("button", { name: "Sí, eliminar" }).click();
  await page.waitForURL(/\/proyectos$/);
  expect(await avisosDe("avv-borra1")).toHaveLength(0);
  expect(await avisosDe("avv-borra2")).toHaveLength(0);
  expect(await rowOf("avv-borra1")).toBeNull();
  expect(await rowOf("avv-borra2")).toBeNull();
});

test("sin duplicados: adopta un aviso que ya estaba en Google, quita repetidos y recrea el que se borró allá", async ({ page }) => {
  await tareaConAviso("avv-adopta", "Adoptar existente", MANANA, "09:15");
  await run(simAviso("ya-estaba-1", "avv-adopta", `${MANANA}T09:15:00`));
  await run(simAviso("ya-estaba-2", "avv-adopta", `${MANANA}T09:15:00`));
  // y un aviso vinculado que alguien borró directamente en Google
  const hoyRow = (await rowOf("avv-hoy"))!;
  await run(`DELETE FROM settings WHERE key = 'sim_gcal_ev:sim-avisos:${hoyRow.gcal_event_id}'`);

  await login(page);
  await page.goto("/ajustes#avisos");
  await page.getByTestId("avisos-repair").click();
  await expect(page.getByText(/Avisos reparados/)).toBeVisible({ timeout: 20_000 });

  // se queda UNO de los que ya estaban (no se crea otro) y el repetido se quita
  const adoptado = await avisosDe("avv-adopta");
  expect(adoptado).toHaveLength(1);
  expect(["ya-estaba-1", "ya-estaba-2"]).toContain(adoptado[0].id);
  expect((await rowOf("avv-adopta"))!.gcal_event_id).toBe(adoptado[0].id);
  const hoy = await avisosDe("avv-hoy");
  expect(hoy).toHaveLength(1);
  expect((await rowOf("avv-hoy"))!.gcal_event_id).toBe(hoy[0].id);
  // una segunda reparación no cambia nada
  const antes = JSON.stringify((await simEvents()).map((e) => e.id).sort());
  await page.getByTestId("avisos-repair").click();
  await expect(page.getByText(/Avisos reparados/).last()).toBeVisible({ timeout: 20_000 });
  expect(JSON.stringify((await simEvents()).map((e) => e.id).sort())).toBe(antes);
});

test("huérfano: si Google falla al eliminar, la tarea se borra, se avisa, y la revisión ofrece limpiarlo", async ({ page }) => {
  await login(page);
  const ev = (await rowOf("avv-adopta"))!.gcal_event_id!;
  await run(setting("sim_gcal_falla", "1"));
  await page.goto("/?abrir=avv-adopta");
  await page.getByTestId("card-delete").click();
  await page.getByTestId("card-delete-confirm").click();
  await expect(page.getByText(/el aviso de Google no/)).toBeVisible();
  expect(await q("SELECT id FROM cards WHERE id = 'avv-adopta'")).toHaveLength(0);
  expect((await avisosDe("avv-adopta")).map((e) => e.id)).toEqual([ev]); // quedó en «Google»
  await run(setting("sim_gcal_falla", "0"));

  await page.goto("/ajustes#avisos");
  await page.getByTestId("avisos-review-load").click();
  const huerfano = page.getByTestId("avisos-ghost").filter({ hasText: "La tarea ya no existe" }).filter({ hasText: "Mafer OS · Avisos" });
  await expect(huerfano).toHaveCount(1);
  await huerfano.getByRole("checkbox").check();
  await page.getByTestId("avisos-apply").click();
  await page.getByTestId("avisos-apply-yes").click();
  await expect(page.getByTestId("avisos-outcome")).toContainText("1 eventos eliminados");
  expect(await avisosDe("avv-adopta")).toHaveLength(0);
});

test("desactivados (como quedará producción tras el merge): nada toca avisos ni recordatorios anteriores", async ({ page }) => {
  await run(`DELETE FROM settings WHERE key = 'avisos_activos'`);
  // una tarea con recordatorio anterior vinculada a su evento de «Mafer OS» y otra con fila de aviso
  await run(setting("google_calendar_id", "sim-mafer-os"));
  await run(
    `INSERT INTO cards (id, title, due_date, start_time, reminder, gcal_event_id, created_at, updated_at) VALUES ('avv-legacy', '${P} Recordatorio anterior', '${MANANA}', '10:00', 'gcal-timed', 'old-legacy', '${now}', '${now}')`
  );
  await run(
    setting("sim_gcal_ev:sim-mafer-os:old-legacy", JSON.stringify({ id: "old-legacy", calendarId: "sim-mafer-os", summary: "x", start: `${MANANA}T10:00:00`, end: null, lead: null, ref: "card:avv-legacy", aviso: false }))
  );
  const antes = JSON.stringify((await simEvents()).sort((a, b) => a.id.localeCompare(b.id)));
  const filasAntes = JSON.stringify(await q("SELECT * FROM card_reminders ORDER BY card_id"));

  await login(page);
  // los formularios muestran el selector de siempre
  await page.goto("/?abrir=avv-legacy");
  await expect(page.getByLabel("Recordatorio", { exact: true })).toHaveValue("gcal-timed");
  await expect(page.getByTestId("aviso-switch")).toHaveCount(0);
  await page.getByLabel("Hora (opcional)").fill("10:30");
  await page.getByTestId("card-save").click();
  await expect(page.getByText("Tarea actualizada ✓")).toBeVisible();
  // completar, deshacer y eliminar tareas con fila de aviso tampoco llaman al sistema nuevo
  await page.goto("/?abrir=avv-rev");
  await page.getByTestId("card-complete").click();
  await expect(page.getByText("Tarea completada ✓")).toBeVisible();
  await page.goto("/?abrir=avv-hoy");
  await page.getByTestId("card-delete").click();
  await page.getByTestId("card-delete-confirm").click();
  await expect(page.getByText("Tarea eliminada.")).toBeVisible();

  expect(JSON.stringify((await simEvents()).sort((a, b) => a.id.localeCompare(b.id)))).toBe(antes);
  // (la fila de la tarea eliminada se conserva: sin activar no se toca nada del sistema nuevo)
  expect(JSON.stringify(await q("SELECT * FROM card_reminders ORDER BY card_id"))).toBe(filasAntes);
  const legacy = (await q<{ reminder: string; gcal_event_id: string }>("SELECT reminder, gcal_event_id FROM cards WHERE id = 'avv-legacy'"))[0];
  expect(legacy).toEqual({ reminder: "gcal-timed", gcal_event_id: "old-legacy" });

  await page.goto("/");
  await expect(page.getByTestId("hoy-avisos-fallo")).toHaveCount(0);
  await page.goto("/ajustes#avisos");
  await expect(page.getByTestId("avisos-inactive")).toBeVisible();
  await expect(page.getByTestId("avisos-review")).toHaveCount(0); // la revisión/migración ni se ofrece
});
