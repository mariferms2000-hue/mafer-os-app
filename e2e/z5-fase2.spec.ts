import { test, expect, type Page, type TestInfo } from "@playwright/test";
import fs from "fs";
import path from "path";

const QA_DIR = path.join(__dirname, "..", "docs", "qa", "phase-2");
const PASSWORD = "prueba-mafer-123";

test.describe.configure({ mode: "serial" });

const t = (info: TestInfo, name: string) => `${name} F2R${info.retry}`;

async function shot(page: Page, name: string) {
  fs.mkdirSync(QA_DIR, { recursive: true });
  await page.screenshot({ path: path.join(QA_DIR, `${name}.png`), fullPage: true });
}

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("/");
}

/** Crea una tarea solo con título; devuelve tras llegar al paso de clasificación. */
async function crearHastaClasificar(page: Page, titulo: string) {
  await page.goto("/tareas?v=todas");
  await page.getByTestId("new-task").click();
  await page.getByTestId("new-task-title").fill(titulo);
  await page.getByTestId("new-task-save").click();
  await expect(page.getByTestId("classify-step")).toBeVisible();
}

function abrirDetalle(page: Page, titulo: string) {
  return page.getByTestId("task-open").filter({ hasText: titulo }).first().click();
}

test("crear solo con título y «Ahora no»: queda sin estimar", async ({ page }, info) => {
  const titulo = t(info, "Comprar pan");
  await login(page);
  await crearHastaClasificar(page, titulo);
  // sin verbo conocido → no hay sugerencia, solo chips vacíos
  await expect(page.getByTestId("classify-suggestion")).toHaveCount(0);
  await page.getByTestId("classify-skip").click(); // Ahora no
  await expect(page.getByTestId("task-groups").getByText(titulo, { exact: true })).toBeVisible();

  await abrirDetalle(page, titulo);
  await expect(page.getByTestId("dur-none")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("energy-none")).toHaveAttribute("aria-checked", "true");
  await page.getByTestId("card-cancel").click();
});

test("la sugerencia se muestra con su razón y Confirmar la guarda", async ({ page }, info) => {
  const titulo = t(info, "Llamar al banco");
  await login(page);
  await crearHastaClasificar(page, titulo);

  const sugerencia = page.getByTestId("classify-suggestion");
  await expect(sugerencia).toBeVisible();
  await expect(sugerencia).toContainText("Sugerido");
  await expect(sugerencia).toContainText("10–30 min");
  await expect(sugerencia).toContainText("porque el título contiene «llamar»");
  await shot(page, "01-clasificacion-sugerida");

  await page.getByTestId("classify-confirm").click();
  await expect(page.getByText("Clasificación guardada ✓")).toBeVisible();

  // persistió y sobrevive al refresh
  await page.reload();
  await abrirDetalle(page, titulo);
  await expect(page.getByTestId("dur-ten_to_30")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("energy-low")).toHaveAttribute("aria-checked", "true");
  await page.getByTestId("card-cancel").click();
});

test("corregir la sugerencia antes de confirmar", async ({ page }, info) => {
  const titulo = t(info, "Enviar paquete a Colima");
  await login(page);
  await crearHastaClasificar(page, titulo);
  await expect(page.getByTestId("classify-suggestion")).toContainText("Menos de 10 min");
  // Mafer corrige: en realidad es más tardado y de energía media
  await page.getByTestId("dur-thirty_to_60").click();
  await page.getByTestId("energy-medium").click();
  await page.getByTestId("classify-confirm").click();
  await expect(page.getByText("Clasificación guardada ✓")).toBeVisible();

  await abrirDetalle(page, titulo);
  await expect(page.getByTestId("dur-thirty_to_60")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("energy-medium")).toHaveAttribute("aria-checked", "true");
  await page.getByTestId("card-cancel").click();
});

