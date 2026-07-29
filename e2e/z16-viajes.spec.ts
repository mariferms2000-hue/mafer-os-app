import { test, expect, type Page } from "@playwright/test";

/** Fase 3 — Viajes en Calendario: crear, ver franja/badge, editar y eliminar.
 *  Fechas fijas en el futuro para no depender de "hoy" al construir la
 *  franja de la semana. Título único por intento para reintentos limpios. */

const PASSWORD = "prueba-mafer-123";

test.describe.configure({ mode: "serial" });

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  const confirm = page.getByLabel("Confirma tu contraseña");
  if (await confirm.isVisible()) {
    await confirm.fill(PASSWORD);
    await page.getByRole("button", { name: "Crear y entrar" }).click();
  } else {
    await page.getByRole("button", { name: "Entrar" }).click();
  }
  await page.waitForURL("/");
}

test("crear un viaje: aparece como franja en Mes y badge en Día/Agenda", async ({ page }, testInfo) => {
  const titulo = `Viaje de prueba ${testInfo.retry}`;

  await login(page);
  await page.goto("/calendario?fecha=2026-08-01");
  await page.getByTestId("new-trip").click();
  await page.getByTestId("trip-title").fill(titulo);
  await page.getByTestId("trip-destination").fill("Oaxaca");
  await page.getByTestId("trip-start").fill("2026-08-05");
  await page.getByTestId("trip-end").fill("2026-08-08");
  await page.getByTestId("trip-save").click();

  // Franja en Mes (agosto 2026 ya visible por la fecha del enlace)
  await expect(page.getByTestId("trip-week-band")).toBeVisible();
  await expect(page.getByText(titulo)).toBeVisible();

  // Badge en vista Día (dentro del rango)
  await page.goto("/calendario?vista=dia&fecha=2026-08-06");
  await expect(page.getByTestId("trip-day-badges")).toBeVisible();
  await expect(page.getByText(titulo, { exact: false })).toBeVisible();

  // Fuera del rango: no aparece
  await page.goto("/calendario?vista=dia&fecha=2026-08-10");
  await expect(page.getByTestId("trip-day-badges")).toHaveCount(0);
});

test("editar y eliminar el viaje desde el detalle", async ({ page }, testInfo) => {
  const titulo = `Viaje de prueba ${testInfo.retry}`;
  const editado = `${titulo} editado`;

  await login(page);
  await page.goto("/calendario?fecha=2026-08-01");
  await page.getByText(titulo).first().click();
  await expect(page.getByTestId("trip-detail")).toBeVisible();

  await page.getByTestId("trip-title-input").fill(editado);
  await page.getByTestId("trip-save").click();
  await expect(page.getByTestId("trip-detail")).toHaveCount(0);
  await expect(page.getByText(editado)).toBeVisible();

  await page.getByText(editado).first().click();
  await expect(page.getByTestId("trip-detail")).toBeVisible();
  await page.getByTestId("trip-delete").click();
  await page.getByTestId("trip-delete-confirm").click();
  await expect(page.getByTestId("trip-detail")).toHaveCount(0);
  await expect(page.getByText(editado)).toHaveCount(0);
});
