import { test, expect, type Page } from "@playwright/test";

// Debe coincidir con SIRI_TOKEN en playwright.config.ts
const CLAVE = "clave-siri-solo-para-tests-0123456789abcdef";
const AUTH = { Authorization: `Bearer ${CLAVE}` };
const PASSWORD = "prueba-mafer-123";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Contraseña", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("/");
}

test("siri: sin clave (o con clave equivocada) no deja crear nada", async ({ request }) => {
  const sin = await request.post("/api/siri/inbox", { data: { texto: "intruso" }, maxRedirects: 0 });
  expect(sin.status()).toBe(401);
  const mala = await request.post("/api/siri/evento", {
    data: { titulo: "intruso", fecha: "2026-10-03" },
    headers: { Authorization: "Bearer otra-clave-que-no-es-0123456789abcdef" },
    maxRedirects: 0,
  });
  expect(mala.status()).toBe(401);
  // la puerta de Siri no abre el resto de la app
  const inbox = await request.get("/inbox", { maxRedirects: 0 });
  expect(inbox.status()).toBe(307);
});

test("siri: lo dictado llega al Inbox", async ({ request, page }) => {
  const r = await request.post("/api/siri/inbox", { data: { texto: "Idea dictada a Siri" }, headers: AUTH });
  expect(r.status()).toBe(200);
  expect((await r.json()).mensaje).toContain("Inbox");

  const malo = await request.post("/api/siri/inbox", { data: { texto: "  " }, headers: AUTH });
  expect(malo.status()).toBe(400);

  await login(page);
  await page.goto("/inbox");
  await expect(page.getByText("Idea dictada a Siri")).toBeVisible();
});

test("siri: el evento dictado aparece en el calendario", async ({ request, page }) => {
  const r = await request.post("/api/siri/evento", {
    data: { titulo: "Dentista por Siri", fecha: "2026-10-07T17:30:00-06:00" },
    headers: AUTH,
  });
  expect(r.status()).toBe(200);
  const body = await r.json();
  expect(body.mensaje).toContain("Dentista por Siri");
  expect(body.mensaje).toContain("17:30");

  await login(page);
  await page.goto("/calendario?vista=dia&fecha=2026-10-07");
  await expect(page.getByText("Dentista por Siri")).toBeVisible();
  await expect(page.getByText(/17:30/).first()).toBeVisible();
});
