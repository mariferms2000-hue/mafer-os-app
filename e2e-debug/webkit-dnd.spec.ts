import { test, expect } from "@playwright/test";

const PASSWORD = "prueba-mafer-123";

test("safari: estrés de drag & drop", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("crash", () => errors.push("PAGE CRASHED"));
  page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));

  await page.goto("http://localhost:3901/login");
  const firstTime = await page.getByLabel("Confirma tu contraseña").isVisible();
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  if (firstTime) {
    await page.getByLabel("Confirma tu contraseña").fill(PASSWORD);
    await page.getByRole("button", { name: "Crear y entrar" }).click();
  } else {
    await page.getByRole("button", { name: "Entrar" }).click();
  }
  await page.waitForURL("http://localhost:3901/");

  // crear proyecto con tarjetas
  await page.goto("http://localhost:3901/proyectos");
  const existing = page.getByText("Estrés DnD");
  if (!(await existing.isVisible().catch(() => false))) {
    await page.getByTestId("new-project").first().click();
    await page.getByTestId("new-project-title").fill("Estrés DnD");
    await page.getByTestId("new-project-save").click();
    await page.waitForURL(/\/proyectos\/.+/);
    for (let i = 1; i <= 4; i++) {
      await page.getByTestId("quickadd-backlog").click();
      await page.getByTestId("quickadd-input-backlog").fill(`Tarjeta ${i}`);
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("column-backlog").getByText(`Tarjeta ${i}`, { exact: true })).toBeVisible();
    }
  } else {
    await existing.click();
    await page.waitForURL(/\/proyectos\/.+/);
  }

  // arrastres repetidos y rápidos entre columnas
  const cols = ["proximo", "proceso", "esperando", "backlog"];
  for (let round = 0; round < 3; round++) {
    for (let i = 1; i <= 4; i++) {
      const card = page.getByText(`Tarjeta ${i}`, { exact: true }).first();
      const target = page.getByTestId(`column-${cols[(i + round) % cols.length]}`);
      const from = await card.boundingBox();
      const to = await target.boundingBox();
      if (!from || !to) continue;
      await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
      await page.mouse.down();
      await page.mouse.move(to.x + to.width / 2, to.y + 100, { steps: 6 });
      await page.mouse.up();
      await page.waitForTimeout(150);
    }
  }
  await page.waitForTimeout(1500);
  // ¿seguimos en la página del tablero, sin crash?
  expect(page.url()).toContain("/proyectos/");
  await expect(page.getByTestId("board")).toBeVisible();
  console.log("ERRORES RECOGIDOS:\n" + (errors.join("\n") || "(ninguno)"));
});
