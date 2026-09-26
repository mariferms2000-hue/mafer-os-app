import { test, expect, type Page } from "@playwright/test";

/** Evento de varios días («cuidar a la perrita de martes a domingo»): un solo
 *  registro que aparece en cada día, en Hoy, y que se puede volver de un día. */

const PASSWORD = "prueba-mafer-123";

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

/** Hoy en hora de México, igual que la app. */
function hoyMx(offsetDias = 0) {
  const d = new Date(Date.now() + offsetDias * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(d);
}

test("evento de varios días: un registro, aparece cada día y en Hoy", async ({ page }) => {
  const titulo = `Cuidar a la perrita ${Date.now()}`;
  await login(page);
  await page.goto("/calendario");
  await page.getByTestId("new-event").click();
  await page.getByTestId("event-title").fill(titulo);
  await page.getByTestId("event-date").fill(hoyMx());
  await page.locator("#ne-start").fill("08:00");
  await page.getByTestId("event-repeat").check();
  await page.getByTestId("event-repeat-until").fill(hoyMx(2));
  await page.getByTestId("event-save").click();
  await expect(page.getByTestId("event-title")).toHaveCount(0);

  // Agenda: el mismo evento en 3 días seguidos, con el ícono de repetición
  await page.goto("/calendario?vista=agenda");
  const ocurrencias = page.getByRole("button", { name: new RegExp(titulo) });
  await expect(ocurrencias).toHaveCount(3);
  await expect(ocurrencias.first().getByLabel("Se repite cada día")).toBeVisible();

  // Hoy también lo muestra
  await page.goto("/");
  await expect(page.getByText(titulo)).toBeVisible();

  // Quitar la repetición desde el detalle → queda de un solo día
  await page.goto("/calendario?vista=agenda");
  await ocurrencias.first().click();
  await expect(page.getByTestId("event-detail")).toBeVisible();
  await expect(page.getByTestId("event-repeat")).toBeChecked();
  await expect(page.getByTestId("event-repeat-until")).toHaveValue(hoyMx(2));
  await page.getByTestId("event-repeat").uncheck();
  await page.getByRole("button", { name: /Guardar/ }).click();
  await expect(page.getByTestId("event-detail")).toHaveCount(0);
  await page.goto("/calendario?vista=agenda");
  await expect(page.getByRole("button", { name: new RegExp(titulo) })).toHaveCount(1);
});
