import { describe, expect, it } from "vitest";
import {
  ILLUSTRATED_PLANT_SPECIES,
  PLANT_ASSET_DIMS,
  isIllustratedPlantSpecies,
  plantAssetPath,
} from "../src/lib/plant-assets";
import { STAGES } from "../src/lib/focus-logic";
import { PLANT_SPECIES_V2 } from "../src/lib/plant-render-v2";
import fs from "node:fs";
import path from "node:path";

/* Fase 4C — mapeo especie + etapa + tema + tamaño → asset WebP aprobado.
   Puro y determinista; además verifica que cada ruta calculada exista de
   verdad en public/plants/ (que el mapeo no apunte a un archivo inexistente),
   y que el fallback cubra exactamente a las otras 9 especies. */

const THEMES = ["light", "dark"] as const;
const SIZES = ["small", "large"] as const;
const PUBLIC_PLANTS = path.join(__dirname, "..", "public", "plants");

describe("selección de especie ilustrada (puerta del fallback)", () => {
  it("reconoce las 9 especies ilustradas (piloto + Bloque 1 + Bloque 2)", () => {
    expect([...ILLUSTRATED_PLANT_SPECIES].sort()).toEqual([
      "bambu",
      "cactus",
      "helecho",
      "lavanda",
      "monstera",
      "olivo",
      "potos",
      "sansevieria",
      "suculenta",
    ]);
    for (const s of ILLUSTRATED_PLANT_SPECIES) expect(isIllustratedPlantSpecies(s)).toBe(true);
  });

  it("las 3 especies aún no integradas caen al fallback (no ilustradas)", () => {
    const fallback = PLANT_SPECIES_V2.filter((s) => !isIllustratedPlantSpecies(s));
    expect(fallback).toHaveLength(3);
    for (const s of ["pilea", "palmera", "eucalipto"]) {
      expect(fallback).toContain(s);
      expect(isIllustratedPlantSpecies(s)).toBe(false);
    }
  });

  it("cadenas desconocidas o vacías no son ilustradas", () => {
    expect(isIllustratedPlantSpecies("dinosaurio")).toBe(false);
    expect(isIllustratedPlantSpecies("")).toBe(false);
    expect(isIllustratedPlantSpecies("Monstera")).toBe(false); // sensible a mayúsculas
  });
});

describe("plantAssetPath — mapeo determinista", () => {
  it("compone la ruta con especie + etapa + tema + tamaño", () => {
    expect(plantAssetPath("monstera", "planta-completa", "light", "large")).toBe(
      "/plants/monstera-planta-completa-light-large.webp"
    );
    expect(plantAssetPath("cactus", "semilla", "dark", "small")).toBe("/plants/cactus-semilla-dark-small.webp");
  });

  it("misma entrada → misma ruta (sin seed, sin aleatoriedad)", () => {
    for (const sp of ILLUSTRATED_PLANT_SPECIES) {
      for (const st of STAGES) {
        for (const th of THEMES) {
          for (const sz of SIZES) {
            expect(plantAssetPath(sp, st.key, th, sz)).toBe(plantAssetPath(sp, st.key, th, sz));
          }
        }
      }
    }
  });
});

describe("cobertura de archivos: cada combinación existe en public/plants", () => {
  it("cada especie × etapa × tema × tamaño tiene su WebP", () => {
    let count = 0;
    for (const sp of ILLUSTRATED_PLANT_SPECIES) {
      for (const st of STAGES) {
        for (const th of THEMES) {
          for (const sz of SIZES) {
            const rel = plantAssetPath(sp, st.key, th, sz).replace(/^\/plants\//, "");
            const abs = path.join(PUBLIC_PLANTS, rel);
            expect(fs.existsSync(abs), rel).toBe(true);
            count++;
          }
        }
      }
    }
    expect(count).toBe(ILLUSTRATED_PLANT_SPECIES.length * 5 * 2 * 2); // 9 especies × 5 etapas × 2 temas × 2 tamaños = 180
  });
});

describe("dimensiones intrínsecas", () => {
  it("cada especie ilustrada define small y large con proporción creíble", () => {
    for (const sp of ILLUSTRATED_PLANT_SPECIES) {
      for (const sz of SIZES) {
        const d = PLANT_ASSET_DIMS[sp][sz];
        expect(d.w).toBeGreaterThan(0);
        expect(d.h).toBeGreaterThan(0);
        // proporción no degenerada (hay especies apaisadas como la monstera y
        // verticales como el bambú); solo descartamos relaciones absurdas.
        const ar = d.w / d.h;
        expect(ar).toBeGreaterThan(0.4);
        expect(ar).toBeLessThan(2.5);
      }
      // "small" nunca excede 320 px en su lado mayor; "large" es al menos tan
      // grande como "small" (igual solo cuando la especie ya cabe en 320).
      const L = PLANT_ASSET_DIMS[sp].large;
      const S = PLANT_ASSET_DIMS[sp].small;
      expect(Math.max(S.w, S.h)).toBeLessThanOrEqual(320);
      expect(Math.max(L.w, L.h)).toBeGreaterThanOrEqual(Math.max(S.w, S.h));
    }
  });
});
