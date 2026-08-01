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
  it("reconoce las 6 especies ilustradas (piloto + Bloque 1)", () => {
    expect([...ILLUSTRATED_PLANT_SPECIES].sort()).toEqual(["cactus", "helecho", "lavanda", "monstera", "olivo", "suculenta"]);
    for (const s of ILLUSTRATED_PLANT_SPECIES) expect(isIllustratedPlantSpecies(s)).toBe(true);
  });

  it("las 6 especies aún no integradas caen al fallback (no ilustradas)", () => {
    const fallback = PLANT_SPECIES_V2.filter((s) => !isIllustratedPlantSpecies(s));
    expect(fallback).toHaveLength(6);
    for (const s of ["bambu", "sansevieria", "pilea", "palmera", "eucalipto", "potos"]) {
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
    expect(count).toBe(ILLUSTRATED_PLANT_SPECIES.length * 5 * 2 * 2); // 6 especies × 5 etapas × 2 temas × 2 tamaños = 120
  });
});

describe("dimensiones intrínsecas", () => {
  it("cada especie ilustrada define small y large con proporción horizontal creíble", () => {
    for (const sp of ILLUSTRATED_PLANT_SPECIES) {
      for (const sz of SIZES) {
        const d = PLANT_ASSET_DIMS[sp][sz];
        expect(d.w).toBeGreaterThan(0);
        expect(d.h).toBeGreaterThan(0);
        expect(d.w).toBeGreaterThanOrEqual(d.h); // lienzo apaisado como la lámina
      }
      // el "large" es de mayor resolución que el "small"
      expect(PLANT_ASSET_DIMS[sp].large.w).toBeGreaterThan(PLANT_ASSET_DIMS[sp].small.w);
    }
  });
});
