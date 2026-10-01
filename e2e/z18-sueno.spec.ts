import { test, expect, type Page } from "@playwright/test";

/** Sueño — selector de hora propio (24 h) y estado en la URL.
 *  La lógica de ciclos y de escritura por segmento ya tiene pruebas unitarias
 *  (tests/sleep-logic.test.ts, tests/time-field.test.ts); aquí se prueba la
 *  interacción real: escribir, borrar, flechas, URL, «ahora» y cambio de modo. */

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

const hour = (page: Page) => page.getByRole("spinbutton", { name: "Hora" });
const minute = (page: Page) => page.getByRole("spinbutton", { name: "Minutos" });
const results = (page: Page) => page.getByTestId("sleep-option").locator("span:first-child");

async function expectTime(page: Page, mode: "despertar" | "dormir", hh: string, mm: string) {
  await expect(page).toHaveURL(new RegExp(`/sueno\\?modo=${mode}&h=${hh}:${mm}$`));
  await expect(hour(page)).toHaveValue(hh);
  await expect(minute(page)).toHaveValue(mm);
}

test.beforeEach(async ({ page }) => {
  await login(page);
});

test("muestra 00:00, 07:30 y 23:59 en 24 h con sus resultados", async ({ page }) => {
  await page.goto("/sueno?modo=despertar&h=00:00");
  await expectTime(page, "despertar", "00", "00");
  await expect(results(page)).toHaveText(["14:45", "16:15", "17:45"]);

  await page.goto("/sueno?modo=despertar&h=07:30");
  await expectTime(page, "despertar", "07", "30");
  await expect(results(page)).toHaveText(["22:15", "23:45", "01:15"]);

  await page.goto("/sueno?modo=dormir&h=23:59");
  await expectTime(page, "dormir", "23", "59");
  await expect(results(page)).toHaveText(["06:14", "07:44", "09:14"]);
  // Nunca AM/PM, aunque el navegador esté en otro idioma.
  await expect(page.getByTestId("sleep-time")).not.toContainText(/AM|PM|a\.\s?m\.|p\.\s?m\./i);
});

test("escribir la hora actualiza la URL y pasa solo a los minutos", async ({ page }) => {
  await page.goto("/sueno?modo=despertar&h=07:30");
  await hour(page).click();
  await page.keyboard.type("23");
  await expectTime(page, "despertar", "23", "30");
  await expect(minute(page)).toBeFocused();
  await expect(results(page)).toHaveText(["14:15", "15:45", "17:15"]);

  await page.keyboard.type("05");
  await expectTime(page, "despertar", "23", "05");
});

test("«24» y «60» quedan como borrador sin tocar URL ni resultados; al salir vuelve lo válido", async ({ page }) => {
  await page.goto("/sueno?modo=despertar&h=23:59");
  await hour(page).click();
  await page.keyboard.type("24");
  await expect(hour(page)).toHaveValue("24");
  await expect(page).toHaveURL(/h=23:59$/);
  await expect(results(page)).toHaveText(["14:44", "16:14", "17:44"]);
  await page.keyboard.press("Tab");
  await expect(hour(page)).toHaveValue("23");
  await expect(page).toHaveURL(/h=23:59$/);

  await page.keyboard.type("60");
  await expect(minute(page)).toHaveValue("60");
  await expect(page).toHaveURL(/h=23:59$/);
  await minute(page).blur();
  await expect(minute(page)).toHaveValue("59");
  await expect(page).toHaveURL(/h=23:59$/);

  // Corregir el borrador sí aplica: «24», retroceso, «0» → 20.
  await hour(page).click();
  await page.keyboard.type("24");
  await page.keyboard.press("Backspace");
  await page.keyboard.type("0");
  await expect(page).toHaveURL(/h=20:59$/);
});

