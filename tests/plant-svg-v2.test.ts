import { afterEach, describe, expect, it, vi } from "vitest";
import { plantSceneV2, SPECIES_LABEL } from "../src/lib/plant-svg-v2";
import { PLANT_SPECIES_V2, newPlantIdentityV2, plantRenderSpecV2, type PlantSpeciesV2 } from "../src/lib/plant-render-v2";
import type { StageKey } from "../src/lib/focus-logic";

/** Escena SVG v2 — tan determinista como la especificación: misma planta →
 *  mismos trazos, byte a byte. Cubre las 12 especies (5 rediseñadas + 7
 *  nuevas). */

const LATE_STAGES: StageKey[] = ["hojas", "planta-joven", "planta-completa"];

const sceneOf = (species: PlantSpeciesV2, seed: number, stage: StageKey) =>
  plantSceneV2(plantRenderSpecV2({ species, visualSeed: seed, stage }));

afterEach(() => vi.restoreAllMocks());

describe("plantSceneV2 (escena SVG determinista)", () => {
  it("misma entrada produce exactamente la misma escena, byte a byte", () => {
    for (const species of PLANT_SPECIES_V2) {
      for (const stage of LATE_STAGES) {
        expect(JSON.stringify(sceneOf(species, 987654, stage))).toBe(JSON.stringify(sceneOf(species, 987654, stage)));
      }
    }
  });

  it("jamás usa Math.random", () => {
    vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Math.random está prohibido en la escena");
    });
    for (const species of PLANT_SPECIES_V2) {
      expect(() => sceneOf(species, 42, "planta-completa")).not.toThrow();
    }
  });

  it("veinte seeds generan veinte escenas distinguibles por especie", () => {
    for (const species of PLANT_SPECIES_V2) {
      const variants = new Set<string>();
      for (let i = 0; i < 20; i++) {
        variants.add(JSON.stringify(sceneOf(species, newPlantIdentityV2(`p${i}`).visualSeed, "planta-completa")));
      }
      expect(variants.size, species).toBe(20);
    }
  });

  it("las doce especies producen escenas distintas con el mismo seed", () => {
    const variants = new Set(PLANT_SPECIES_V2.map((sp) => JSON.stringify(sceneOf(sp, 777, "planta-completa"))));
    expect(variants.size).toBe(PLANT_SPECIES_V2.length);
  });

  it("toda escena es dibujable: trazos no vacíos, números finitos, encuadre válido", () => {
    for (const species of PLANT_SPECIES_V2) {
      for (const stage of LATE_STAGES) {
        for (let i = 0; i < 15; i++) {
          const scene = sceneOf(species, newPlantIdentityV2(`${species}-${i}`).visualSeed, stage);
          expect(scene.strokes.length, `${species}/${stage}`).toBeGreaterThan(2);
          for (const s of scene.strokes) {
            expect(s.d.length, `${species}/${stage}`).toBeGreaterThan(0);
            expect(s.d).not.toMatch(/NaN|Infinity|undefined/);
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
    for (const species of PLANT_SPECIES_V2) {
      const early = sceneOf(species, 13579, "hojas").strokes.length;
      const full = sceneOf(species, 13579, "planta-completa").strokes.length;
      expect(full, species).toBeGreaterThanOrEqual(early);
    }
  });

  it("cada una de las 12 especies tiene su nombre visible en español", () => {
    for (const species of PLANT_SPECIES_V2) {
      expect(SPECIES_LABEL[species]).toBeTruthy();
      expect(SPECIES_LABEL[species][0]).toBe(SPECIES_LABEL[species][0].toUpperCase());
    }
  });

  it("una planta v1 (especie original + su seed) también produce una escena v2 dibujable", () => {
    const scene = sceneOf("suculenta", 246813579, "planta-completa");
    expect(scene.strokes.length).toBeGreaterThan(2);
  });
});
