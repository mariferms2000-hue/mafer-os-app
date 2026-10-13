import { test, expect, type Page } from "@playwright/test";
import fs from "fs";
import path from "path";
import { PASSWORD } from "./lib/credentials";
import { run } from "./lib/test-db";

/* Agenda semanal en Hoy (oct 2026): lunes a domingo, eventos + tareas con
 * fecha, sin repetir lo de «Para que nada se caiga», con detalle a un toque. */

const QA_DIR = path.join(__dirname, "..", "docs", "qa", "agenda-semanal");
test.describe.configure({ mode: "serial" });

const P = "AGENDA E2E";

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
const DOW = (new Date(`${HOY}T12:00:00Z`).getUTCDay() + 6) % 7; // 0 = lunes
const LUNES = addDays(HOY, -DOW);
const DOMINGO = addDays(LUNES, 6);
const LUNES_SIG = addDays(LUNES, 7);

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("/");
}

const now = new Date().toISOString();
const card = (id: string, title: string, due: string, extra = "") =>
  `insert into cards (id, title, due_date, start_time, waiting_for, created_at, updated_at) values ('${id}', '${P} ${title}', '${due}', ${extra || "null, ''"}, '${now}', '${now}')`;
const event = (id: string, title: string, date: string, start: string | null, type = "reunion") =>
  `insert into events (id, title, date, start_time, type, created_at) values ('${id}', '${P} ${title}', '${date}', ${start ? `'${start}'` : "null"}, '${type}', '${now}')`;

test.beforeAll(async () => {
  await run(`delete from cards where title like '${P}%'; delete from events where title like '${P}%'`);
  await run(
    [
      event("ag-e-hoy", "Reunión de hoy", HOY, "10:00"),
      event("ag-e-dia", "Cumpleaños", HOY, null, "evento"),
      card("ag-c-hoy", "Tarea de hoy 9", HOY, "'09:00', ''"),
      card("ag-c-sinhora", "Tarea de hoy sin hora", HOY),
      // mismo título y día que un evento: debe verse UNA vez
      card("ag-c-gemela", "Llamar a Michael", HOY),
      event("ag-e-gemelo", "Llamar a Michael", HOY, null),
      // vencida: solo en «Para que nada se caiga»
      card("ag-c-vencida", "Vencida", addDays(HOY, -9)),
      // domingo (si hoy no es domingo) en espera: en la Agenda, no en «Esperando»
      card("ag-c-domingo", "Esperando el domingo", DOMINGO, "null, 'Ana'"),
      // semana siguiente
      event("ag-e-sig", "Evento semana siguiente", addDays(LUNES_SIG, 1), "12:00"),
    ].join(";")
  );
});

test.afterAll(async () => {
  await run(`delete from cards where title like '${P}%'; delete from events where title like '${P}%'`);
});

test("la agenda muestra la semana: hoy al frente, en orden, sin duplicados ni repetir «Para que nada se caiga»", async ({ page }) => {
  await login(page);
  const agenda = page.getByTestId("agenda");
  await expect(agenda).toContainText("Agenda de la semana");

  // tira de lunes a domingo con hoy marcado
  const strip = page.getByTestId("agenda-strip");
  await expect(strip.getByRole("link")).toHaveCount(7);
  await expect(strip.locator('[aria-current="date"]')).toHaveCount(1);

  // hoy: todo el día → por hora → sin hora
  const hoy = page.getByTestId("agenda-today");
  const textos = await hoy.locator("li").allInnerTexts();
  const orden = textos.map((t) => t.split("\n")[0].trim()).filter((t) => t.startsWith(P));
  expect(orden.indexOf(`${P} Cumpleaños`)).toBeLessThan(orden.indexOf(`${P} Tarea de hoy 9`));
  expect(orden.indexOf(`${P} Tarea de hoy 9`)).toBeLessThan(orden.indexOf(`${P} Reunión de hoy`));
  expect(orden.indexOf(`${P} Reunión de hoy`)).toBeLessThan(orden.indexOf(`${P} Tarea de hoy sin hora`));

  // eventos y tareas se distinguen: el evento no tiene casilla de completar
  await expect(hoy.getByTestId("agenda-event").filter({ hasText: `${P} Reunión de hoy` })).toContainText("10:00");
  await expect(hoy.getByRole("button", { name: `Completar «${P} Tarea de hoy 9»` })).toBeVisible();

  // sin duplicados
  await expect(agenda.getByText(`${P} Llamar a Michael`, { exact: true })).toHaveCount(1);
  await expect(agenda.getByText(`${P} Vencida`, { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("keepup-overdue")).toContainText(`${P} Vencida`);

  if (HOY !== DOMINGO) {
    await expect(page.getByTestId("agenda-rest")).toContainText(`${P} Esperando el domingo`);
    await expect(page.getByTestId("keep-up").getByText(`${P} Esperando el domingo`, { exact: true })).toHaveCount(0);
  }
  await expect(agenda.getByText(`${P} Evento semana siguiente`)).toHaveCount(0);

  fs.mkdirSync(QA_DIR, { recursive: true });
  await agenda.screenshot({ path: path.join(QA_DIR, "01-agenda-escritorio.png") });
});

test("cada elemento abre su detalle y las acciones de tarea siguen funcionando", async ({ page }) => {
  await login(page);
  const hoy = page.getByTestId("agenda-today");

  await hoy.getByTestId("agenda-event").filter({ hasText: `${P} Reunión de hoy` }).click();
  await expect(page).toHaveURL(/evento=ag-e-hoy/);
  await expect(page.getByTestId("event-detail")).toBeVisible();
  await page.goto("/");

  await hoy.getByTestId("task-open").filter({ hasText: `${P} Tarea de hoy 9` }).click();
  await expect(page.getByTestId("card-detail")).toBeVisible();
  await expect(page.getByTestId("card-title-input")).toHaveValue(`${P} Tarea de hoy 9`);
  await page.getByTestId("card-cancel").click();

  // completar la quita de la agenda; deshacer la devuelve
  await hoy.getByRole("button", { name: `Completar «${P} Tarea de hoy sin hora»` }).click();
  await expect(hoy.getByText(`${P} Tarea de hoy sin hora`, { exact: true })).toHaveCount(0);
  await page.locator('[role="status"]').first().getByRole("button", { name: "Deshacer" }).click();
  await expect(hoy.getByText(`${P} Tarea de hoy sin hora`, { exact: true })).toBeVisible();
});

test("navegar a la semana siguiente y volver", async ({ page }) => {
  await login(page);
  await page.getByTestId("agenda-next").click();
  await expect(page).toHaveURL(new RegExp(`semana=${LUNES_SIG}`));
  const agenda = page.getByTestId("agenda");
  await expect(agenda.getByText(`${P} Evento semana siguiente`)).toBeVisible();
  await expect(page.getByTestId("agenda-today")).toHaveCount(0);
  // el resto del tablero no cambia
  await expect(page.getByTestId("keep-up")).toBeVisible();

  await page.getByTestId("agenda-this-week").click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("agenda-today")).toBeVisible();

  // un parámetro inválido muestra la semana actual
  await page.goto("/?semana=cualquier-cosa");
  await expect(page.getByTestId("agenda-today")).toBeVisible();
});