test("cada rango de duración y nivel de energía se guarda, y «sin estimar» también", async ({ page }, info) => {
  const titulo = t(info, "Tarea todos los rangos");
  await login(page);
  await crearHastaClasificar(page, titulo);
  await page.getByTestId("classify-skip").click();

  const combos: [string, string][] = [
    ["dur-under_10", "energy-low"],
    ["dur-ten_to_30", "energy-medium"],
    ["dur-thirty_to_60", "energy-high"],
    ["dur-over_60", "energy-high"],
    ["dur-none", "energy-none"], // volver a sin estimar
  ];
  for (const [dur, en] of combos) {
    await abrirDetalle(page, titulo);
    await page.getByTestId(dur).click();
    await page.getByTestId(en).click();
    await page.getByTestId("card-save").click();
    await expect(page.getByTestId("card-detail")).toHaveCount(0);
    await abrirDetalle(page, titulo);
    await expect(page.getByTestId(dur)).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId(en)).toHaveAttribute("aria-checked", "true");
    await page.getByTestId("card-cancel").click();
  }
});

test("el detalle ofrece la sugerencia y «Usar sugerencia» la aplica sin guardarse sola", async ({ page }, info) => {
  const titulo = t(info, "Investigar universidades");
  await login(page);
  await crearHastaClasificar(page, titulo);
  await page.getByTestId("classify-skip").click(); // se omitió al crear

  await abrirDetalle(page, titulo);
  const sugerencia = page.getByTestId("detail-suggestion");
  await expect(sugerencia).toBeVisible();
  await expect(sugerencia).toContainText("Más de 60 min");
  await expect(sugerencia).toContainText("«investigar»");
  await shot(page, "02-detalle-chips");

  await page.getByTestId("detail-suggestion-use").click();
  await expect(page.getByTestId("dur-over_60")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("energy-high")).toHaveAttribute("aria-checked", "true");

  // sin guardar aún: cancelar descarta
  await page.getByTestId("card-cancel").click();
  await abrirDetalle(page, titulo);
  await expect(page.getByTestId("dur-none")).toHaveAttribute("aria-checked", "true");

  // ahora sí: usar sugerencia y guardar
  await page.getByTestId("detail-suggestion-use").click();
  await page.getByTestId("card-save").click();
  await expect(page.getByText("Tarea actualizada ✓").first()).toBeVisible();
  await page.reload();
  await abrirDetalle(page, titulo);
  await expect(page.getByTestId("dur-over_60")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("detail-suggestion")).toHaveCount(0); // ya no falta nada por estimar
  await page.getByTestId("card-cancel").click();
});

test("completar y reabrir no pierde duración ni energía", async ({ page }, info) => {
  const titulo = t(info, "Llamar al banco"); // creada antes: ten_to_30 + low
  await login(page);
  await page.goto("/tareas?v=todas");
  await page.getByRole("button", { name: `Completar «${titulo}»` }).first().click();
  await expect(page.getByText("Tarea completada ✓").first()).toBeVisible();
  await page.goto("/tareas?f=terminadas");
  await abrirDetalle(page, titulo);
  await expect(page.getByTestId("dur-ten_to_30")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("energy-low")).toHaveAttribute("aria-checked", "true");
  await page.getByTestId("card-complete").click(); // Reabrir
  await page.goto("/tareas?v=todas");
  await abrirDetalle(page, titulo);
  await expect(page.getByTestId("dur-ten_to_30")).toHaveAttribute("aria-checked", "true");
  await page.getByTestId("card-cancel").click();
});

test("conversión desde Inbox: clasificación opcional con sugerencia", async ({ page }, info) => {
  const texto = t(info, "Confirmar cita con laboratorio");
  await login(page);
  await page.goto("/inbox");
  await page.getByTestId("quickbar-input").fill(texto);
  await page.keyboard.press("Enter");
  const item = page.getByTestId("inbox-item").filter({ hasText: texto });
  await item.getByTestId("inbox-process").click();
  await page.getByTestId("type-tarea").click();
  await page.getByTestId("process-submit").click();

  await expect(page.getByTestId("classify-step")).toBeVisible();
  await expect(page.getByTestId("classify-suggestion")).toContainText("«confirmar»");
  await page.getByTestId("classify-confirm").click();
  await expect(page.getByText("Clasificación guardada ✓")).toBeVisible();

  await page.goto("/tareas?v=todas");
  await abrirDetalle(page, texto);
  await expect(page.getByTestId("dur-under_10")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("energy-low")).toHaveAttribute("aria-checked", "true");
  await page.getByTestId("card-cancel").click();
});

