import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import {
  suggestEstimates,
  normalizeDuration,
  normalizeEnergy,
  QUICK_DURATIONS,
} from "../src/lib/estimates";

describe("sugerencias por reglas locales", () => {
  it("llamar → 10–30 min y energía baja, con la palabra que lo explica", () => {
    const s = suggestEstimates("Llamar al dentista para la cita");
    expect(s).toEqual({ duration: "ten_to_30", energy: "low", matched: "llamar" });
  });

  it("acciones rápidas → menos de 10 min y energía baja", () => {
    expect(suggestEstimates("Enviar el contrato firmado")?.duration).toBe("under_10");
    expect(suggestEstimates("Confirmar la reserva del hotel")?.energy).toBe("low");
    expect(suggestEstimates("Descargar los análisis")?.duration).toBe("under_10");
  });

  it("trabajo intermedio → 30–60 min y energía media", () => {
    const s = suggestEstimates("Revisar el presupuesto de la clínica");
    expect(s?.duration).toBe("thirty_to_60");
    expect(s?.energy).toBe("medium");
  });

  it("trabajo profundo → más de 60 min y energía alta", () => {
    expect(suggestEstimates("Investigar opciones de certificación")?.duration).toBe("over_60");
    expect(suggestEstimates("Redactar la estrategia de MACA")?.energy).toBe("high");
    expect(suggestEstimates("Diseñar el flujo del paciente")?.duration).toBe("over_60");
  });

  it("funciona con acentos y al inicio de palabra, no dentro de otra", () => {
    expect(suggestEstimates("DISEÑAR logo")?.duration).toBe("over_60");
    expect(suggestEstimates("Llamarle a mamá")?.matched).toBe("llamar"); // prefijo válido
    expect(suggestEstimates("Escoger sillas")).toBeNull(); // «coger» no dispara nada
  });

  it("sin verbo conocido → null (no inventa sugerencias)", () => {
    expect(suggestEstimates("Pan, leche y huevos")).toBeNull();
    expect(suggestEstimates("Dentista")).toBeNull();
  });
});

describe("normalización de tokens (antiguos y basura)", () => {
  it("mapea los tokens antiguos según el mapeo documentado", () => {
    expect(normalizeDuration("5m")).toBe("under_10");
    expect(normalizeDuration("15m")).toBe("ten_to_30");
    expect(normalizeDuration("30m")).toBe("ten_to_30");
    expect(normalizeDuration("60m")).toBe("thirty_to_60");
    expect(normalizeDuration("deep")).toBe("over_60");
    expect(normalizeEnergy("baja")).toBe("low");
    expect(normalizeEnergy("media")).toBe("medium");
    expect(normalizeEnergy("alta")).toBe("high");
  });

  it("acepta tokens nuevos tal cual y descarta valores desconocidos", () => {
    expect(normalizeDuration("over_60")).toBe("over_60");
    expect(normalizeEnergy("high")).toBe("high");
    expect(normalizeDuration("2 horas")).toBeNull();
    expect(normalizeEnergy("muchísima")).toBeNull();
    expect(normalizeDuration(null)).toBeNull();
    expect(normalizeEnergy("")).toBeNull();
  });

  it("«Menos de 30 minutos» = exactamente under_10 y ten_to_30", () => {
    expect([...QUICK_DURATIONS]).toEqual(["under_10", "ten_to_30"]);
  });
});

describe("migración 0002_estimates.sql sobre una base con datos antiguos", () => {
  it("convierte todos los tokens antiguos sin perder filas ni tocar lo demás", () => {
    const tmp = path.join(os.tmpdir(), `mafer-migracion-${process.pid}.db`);
    const db = new Database(tmp);
    db.exec("CREATE TABLE cards (id TEXT PRIMARY KEY, title TEXT, duration TEXT, energy TEXT)");
    const insert = db.prepare("INSERT INTO cards (id, title, duration, energy) VALUES (?, ?, ?, ?)");
    insert.run("a", "cinco", "5m", "baja");
    insert.run("b", "quince", "15m", "media");
    insert.run("c", "treinta", "30m", "alta");
    insert.run("d", "hora", "60m", null);
    insert.run("e", "profunda", "deep", "alta");
    insert.run("f", "sin estimar", null, null);
    insert.run("g", "ya migrada", "over_60", "high");

    const sql = fs.readFileSync(path.join(__dirname, "..", "drizzle", "0002_estimates.sql"), "utf8");
    for (const stmt of sql.split("--> statement-breakpoint")) {
      const s = stmt.trim();
      if (s) db.exec(s);
    }

    const rows = db.prepare("SELECT id, duration, energy FROM cards ORDER BY id").all() as {
      id: string;
      duration: string | null;
      energy: string | null;
    }[];
    expect(rows).toEqual([
      { id: "a", duration: "under_10", energy: "low" },
      { id: "b", duration: "ten_to_30", energy: "medium" },
      { id: "c", duration: "ten_to_30", energy: "high" },
      { id: "d", duration: "thirty_to_60", energy: null },
      { id: "e", duration: "over_60", energy: "high" },
      { id: "f", duration: null, energy: null },
      { id: "g", duration: "over_60", energy: "high" }, // idempotente: no toca lo nuevo
    ]);
    expect(db.prepare("SELECT count(*) AS n FROM cards").get()).toEqual({ n: 7 });
    db.close();
    fs.rmSync(tmp, { force: true });
  });
});
