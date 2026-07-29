import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PLANT_SPECIES_V2,
  CURRENT_RENDERER_VERSION_V2,
  SPECIES_TRAITS_V2,
  STAGE_GROWTH_V2,
  hashStringV2,
  newPlantIdentityV2,
  plantRenderSpecV2,
  isKnownSpeciesV2,
  type PlantRenderSpecV2,
  type PlantSpeciesV2,
} from "../src/lib/plant-render-v2";
import { STAGES, plantStage } from "../src/lib/focus-logic";

/** Motor v2 (rediseño de plantas) — mismo rigor que v1: puro y determinista,
 *  misma entrada → misma especificación, byte a byte, para siempre en
 *  cuanto se apruebe visualmente. */

const ALL_STAGES = STAGES.map((s) => s.key);
const spec = (species: PlantSpeciesV2, visualSeed: number, stage: (typeof ALL_STAGES)[number]) =>
  plantRenderSpecV2({ species, visualSeed, stage });

afterEach(() => vi.restoreAllMocks());

describe("PLANT_SPECIES_V2", () => {
  it("tiene exactamente 12 especies, incluidas las 5 originales de v1", () => {
    expect(PLANT_SPECIES_V2).toHaveLength(12);
    for (const original of ["helecho", "monstera", "suculenta", "lavanda", "olivo"]) {
      expect(PLANT_SPECIES_V2).toContain(original);
    }
  });

  it("isKnownSpeciesV2 reconoce las 12 y rechaza cualquier otra cosa", () => {
    for (const s of PLANT_SPECIES_V2) expect(isKnownSpeciesV2(s)).toBe(true);
    expect(isKnownSpeciesV2("dinosaurio")).toBe(false);
    expect(isKnownSpeciesV2("")).toBe(false);
  });
});

describe("identidad al nacer (newPlantIdentityV2)", () => {
  it("el mismo id produce siempre la misma identidad", () => {
    const id = "410a5ba7-bbe6-4486-87ea-5a37c4bce663";
    const a = newPlantIdentityV2(id);
    const b = newPlantIdentityV2(id);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("la identidad es completa: especie de las 12, seed uint32, renderer_version 2", () => {
    for (let i = 0; i < 60; i++) {
      const identity = newPlantIdentityV2(`planta-${i}`);
      expect(PLANT_SPECIES_V2).toContain(identity.species);
      expect(Number.isInteger(identity.visualSeed)).toBe(true);
      expect(identity.visualSeed).toBeGreaterThanOrEqual(0);
      expect(identity.visualSeed).toBeLessThanOrEqual(0xffffffff);
      expect(identity.rendererVersion).toBe(CURRENT_RENDERER_VERSION_V2);
    }
  });

  it("ids distintos producen seeds distintos (60 de 60)", () => {
    const seeds = new Set(Array.from({ length: 60 }, (_, i) => newPlantIdentityV2(`planta-${i}`).visualSeed));
    expect(seeds.size).toBe(60);
  });

  it("con suficientes plantas, las 12 especies aparecen (sin sesgo severo)", () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 600; i++) {
      const sp = newPlantIdentityV2(`muestra-${i}`).species;
      counts.set(sp, (counts.get(sp) ?? 0) + 1);
    }
    expect(counts.size).toBe(12);
    for (const sp of PLANT_SPECIES_V2) expect(counts.get(sp) ?? 0).toBeGreaterThan(0);
  });

  it("hashStringV2 es determinista y devuelve uint32", () => {
    expect(hashStringV2("mafer")).toBe(hashStringV2("mafer"));
    expect(hashStringV2("mafer")).not.toBe(hashStringV2("Mafer"));
    expect(hashStringV2("")).toBeGreaterThanOrEqual(0);
  });
});