test("«Menos de 30 minutos» incluye solo under_10 y ten_to_30", async ({ page }, info) => {
  const corta = t(info, "Tarea corta filtro");
  const larga = t(info, "Tarea larga filtro");
  await login(page);
  for (const [titulo, dur] of [[corta, "dur-under_10"], [larga, "dur-thirty_to_60"]] as const) {
    await crearHastaClasificar(page, titulo);
    await page.getByTestId(dur).click();
    await page.getByTestId("classify-confirm").click();
    await expect(page.getByText("Clasificación guardada ✓").first()).toBeVisible();
  }
  await page.goto("/tareas?f=rapidas");
  await expect(page.getByTestId("task-groups").getByText(corta, { exact: true })).toBeVisible();
  await expect(page.getByTestId("task-groups").getByText(larga, { exact: true })).toHaveCount(0);
  // «Llamar al banco» (ten_to_30) también califica
  await expect(page.getByTestId("task-groups").getByText(t(info, "Llamar al banco"), { exact: true })).toBeVisible();
});

test("filtros: Sin duración, Sin energía (panel Filtrar) y vista Sin clasificar", async ({ page }, info) => {
  const sinNada = t(info, "Comprar pan"); // creada sin estimar
  const conTodo = t(info, "Llamar al banco"); // ten_to_30 + low
  await login(page);
  await page.goto("/tareas?v=todas");

  // Sin duración, desde el panel Filtrar
  await page.getByTestId("open-filters").click();
  await page.getByTestId("flt-dur").selectOption("sin");
  await page.getByTestId("apply-filters").click();
  await expect(page).toHaveURL(/dur=sin/);
  await expect(page.getByTestId("task-groups").getByText(sinNada, { exact: true })).toBeVisible();
  await expect(page.getByTestId("task-groups").getByText(conTodo, { exact: true })).toHaveCount(0);
  await shot(page, "03-filtros-avanzados");

  // Sin energía (reemplaza al anterior con Limpiar + nuevo filtro)
  await page.getByTestId("open-filters").click();
  await page.getByTestId("flt-dur").selectOption("");
  await page.getByTestId("flt-en").selectOption("sin");
  await page.getByTestId("apply-filters").click();
  await expect(page).toHaveURL(/en=sin/);
  await expect(page.getByTestId("task-groups").getByText(sinNada, { exact: true })).toBeVisible();
  await expect(page.getByTestId("task-groups").getByText(conTodo, { exact: true })).toHaveCount(0);

  // Sin estimar: vista dedicada en «Más vistas»
  await page.getByTestId("clear-filters-inline").click();
  await page.getByTestId("more-views").click();
  await page.getByTestId("moreview-sin-clasificar").click();
  await expect(page).toHaveURL(/v=sin-clasificar/);
  await expect(page.getByTestId("task-groups").getByText(sinNada, { exact: true })).toBeVisible();
  await expect(page.getByTestId("task-groups").getByText(conTodo, { exact: true })).toHaveCount(0);
});

test("las exportaciones usan los rangos nuevos", async ({ page }, info) => {
  await login(page);
  // JSON: tokens internos
  const json = await page.request.get("/api/export/json");
  expect(json.ok()).toBeTruthy();
  const exportado = await json.json();
  const tarea = (exportado.data.cards as { title: string; duration: string | null; energy: string | null }[]).find(
    (c) => c.title === t(info, "Llamar al banco")
  );
  expect(tarea?.duration).toBe("ten_to_30");
  expect(tarea?.energy).toBe("low");
  // Markdown: etiquetas legibles
  const md = await page.request.get("/api/export/markdown");
  expect(md.ok()).toBeTruthy();
  const cuerpo = await md.text();
  expect(cuerpo).toContain("10–30 min");
});