test("un dígito se completa con cero: «7» → 07 al pasar a minutos, «5» → 05 al salir", async ({ page }) => {
  await page.goto("/sueno?modo=despertar&h=10:30");
  await hour(page).click();
  await page.keyboard.type("7");
  await expect(minute(page)).toBeFocused();
  await expectTime(page, "despertar", "07", "30");

  await page.keyboard.type("5");
  await expect(page).toHaveURL(/h=07:30$/); // «5» podría ser 5x: espera
  await minute(page).blur();
  await expectTime(page, "despertar", "07", "05");
});

test("borrar deja un borrador vacío sin tocar la última URL válida", async ({ page }) => {
  await page.goto("/sueno?modo=dormir&h=22:40");
  await minute(page).click();
  await page.keyboard.press("Backspace");
  await expect(minute(page)).toHaveValue("");
  await expect(page).toHaveURL(/modo=dormir&h=22:40$/);
  await expect(results(page)).toHaveText(["04:55", "06:25", "07:55"]);

  // Al salir sin escribir, vuelve la última hora válida.
  await hour(page).focus();
  await expect(minute(page)).toHaveValue("40");

  // Borrar y escribir otro valor sí lo guarda.
  await minute(page).click();
  await page.keyboard.press("Backspace");
  await page.keyboard.type("15");
  await expect(page).toHaveURL(/h=22:15$/);
});

test("teclado ±1 y flechas en pantalla (hora ±1, minutos ±5) sin redondear", async ({ page }) => {
  await page.goto("/sueno?modo=dormir&h=23:47");
  await hour(page).focus();
  await page.keyboard.press("ArrowUp");
  await expectTime(page, "dormir", "00", "47");
  await page.keyboard.press("Tab");
  await expect(minute(page)).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expectTime(page, "dormir", "00", "46");

  await page.getByRole("button", { name: "Sumar 5 minutos" }).click();
  await expectTime(page, "dormir", "00", "51");
  await page.getByRole("button", { name: "Bajar una hora" }).click();
  await expectTime(page, "dormir", "23", "51");
});

test.describe("dispositivo en Madrid, navegador en inglés", () => {
  test.use({ timezoneId: "Europe/Madrid", locale: "en-US" });

  test("«Me voy a dormir ahora» pone la hora exacta del dispositivo", async ({ page }) => {
    // 21:47 UTC = 23:47 en Madrid (en México serían las 15:47).
    await page.clock.setFixedTime(new Date("2026-10-01T21:47:00Z"));
    await page.goto("/sueno?modo=dormir&h=22:00");
    await page.getByRole("button", { name: "Me voy a dormir ahora" }).click();
    await expectTime(page, "dormir", "23", "47");
    await expect(results(page)).toHaveText(["06:02", "07:32", "09:02"]);
    await expect(page.getByTestId("sleep-time")).not.toContainText(/AM|PM/);
  });
});

test("cambiar de modo conserva la hora elegida", async ({ page }) => {
  await page.goto("/sueno?modo=despertar&h=06:10");
  await minute(page).click();
  await page.keyboard.type("25");
  await page.getByRole("button", { name: "Dormir a…" }).click();
  await expectTime(page, "dormir", "06", "25");
  await expect(page.getByRole("group", { name: "¿A qué hora te vas a dormir?" })).toBeVisible();
  await page.getByRole("button", { name: "Despertar a…" }).click();
  await expectTime(page, "despertar", "06", "25");
});

/* ── Fase 5: última selección en este dispositivo (URL > localStorage > defaults) ── */

const stored = (page: Page) => page.evaluate(() => localStorage.getItem("mafer-sueno"));
const setStored = (page: Page, raw: string) => page.evaluate((v) => localStorage.setItem("mafer-sueno", v), raw);

