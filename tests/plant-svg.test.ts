import { afterEach, describe, expect, it, vi } from "vitest";
import { plantScene, SPECIES_LABEL } from "../src/lib/plant-svg";
import { PLANT_SPECIES, newPlantIdentity, plantRenderSpec, type PlantSpecies } from "../src/lib/plant-render";
import type { StageKey } from "../src/lib/focus-logic";

/** Fase 7E.3 — la escena SVG es tan determinista como la especificación:
 *  misma planta → mismos trazos, byte a byte. */

const LATE_STAGES: StageKey[] = ["hojas", "planta-joven", "planta-completa"];

const sceneOf = (species: PlantSpecies, seed: number, stage: StageKey) =>
  plantScene(plantRenderSpec({ species, visualSeed: seed, stage, rendererVersion: 1 }));

afterEach(() => vi.restoreAllMocks());

describe("plantScene (escena SVG determinista)", () => {
  it("misma entrada produce exactamente la misma escena, byte a byte", () => {
    for (const species of PLANT_SPECIES) {
      for (const stage of LATE_STAGES) {
        expect(JSON.stringify(sceneOf(species, 987654, stage))).toBe(JSON.stringify(sceneOf(species, 987654, stage)));
      }
    }
  });

  it("jamás usa Math.random", () => {
    vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Math.random está prohibido en la escena");
    });
    expect(() => sceneOf("olivo", 42, "planta-completa")).not.toThrow();
  });

  it("veinte seeds generan veinte escenas distinguibles por especie", () => {
    for (const species of PLANT_SPECIES) {
      const variants = new Set<string>();
      for (let i = 0; i < 20; i++) {
        variants.add(JSON.stringify(sceneOf(species, newPlantIdentity(`p${i}`).visualSeed, "planta-completa")));
      }
      expect(variants.size, species).toBe(20);
    }
  });

  it("las cinco especies producen escenas distintas con el mismo seed", () => {
    const variants = new Set(PLANT_SPECIES.map((sp) => JSON.stringify(sceneOf(sp, 777, "planta-completa"))));
    expect(variants.size).toBe(PLANT_SPECIES.length);
  });

  it("toda escena es dibujable: trazos no vacíos, números finitos, encuadre válido", () => {
    for (const species of PLANT_SPECIES) {
      for (const stage of LATE_STAGES) {
        for (let i = 0; i < 15; i++) {
          const scene = sceneOf(species, newPlantIdentity(`${species}-${i}`).visualSeed, stage);
          expect(scene.strokes.length).toBeGreaterThan(3);
          for (const s of scene.strokes) {
            expect(s.d.length).toBeGreaterThan(0);
            expect(s.d).not.toMatch(/NaN|Infinity/);
            expect(s.w).toBeGreaterThan(0);
            if (s.o !== undefined) {
              expect(s.o).toBeGreaterThan(0);
              expect(s.o).toBeLessThanOrEqual(1);
            }
          }
          expect(scene.frame.k).toBeGreaterThanOrEqual(1);
          expect(scene.frame.k).toBeLessThanOrEqual(1.75);
          expect(Number.isFinite(scene.frame.cx)).toBe(true);
          expect(Number.isFinite(scene.frame.cy)).toBe(true);
        }
      }
    }
  });

  it("crecer añade presencia: la planta completa tiene al menos tantos trazos como hojas", () => {
    for (const species of PLANT_SPECIES) {
      const early = sceneOf(species, 13579, "hojas").strokes.length;
      const full = sceneOf(species, 13579, "planta-completa").strokes.length;
      expect(full).toBeGreaterThanOrEqual(early);
    }
  });

  it("cada especie tiene su nombre visible en español", () => {
    for (const species of PLANT_SPECIES) {
      expect(SPECIES_LABEL[species]).toBeTruthy();
      expect(SPECIES_LABEL[species][0]).toBe(SPECIES_LABEL[species][0].toUpperCase());
    }
  });
});