describe("determinismo de la especificación", () => {
  it("misma entrada produce exactamente la misma especificación, byte a byte", () => {
    for (const species of PLANT_SPECIES_V2) {
      for (const stage of ALL_STAGES) {
        const a = spec(species, 123456789, stage);
        const b = spec(species, 123456789, stage);
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      }
    }
  });

  it("jamás usa Math.random", () => {
    vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Math.random está prohibido en el motor de render");
    });
    expect(() => spec("olivo", 42, "planta-completa")).not.toThrow();
    expect(() => spec("bambu", 42, "planta-completa")).not.toThrow();
    expect(() => spec("palmera", 42, "planta-completa")).not.toThrow();
  });

  it("veinte seeds diferentes generan veinte variantes distinguibles", () => {
    const variants = new Set<string>();
    for (let i = 0; i < 20; i++) {
      variants.add(JSON.stringify(spec("monstera", newPlantIdentityV2(`p${i}`).visualSeed, "planta-completa")));
    }
    expect(variants.size).toBe(20);
  });

  it("las doce especies son distinguibles entre sí con el mismo seed", () => {
    const variants = new Set(PLANT_SPECIES_V2.map((sp) => JSON.stringify(spec(sp, 777, "planta-completa"))));
    expect(variants.size).toBe(PLANT_SPECIES_V2.length);
  });

  it("la identidad no cambia al crecer: inclinación, curvatura y proporciones son las mismas en todas las etapas", () => {
    for (const species of PLANT_SPECIES_V2) {
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

describe("compatibilidad con plantas v1 (adaptador)", () => {
  it("una identidad v1 (especie de las 5 originales + su seed guardado) se puede alimentar directo al motor v2", () => {
    // Simula una planta nacida hace tiempo bajo v1: solo importan especie/seed/etapa.
    const especieV1 = "olivo";
    const seedV1 = 555444333;
    const a = plantRenderSpecV2({ species: especieV1, visualSeed: seedV1, stage: "planta-completa" });
    const b = plantRenderSpecV2({ species: especieV1, visualSeed: seedV1, stage: "planta-completa" });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.species).toBe("olivo");
  });
});

describe("congelamiento v2", () => {
  it("snapshot exacto de una entrada conocida — una vez aprobado visualmente, no se debe editar sin subir a v3", () => {
    const golden = spec("palmera", 987654321, "planta-joven");
    expect(golden).toMatchSnapshot();
  });
});

describe("límites seguros", () => {
  const within = (n: number, [lo, hi]: [number, number], slack = 0) => n >= lo - slack && n <= hi + slack;

  it("las doce especies × cinco etapas × 30 seeds respetan sus límites", () => {
    for (const species of PLANT_SPECIES_V2) {
      const t = SPECIES_TRAITS_V2[species];
      for (const stage of ALL_STAGES) {
        for (let i = 0; i < 30; i++) {
          const s = spec(species, newPlantIdentityV2(`${species}-${i}`).visualSeed, stage);
          expect(Math.abs(s.orientation.leanDeg)).toBeLessThanOrEqual(t.maxLeanDeg);
          expect(s.height).toBeGreaterThan(0);
          expect(s.height).toBeLessThanOrEqual(t.height[1]);
          expect(s.stem.count).toBeGreaterThanOrEqual(1);
          expect(s.stem.count).toBeLessThanOrEqual(Math.max(1, t.stemCount[1]));
          expect(s.stem.thickness).toBeGreaterThan(0);
          expect(s.stem.thickness).toBeLessThanOrEqual(t.thickness[1]);
          expect(within(s.stem.curvature, t.curvature)).toBe(true);
          expect(s.branches.count).toBeGreaterThanOrEqual(0);
          expect(s.branches.count).toBeLessThanOrEqual(Math.max(0, t.branchCount[1]));
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
    const allowed: Record<PlantSpeciesV2, string[]> = {
      helecho: ["fronda-enrollada", "frondas-arqueadas", "fronda-nueva-central"],
      monstera: ["fenestraciones", "raiz-aerea"],
      suculenta: ["roseta-compacta", "hijuelo-en-base"],
      lavanda: ["espigas-florales", "base-lenosa"],
      olivo: ["copa-redondeada", "tronco-nudoso"],
      bambu: ["nudos-marcados", "caña-nueva"],
      cactus: ["espinas", "flor-cactus"],
      potos: ["hojas-colgantes", "raiz-aerea-potos"],
      sansevieria: ["borde-hoja", "hoja-nueva-central"],
      pilea: ["hojas-monedas", "hijuelo-pilea"],
      palmera: ["corona-radial", "fronda-seca"],
      eucalipto: ["follaje-aireado", "corteza-desprendida"],
    };
    for (const species of PLANT_SPECIES_V2) {
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

describe("etapas y crecimiento (ciclo de 150 minutos — sin cambios)", () => {
  it("las cinco etapas se derivan de los minutos con los umbrales aprobados, sin tocar el ciclo", () => {
    expect(plantStage(0)).toBe("semilla");
    expect(plantStage(14)).toBe("semilla");
    expect(plantStage(15)).toBe("brote");
    expect(plantStage(40)).toBe("hojas");
    expect(plantStage(80)).toBe("planta-joven");
    expect(plantStage(149)).toBe("planta-joven");
    expect(plantStage(150)).toBe("planta-completa");
    expect(Object.keys(STAGE_GROWTH_V2).sort()).toEqual([...ALL_STAGES].sort());
  });

  it("crecer nunca encoge: altura y hojas no disminuyen entre etapas", () => {
    for (const species of PLANT_SPECIES_V2) {
      let prev: PlantRenderSpecV2 | null = null;
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
    for (const species of PLANT_SPECIES_V2) {
      const s = spec(species, 424242, "semilla");
      expect(s.branches.count).toBe(0);
      expect(s.leaves.count).toBe(0);
      expect(s.stem.count).toBe(1);
    }
  });
});