test.describe("recordar la última selección", () => {
  test("guarda modo y hora válidos y los recupera al entrar sin parámetros", async ({ page }) => {
    await page.goto("/sueno?modo=dormir&h=23:47");
    await expect.poll(() => stored(page)).toBe('{"modo":"dormir","hora":"23:47"}');
    await page.goto("/sueno");
    await expectTime(page, "dormir", "23", "47");
    await expect(results(page)).toHaveText(["06:02", "07:32", "09:02"]);

    // Cambiar hora y modo también se guarda.
    await page.getByRole("button", { name: "Sumar 5 minutos" }).click();
    await page.getByRole("button", { name: "Despertar a…" }).click();
    await expect.poll(() => stored(page)).toBe('{"modo":"despertar","hora":"23:52"}');
  });

  test("una URL explícita gana sobre lo guardado", async ({ page }) => {
    await setStored(page, '{"modo":"dormir","hora":"23:47"}');
    await page.goto("/sueno?modo=despertar&h=06:45");
    await expectTime(page, "despertar", "06", "45");
    await page.reload();
    await expectTime(page, "despertar", "06", "45");
  });

  test("sin nada guardado → valores por defecto", async ({ page }) => {
    expect(await stored(page)).toBeNull();
    await page.goto("/sueno");
    await expectTime(page, "despertar", "07", "30");
  });

  for (const [caso, raw] of [
    ["JSON corrupto", "{oops"],
    ["hora inválida", '{"modo":"dormir","hora":"25:00"}'],
    ["modo inválido", '{"modo":"siesta","hora":"23:10"}'],
  ] as const) {
    test(`${caso} → valores por defecto, sin romper`, async ({ page }) => {
      await setStored(page, raw);
      await page.goto("/sueno");
      await expectTime(page, "despertar", "07", "30");
      await expect(results(page)).toHaveText(["22:15", "23:45", "01:15"]);
    });
  }

  test("un borrador inválido no sobrescribe el último valor bueno", async ({ page }) => {
    await page.goto("/sueno?modo=dormir&h=23:59");
    await expect.poll(() => stored(page)).toBe('{"modo":"dormir","hora":"23:59"}');
    await minute(page).click();
    await page.keyboard.type("60");
    await expect(minute(page)).toHaveValue("60");
    expect(await stored(page)).toBe('{"modo":"dormir","hora":"23:59"}');
    await minute(page).blur();
    expect(await stored(page)).toBe('{"modo":"dormir","hora":"23:59"}');
  });

  test("sin hydration mismatch y sin destello: el servidor pinta la calculadora invisible", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));
    await setStored(page, '{"modo":"dormir","hora":"23:47"}');

    // HTML del servidor para /sueno sin parámetros: calculadora oculta (nada de 07:30 visible).
    const html = await (await page.request.get("/sueno")).text();
    expect(html).toMatch(/class="[^"]*\binvisible\b[^"]*"[^>]*data-testid="sleep-calculator"/);

    await page.goto("/sueno");
    await expectTime(page, "dormir", "23", "47");
    await expect(page.getByTestId("sleep-calculator")).toBeVisible();
    await page.goto("/sueno?modo=despertar&h=06:45");
    await expectTime(page, "despertar", "06", "45");
    expect(errors.filter((e) => /hydrat|#418|#423|#425/i.test(e))).toEqual([]);
  });
});

test.describe("recordar «ahora» (dispositivo en Madrid)", () => {
  test.use({ timezoneId: "Europe/Madrid" });

  test("«Me voy a dormir ahora» se guarda con sus minutos exactos", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-10-01T21:47:00Z"));
    await page.goto("/sueno?modo=dormir&h=22:00");
    await page.getByRole("button", { name: "Me voy a dormir ahora" }).click();
    await expectTime(page, "dormir", "23", "47");
    await expect.poll(() => stored(page)).toBe('{"modo":"dormir","hora":"23:47"}');
    await page.goto("/sueno");
    await expectTime(page, "dormir", "23", "47");
  });
});

/* ── Fase 6: acceso desde la navegación y Buscar ── */

