import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PLANT_SPECIES,
  CURRENT_RENDERER_VERSION,
  SPECIES_TRAITS,
  STAGE_GROWTH,
  hashString,
  newPlantIdentity,
  plantRenderSpec,
  type PlantRenderSpec,
  type PlantSpecies,
} from "../src/lib/plant-render";
import { STAGES, plantStage, type StageKey } from "../src/lib/focus-logic";

/** Fase 7E.2 — el motor de identidad/apariencia es puro y determinista:
 *  misma entrada → misma especificación, byte a byte, para siempre. */

const ALL_STAGES = STAGES.map((s) => s.key);
const spec = (species: PlantSpecies, visualSeed: number, stage: StageKey, rendererVersion = 1) =>
  plantRenderSpec({ species, visualSeed, stage, rendererVersion });

afterEach(() => vi.restoreAllMocks());

describe("identidad al nacer (newPlantIdentity)", () => {
  it("el mismo id produce siempre la misma identidad (estable ante recargas)", () => {
    const id = "410a5ba7-bbe6-4486-87ea-5a37c4bce663";
    const a = newPlantIdentity(id);
    const b = newPlantIdentity(id);
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("la identidad es completa: especie válida, seed uint32, renderer_version 1", () => {
    for (let i = 0; i < 50; i++) {
      const identity = newPlantIdentity(`planta-${i}`);
      expect(PLANT_SPECIES).toContain(identity.species);
      expect(Number.isInteger(identity.visualSeed)).toBe(true);
      expect(identity.visualSeed).toBeGreaterThanOrEqual(0);
      expect(identity.visualSeed).toBeLessThanOrEqual(0xffffffff);
      expect(identity.rendererVersion).toBe(CURRENT_RENDERER_VERSION);
    }
  });

  it("ids distintos producen seeds distintos (50 de 50)", () => {
    const seeds = new Set(Array.from({ length: 50 }, (_, i) => newPlantIdentity(`planta-${i}`).visualSeed));
    expect(seeds.size).toBe(50);
  });

  it("hashString es determinista y devuelve uint32", () => {
    expect(hashString("mafer")).toBe(hashString("mafer"));
    expect(hashString("mafer")).not.toBe(hashString("Mafer"));
    expect(hashString("")).toBeGreaterThanOrEqual(0);
  });
});

describe("determinismo de la especificación", () => {
  it("misma entrada produce exactamente la misma especificación, byte a byte", () => {
    for (const species of PLANT_SPECIES) {
      for (const stage of ALL_STAGES) {
        const a = spec(species, 123456789, stage);
        const b = spec(species, 123456789, stage);
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      }
    }
  });

  it("jamás usa Math.random (llamarlo durante el render sería un error)", () => {
    vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Math.random está prohibido en el motor de render");
    });
    expect(() => spec("olivo", 42, "planta-completa")).not.toThrow();
  });

  it("veinte seeds diferentes generan veinte variantes distinguibles", () => {
    const variants = new Set<string>();
    for (let i = 0; i < 20; i++) {
      variants.add(JSON.stringify(spec("monstera", newPlantIdentity(`p${i}`).visualSeed, "planta-completa")));
    }
    expect(variants.size).toBe(20);
  });

  it("las cinco especies son distinguibles entre sí con el mismo seed", () => {
    const variants = new Set(PLANT_SPECIES.map((sp) => JSON.stringify(spec(sp, 777, "planta-completa"))));
    expect(variants.size).toBe(PLANT_SPECIES.length);
  });

  it("la identidad no cambia al crecer: inclinación, curvatura y proporciones son las mismas en todas las etapas", () => {
    for (const species of PLANT_SPECIES) {
      const byStage = ALL_STAGES.map((stage) => spec(species, 20260716, stage));
      const first = byStage[0];
      for (const s of byStage) {
        expect(s.orientation.leanDeg).toBe(first.orientation.leanDeg);
        expect(s.stem.curvature).toBe(first.stem.curvature);
        expect(s.proportions).toEqual(first.proportions);
      }
    }
  });
});

