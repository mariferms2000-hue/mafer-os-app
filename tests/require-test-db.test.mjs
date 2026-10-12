import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  databaseNameOf,
  requirePreviewDatabaseUrl,
  requireTestDatabaseUrl,
  supabaseProjectOf,
} from "../scripts/lib/require-test-db.mjs";

/* Aislamiento entre las tres bases: producción, E2E («postgres» de
 * mafer-os-testing) y previews («mafer_preview» del mismo proyecto).
 * URLs inventadas: ninguna apunta a un servidor real. */

const PROD = "postgresql://postgres.prodref:x@pooler.example.com:6543/postgres";
const E2E = "postgresql://postgres.testref:x@pooler.example.com:6543/postgres";
const PREVIEW = "postgresql://postgres.testref:x@pooler.example.com:6543/mafer_preview";
const VARS = [
  "DATABASE_URL", "MIGRATE_DATABASE_URL", "TEST_DATABASE_URL", "TEST_MIGRATE_DATABASE_URL",
  "PREVIEW_DATABASE_URL", "PREVIEW_MIGRATE_DATABASE_URL",
];
let saved;

beforeEach(() => {
  saved = Object.fromEntries(VARS.map((v) => [v, process.env[v]]));
  // Valores vacíos pero definidos: evitan que la guardia cargue el .env.local real.
  for (const v of VARS) process.env[v] = "";
  process.env.DATABASE_URL = PROD;
});
afterEach(() => {
  for (const v of VARS) {
    if (saved[v] === undefined) delete process.env[v];
    else process.env[v] = saved[v];
  }
});

describe("lectura de URLs", () => {
  it("saca el nombre de la base y el proyecto Supabase", () => {
    expect(databaseNameOf(PREVIEW)).toBe("mafer_preview");
    expect(databaseNameOf(E2E)).toBe("postgres");
    expect(supabaseProjectOf(PREVIEW)).toBe("testref");
    expect(databaseNameOf("no es una url")).toBeNull();
  });
});

describe("E2E nunca toca la base de previews", () => {
  it("acepta la base de E2E", () => {
    process.env.TEST_DATABASE_URL = E2E;
    expect(requireTestDatabaseUrl()).toBe(E2E);
  });
  it("rechaza mafer_preview aunque venga por TEST_DATABASE_URL", () => {
    process.env.TEST_DATABASE_URL = PREVIEW;
    expect(() => requireTestDatabaseUrl()).toThrow(/previews/);
  });
  it("rechaza producción", () => {
    process.env.TEST_DATABASE_URL = PROD;
    expect(() => requireTestDatabaseUrl()).toThrow(/producción/);
  });
});

describe("las previews nunca tocan producción ni E2E", () => {
  it("acepta mafer_preview del proyecto de pruebas", () => {
    process.env.PREVIEW_DATABASE_URL = PREVIEW;
    expect(requirePreviewDatabaseUrl()).toBe(PREVIEW);
  });
  it("rechaza la base de E2E", () => {
    process.env.TEST_DATABASE_URL = E2E;
    process.env.PREVIEW_DATABASE_URL = E2E;
    expect(() => requirePreviewDatabaseUrl()).toThrow();
  });
  it("rechaza la URL de producción", () => {
    process.env.PREVIEW_DATABASE_URL = PROD;
    expect(() => requirePreviewDatabaseUrl()).toThrow(/producción/);
  });
  it("rechaza una base llamada mafer_preview dentro del proyecto de producción", () => {
    process.env.PREVIEW_DATABASE_URL = "postgresql://postgres.prodref:x@pooler.example.com:6543/mafer_preview";
    expect(() => requirePreviewDatabaseUrl()).toThrow(/proyecto Supabase de producción/);
  });
  it("exige la variable", () => {
    expect(() => requirePreviewDatabaseUrl()).toThrow(/Falta PREVIEW_DATABASE_URL/);
  });
});
