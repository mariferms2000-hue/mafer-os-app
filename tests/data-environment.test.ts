import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* Candado de las previews de Vercel (src/lib/data-environment.ts).
 * Una preview solo funciona sobre una base marcada `data_environment = preview`;
 * en producción y en local el candado no consulta nada. La base se sustituye por
 * un doble que devuelve la marca que cada prueba decide. */

const h = vi.hoisted(() => ({ marker: null as string | null, queries: 0, fail: false }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", async () => {
  const schema = await vi.importActual<typeof import("../src/lib/db/schema")>("../src/lib/db/schema");
  const chain = {
    from: () => chain,
    where: () => chain,
    limit: () => {
      h.queries++;
      if (h.fail) return Promise.reject(new Error("sin conexión"));
      return Promise.resolve(h.marker === null ? [] : [{ value: h.marker }]);
    },
  };
  return { db: { select: () => chain }, schema };
});

async function load() {
  vi.resetModules(); // el candado recuerda la confirmación por instancia
  return import("../src/lib/data-environment");
}

beforeEach(() => {
  h.marker = null;
  h.queries = 0;
  h.fail = false;
});
afterEach(() => vi.unstubAllEnvs());

describe("dataEnvironmentAllowed", () => {
  it("fuera de una preview siempre deja pasar", async () => {
    const { dataEnvironmentAllowed } = await load();
    expect(dataEnvironmentAllowed(false, null)).toBe(true);
    expect(dataEnvironmentAllowed(false, "cualquiera")).toBe(true);
  });
  it("en una preview exige exactamente la marca «preview»", async () => {
    const { dataEnvironmentAllowed } = await load();
    expect(dataEnvironmentAllowed(true, "preview")).toBe(true);
    expect(dataEnvironmentAllowed(true, null)).toBe(false);
    expect(dataEnvironmentAllowed(true, "production")).toBe(false);
    expect(dataEnvironmentAllowed(true, "Preview")).toBe(false);
  });
});

describe("previewDataReady", () => {
  it("en producción no consulta la base", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const { previewDataReady } = await load();
    expect(await previewDataReady()).toBe(true);
    expect(h.queries).toBe(0);
  });

  it("en local (sin VERCEL_ENV) no consulta la base", async () => {
    vi.stubEnv("VERCEL_ENV", "");
    const { previewDataReady, isPreviewDeployment } = await load();
    expect(isPreviewDeployment()).toBe(false);
    expect(await previewDataReady()).toBe(true);
    expect(h.queries).toBe(0);
  });

  it("una preview sobre una base SIN marca (p. ej. producción) queda bloqueada", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    const { previewDataReady, assertDataEnvironment } = await load();
    expect(await previewDataReady()).toBe(false);
    await expect(assertDataEnvironment()).rejects.toThrow(/no está conectada/);
  });

  it("una preview sin base alcanzable queda bloqueada", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    h.fail = true;
    const { previewDataReady } = await load();
    expect(await previewDataReady()).toBe(false);
  });

  it("una preview sobre mafer_preview pasa, y solo consulta una vez", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    h.marker = "preview";
    const { previewDataReady, assertDataEnvironment } = await load();
    expect(await previewDataReady()).toBe(true);
    await expect(assertDataEnvironment()).resolves.toBeUndefined();
    expect(h.queries).toBe(1);
  });
});