test.describe("acceso desde el menú lateral (escritorio)", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 768, "el menú lateral solo existe en escritorio");

  test("Sueño está en el grupo secundario, va a /sueno y queda activo", async ({ page }) => {
    const link = page.getByTestId("sidebar-sueno-link");
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/sueno");
    await expect(link).not.toHaveAttribute("aria-current", "page");
    // Orden del grupo secundario: Buscar · Sueño · Ajustes
    const aside = page.locator("aside");
    const order = await aside.locator('a[href="/buscar"], a[href="/sueno"], a[href="/ajustes"]').evaluateAll((els) =>
      els.map((e) => e.getAttribute("href")),
    );
    expect(order).toEqual(["/buscar", "/sueno", "/ajustes"]);

    await link.click();
    await expect(page).toHaveURL(/\/sueno\?modo=despertar&h=07:30$/);
    await expect(link).toHaveAttribute("aria-current", "page");
  });

  test("entrar desde el menú recupera la última selección guardada", async ({ page }) => {
    await setStored(page, '{"modo":"dormir","hora":"23:47"}');
    await page.getByTestId("sidebar-sueno-link").click();
    await expectTime(page, "dormir", "23", "47");
  });
});

test.describe("acceso desde la barra superior (móvil)", () => {
  test.use({ viewport: { width: 375, height: 667 }, hasTouch: true });

  test("la luna tiene nombre «Sueño», navega a /sueno y queda activa", async ({ page }) => {
    const moon = page.getByRole("link", { name: "Sueño", exact: true });
    await expect(moon).toBeVisible();
    await expect(page.getByTestId("mobile-settings-link")).toBeVisible();
    await expect(moon).toHaveAttribute("href", "/sueno");
    await setStored(page, '{"modo":"despertar","hora":"06:10"}');
    await moon.tap();
    await expectTime(page, "despertar", "06", "10");
    await expect(moon).toHaveAttribute("aria-current", "page");
  });

  test("la barra inferior sigue con exactamente sus 6 secciones", async ({ page }) => {
    const bottom = page.locator("nav.fixed.bottom-0");
    await expect(bottom.getByRole("link")).toHaveText(["Hoy", "Inbox", "Proyectos", "Calendario", "Explorar", "Biblioteca"]);
    await expect(bottom.locator('a[href="/sueno"]')).toHaveCount(0);
  });

  test("los iconos del header no recortan el logo", async ({ page }) => {
    const logo = page.locator("header").getByText("Mafer OS");
    const moon = page.getByTestId("mobile-sueno-link");
    const logoBox = (await logo.boundingBox())!;
    const moonBox = (await moon.boundingBox())!;
    expect(logoBox.x + logoBox.width).toBeLessThan(moonBox.x);
    expect(await logo.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
  });
});

test.describe("Buscar encuentra Sueño", () => {
  // FIXME (incidencia aparte, ya existía en main): cualquier búsqueda con texto se
  // cuelga ~2–3 min — Buscar lanza 10 consultas con Promise.all y postgres-js las
  // encadena en una conexión que el pooler de Supabase (modo transacción) no
  // atiende. La coincidencia está cubierta en tests/search-destinations.test.ts;
  // la pantalla se verificó a mano con las consultas en fila. Quitar este fixme
  // cuando se arregle Buscar.
  test.fixme();

  for (const q of ["sueño", "sueno", "dormir", "despertar", "hora de dormir", "ciclo de sueño"]) {
    test(`con «${q}»`, async ({ page }) => {
      await page.goto(`/buscar?q=${encodeURIComponent(q)}`);
      const hit = page.getByTestId("search-results").getByRole("link", { name: /Sueño/ });
      await expect(hit).toHaveAttribute("href", "/sueno");
      await expect(hit).toContainText("herramienta");
    });
  }

  test("el resultado lleva a Sueño con la última selección", async ({ page }) => {
    await setStored(page, '{"modo":"dormir","hora":"22:30"}');
    await page.goto("/buscar?q=dormir");
    await page.getByTestId("search-results").getByRole("link", { name: /Sueño/ }).click();
    await expectTime(page, "dormir", "22", "30");
  });
});