describe("renderer_version", () => {
  it("v1 queda congelada: snapshot exacto de una entrada conocida", () => {
    // Si esta prueba falla, se cambió la ruta v1 y TODAS las plantas guardadas
    // cambiarían de apariencia. Eso requiere una v2, nunca editar la v1.
    const golden = spec("lavanda", 987654321, "planta-joven");
    expect(golden).toMatchSnapshot();
  });

  it("pedir versión 1 explícitamente enruta a la misma ruta v1", () => {
    const a = plantRenderSpec({ species: "helecho", visualSeed: 55, stage: "hojas", rendererVersion: 1 });
    const b = plantRenderSpec({ species: "helecho", visualSeed: 55, stage: "hojas", rendererVersion: 1 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.rendererVersion).toBe(1);
  });

  it("una versión desconocida es un error explícito, nunca una apariencia inventada", () => {
    expect(() => plantRenderSpec({ species: "olivo", visualSeed: 1, stage: "semilla", rendererVersion: 2 })).toThrow(
      /no soportado/
    );
  });
});

describe("límites seguros", () => {
  const within = (n: number, [lo, hi]: [number, number], slack = 0) => n >= lo - slack && n <= hi + slack;

  it("las cinco especies × cinco etapas × 40 seeds respetan sus límites", () => {
    for (const species of PLANT_SPECIES) {
      const t = SPECIES_TRAITS[species];
      for (const stage of ALL_STAGES) {
        for (let i = 0; i < 40; i++) {
          const s = spec(species, newPlantIdentity(`${species}-${i}`).visualSeed, stage);
          expect(Math.abs(s.orientation.leanDeg)).toBeLessThanOrEqual(t.maxLeanDeg);
          expect(s.height).toBeGreaterThan(0);
          expect(s.height).toBeLessThanOrEqual(t.height[1]);
          expect(s.stem.count).toBeGreaterThanOrEqual(1);
          expect(s.stem.count).toBeLessThanOrEqual(Math.max(1, t.stemCount[1]));
          expect(s.stem.thickness).toBeGreaterThan(0);
          expect(s.stem.thickness).toBeLessThanOrEqual(t.thickness[1]);
          expect(within(s.stem.curvature, t.curvature)).toBe(true);
          expect(s.branches.count).toBeGreaterThanOrEqual(0);
          expect(s.branches.count).toBeLessThanOrEqual(t.branchCount[1]);
          expect(s.leaves.count).toBeGreaterThanOrEqual(0);
          expect(s.leaves.count).toBeLessThanOrEqual(t.leafCountAdult[1]);
          expect(s.leaves.density).toBeGreaterThanOrEqual(0);
          expect(s.leaves.density).toBeLessThanOrEqual(1);
          expect(within(s.proportions.crownWidthRatio, t.crownWidthRatio)).toBe(true);
          expect(within(s.proportions.stemHeightRatio, t.stemHeightRatio)).toBe(true);
          expect(s.branches.arrangement).toBe(t.arrangement);
        }
      }
    }
  });

  it("los detalles botánicos son solo los permitidos por especie y etapa", () => {
    const allowed: Record<PlantSpecies, string[]> = {
      helecho: ["fronda-enrollada", "frondas-arqueadas", "fronda-nueva-central"],
      monstera: ["fenestraciones", "raiz-aerea"],
      suculenta: ["roseta-compacta", "hijuelo-en-base"],
      lavanda: ["espigas-florales", "base-lenosa"],
      olivo: ["copa-redondeada", "tronco-nudoso"],
    };
    for (const species of PLANT_SPECIES) {
      for (const stage of ALL_STAGES) {
        for (let i = 0; i < 10; i++) {
          const s = spec(species, i * 7919, stage);
          for (const d of s.details) expect(allowed[species]).toContain(d);
        }
      }
    }
  });

  it("la monstera es botánicamente honesta: sin fenestraciones antes de planta joven", () => {
    for (const stage of ["semilla", "brote", "hojas"] as const) {
      const s = spec("monstera", 31337, stage);
      expect(s.leaves.shape).toBe("hoja-acorazonada");
      expect(s.details).not.toContain("fenestraciones");
    }
    expect(spec("monstera", 31337, "planta-completa").leaves.shape).toBe("hoja-fenestrada");
  });
});

describe("etapas y crecimiento", () => {
  it("las cinco etapas se derivan de los minutos con los umbrales aprobados", () => {
    expect(plantStage(0)).toBe("semilla");
    expect(plantStage(24)).toBe("semilla");
    expect(plantStage(25)).toBe("brote");
    expect(plantStage(75)).toBe("hojas");
    expect(plantStage(150)).toBe("planta-joven");
    expect(plantStage(299)).toBe("planta-joven");
    expect(plantStage(300)).toBe("planta-completa");
    expect(Object.keys(STAGE_GROWTH).sort()).toEqual([...ALL_STAGES].sort());
  });

  it("crecer nunca encoge: altura y hojas no disminuyen entre etapas", () => {
    for (const species of PLANT_SPECIES) {
      let prev: PlantRenderSpec | null = null;
      for (const stage of ALL_STAGES) {
        const s = spec(species, 8675309, stage);
        if (prev) {
          expect(s.height).toBeGreaterThanOrEqual(prev.height);
          expect(s.leaves.count).toBeGreaterThanOrEqual(prev.leaves.count);
        }
        prev = s;
      }
    }
  });

  it("la semilla apenas asoma: sin ramas ni hojas todavía", () => {
    for (const species of PLANT_SPECIES) {
      const s = spec(species, 424242, "semilla");
      expect(s.branches.count).toBe(0);
      expect(s.leaves.count).toBe(0);
      expect(s.stem.count).toBe(1);
    }
  });
});
