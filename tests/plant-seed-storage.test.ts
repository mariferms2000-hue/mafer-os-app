import { describe, expect, it } from "vitest";
import { STAGES } from "../src/lib/focus-logic";
import {
  PLANT_SPECIES_V2,
  hashStringV2,
  newPlantIdentityV2,
  plantRenderSpecV2,
  seedForStorage,
} from "../src/lib/plant-render-v2";

/* Error real (oct 2026): la semilla visual es un uint32 pero la columna
 * focus_plants.visual_seed es int4 de Postgres. Toda semilla > 2^31 − 1 hacía
 * fallar el INSERT y la planta siguiente no nacía (≈ la mitad de las veces).
 * Se guarda con los mismos 32 bits leídos con signo; el dibujo no cambia. */

const INT4_MIN = -2147483648;
const INT4_MAX = 2147483647;

// Ids de planta cuya semilla supera INT4_MAX (los que antes fallaban) y alguno que no.
const ids = Array.from({ length: 400 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);
const grandes = ids.filter((id) => hashStringV2(id) > INT4_MAX);
const pequenos = ids.filter((id) => hashStringV2(id) <= INT4_MAX);

describe("seedForStorage", () => {
  it("la muestra incluye semillas por encima del límite de int4 (las que fallaban)", () => {
    expect(grandes.length).toBeGreaterThan(50);
    expect(pequenos.length).toBeGreaterThan(50);
  });

  it("toda semilla guardada cabe en una columna integer de Postgres", () => {
    for (const id of ids) {
      const stored = seedForStorage(newPlantIdentityV2(id).visualSeed);
      expect(Number.isInteger(stored)).toBe(true);
      expect(stored).toBeGreaterThanOrEqual(INT4_MIN);
      expect(stored).toBeLessThanOrEqual(INT4_MAX);
    }
  });

  it("las semillas que ya cabían se guardan sin cambios (las plantas existentes no cambian)", () => {
    for (const id of pequenos) {
      const seed = hashStringV2(id);
      expect(seedForStorage(seed)).toBe(seed);
    }
    expect(seedForStorage(0)).toBe(0);
    expect(seedForStorage(INT4_MAX)).toBe(INT4_MAX);
  });

  it("es reversible: los mismos 32 bits", () => {
    for (const id of grandes) {
      const seed = hashStringV2(id);
      expect(seedForStorage(seed) >>> 0).toBe(seed);
    }
    expect(seedForStorage(4294967295)).toBe(-1);
    expect(seedForStorage(2147483648)).toBe(INT4_MIN);
  });

  it("una planta se dibuja idéntica con la semilla original y con la guardada", () => {
    for (const id of grandes.slice(0, 12)) {
      const seed = hashStringV2(id);
      for (const species of PLANT_SPECIES_V2.slice(0, 4)) {
        for (const { key } of STAGES) {
          const original = plantRenderSpecV2({ species, visualSeed: seed, stage: key });
          const guardada = plantRenderSpecV2({ species, visualSeed: seedForStorage(seed), stage: key });
          expect(guardada).toEqual(original);
        }
      }
    }
  });
});
