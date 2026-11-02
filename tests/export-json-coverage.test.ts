import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import * as schema from "@/lib/db/schema";

/* «Descargar JSON» debe ser un respaldo completo: toda tabla persistente del
 * schema sale en `data`, salvo las que se excluyan aquí a propósito y con razón.
 * Si agregas una tabla al schema y esta prueba falla, inclúyela en
 * exportAllJson (src/lib/export/exporters.ts) o anótala en EXCLUDED. */
const EXCLUDED: Record<string, string> = {};

const missing = new Set<string>();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", async () => {
  const schema = await import("@/lib/db/schema");
  const { getTableName } = await import("drizzle-orm");
  const rowsFor = (name: string) =>
    name === "settings"
      ? [
          { key: "user_name", value: "Mafer", updatedAt: "x", __table: name },
          { key: "garden_special_plant", value: "p1", updatedAt: "x", __table: name },
          { key: "password_hash", value: "$2a$12$secreto", updatedAt: "x", __table: name },
          { key: "google_tokens", value: '{"refresh_token":"secreto"}', updatedAt: "x", __table: name },
        ]
      : [{ id: `${name}-1`, __table: name }];
  return {
    schema,
    today: () => "2026-11-02",
    db: {
      select: () => ({
        from: (table: Parameters<typeof getTableName>[0]) => {
          const name = getTableName(table);
          return missing.has(name)
            ? Promise.reject(new Error(`relation "${name}" does not exist`))
            : Promise.resolve(rowsFor(name));
        },
      }),
    },
  };
});

const { exportAllJson, SCHEMA_VERSION } = await import("@/lib/export/exporters");

const schemaTables = Object.values(schema)
  .filter((t) => is(t, PgTable))
  .map((t) => getTableName(t as PgTable));

type Row = { __table?: string };
const tablesIn = (data: Record<string, unknown>) => {
  const byTable = new Map<string, string>();
  for (const [key, rows] of Object.entries(data)) {
    for (const r of rows as Row[]) if (r.__table) byTable.set(r.__table, key);
  }
  return byTable;
};

beforeEach(() => missing.clear());

describe("exportAllJson — respaldo completo", () => {
  it("incluye toda tabla persistente del schema (o la excluye con razón explícita)", async () => {
    const json = await exportAllJson();
    const exported = tablesIn(json.data);
    const faltan = schemaTables.filter((t) => !exported.has(t) && !(t in EXCLUDED));
    expect(faltan).toEqual([]);
    expect(schemaTables.length).toBeGreaterThanOrEqual(26);
  });

  it("las exclusiones apuntan a tablas que existen", () => {
    for (const t of Object.keys(EXCLUDED)) expect(schemaTables).toContain(t);
  });

  it("trae las tablas críticas de F3/F4: progreso, recompensas, plantas/enfoque, cuidado y settings", async () => {
    const json = await exportAllJson();
    const d = json.data;
    expect(d.progressCredits).toHaveLength(1);
    expect(d.gardenRewards).toHaveLength(1);
    expect(d.focusPlants).toHaveLength(1);
    expect(d.focusSessions).toHaveLength(1);
    expect(d.focusSessionPlantAllocations).toHaveLength(1);
    expect(d.gardenPlantCare).toHaveLength(1);
    expect(d.settings.map((s) => s.key)).toEqual(["user_name", "garden_special_plant"]);
    expect(json.counts).toMatchObject({
      progressCredits: 1, gardenRewards: 1, focusPlants: 1, focusSessions: 1,
      focusSessionPlantAllocations: 1, gardenPlantCare: 1, settings: 2,
    });
  });

  it("cada colección de data tiene su conteo", async () => {
    const json = await exportAllJson();
    for (const [key, rows] of Object.entries(json.data)) {
      expect(json.counts[key as keyof typeof json.counts], key).toBe((rows as unknown[]).length);
    }
  });

  it("nunca incluye credenciales (hash de contraseña ni tokens de Google)", async () => {
    const json = await exportAllJson();
    const texto = JSON.stringify(json);
    expect(texto).not.toContain("secreto");
    expect(json.omittedSettings).toEqual(["password_hash", "google_tokens"]);
  });

  it("conserva las claves de la v1 y sube la versión de esquema", async () => {
    const json = await exportAllJson();
    expect(SCHEMA_VERSION).toBe(2);
    expect(json.schemaVersion).toBe(2);
    for (const k of [
      "projects", "boards", "columns", "cards", "inbox", "journal", "learning", "ideas", "prompts",
      "aiTools", "agentsSkills", "decisions", "resources", "events", "priorities", "reviews", "cardReminders",
    ]) expect(json.data).toHaveProperty(k);
  });

  it("si una tabla aditiva aún no existe, el respaldo sigue y la anota en missingTables", async () => {
    missing.add("garden_plant_care");
    const json = await exportAllJson();
    expect(json.data.gardenPlantCare).toEqual([]);
    expect(json.missingTables).toEqual(["gardenPlantCare"]);
    expect(json.data.progressCredits).toHaveLength(1);
  });
});
