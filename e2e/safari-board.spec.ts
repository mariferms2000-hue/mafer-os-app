import { test, expect } from "@playwright/test";

const PASSWORD = "prueba-mafer-123";

/** Estrés de drag & drop en WebKit (motor de Safari): antes crasheaba el renderer
 *  («This page couldn't load»). Este test protege contra regresiones. */
test("safari/webkit: estrés de drag & drop sin crash", async ({ page }) => {
  let crashed = false;
  const pageErrors: string[] = [];
  page.on("crash", () => (crashed = true));
  page.on("pageerror", (e) => pageErrors.push(e.message));

  await page.goto("/login");
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("/");

  // proyecto propio para el estrés
  await page.goto("/proyectos");
  const existing = page.getByText("Estrés Safari", { exact: true });
  if (await existing.isVisible().catch(() => false)) {
    await existing.click();
  } else {
    await page.getByTestId("new-project").first().click();
    await page.getByTestId("new-project-title").fill("Estrés Safari");
    await page.getByTestId("new-project-save").click();
  }
  await page.waitForURL(/\/proyectos\/.+/);

  for (let i = 1; i <= 4; i++) {
    const name = `Safari ${i}`;
    if (await page.getByText(name, { exact: true }).isVisible().catch(() => false)) continue;
    await page.getByTestId("quickadd-backlog").click();
    await page.getByTestId("quickadd-input-backlog").fill(name);
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("column-backlog").getByText(name, { exact: true })).toBeVisible();
  }

  const cols = ["proximo", "proceso", "esperando", "backlog"];
  for (let round = 0; round < 3; round++) {
    for (let i = 1; i <= 4; i++) {
      const card = page.getByText(`Safari ${i}`, { exact: true }).first();
      const target = page.getByTestId(`column-${cols[(i + round) % cols.length]}`);
      const from = await card.boundingBox();
      const to = await target.boundingBox();
      if (!from || !to) continue;
      await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
      await page.mouse.down();
      await page.mouse.move(to.x + to.width / 2, to.y + 110, { steps: 6 });
      await page.mouse.up();
      await page.waitForTimeout(120);
    }
  }
  await page.waitForTimeout(1200);

  expect(crashed, "el proceso de WebKit no debe crashear").toBe(false);
  expect(page.url()).toContain("/proyectos/");
  await expect(page.getByTestId("board")).toBeVisible();

  // persistencia tras recarga: las 4 tarjetas siguen existiendo
  await page.reload();
  for (let i = 1; i <= 4; i++) {
    await expect(page.getByText(`Safari ${i}`, { exact: true })).toBeVisible();
  }
  // El registro del service worker sobre http puede fallar en WebKit de pruebas; no es un error de la app.
  const relevantes = pageErrors.filter((e) => !e.includes("sw.js"));
  expect(relevantes, `errores de página: ${relevantes.join(" | ")}`).toHaveLength(0);
});
