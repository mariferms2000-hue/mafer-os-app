import { describe, expect, it } from "vitest";
import {
  POT_SHAPES,
  SPECIES_WITH_POT,
  fitPotted,
  hasPot,
  potAssetPath,
  potFor,
  type PotShape,
} from "../src/lib/garden-pot";
import { GARDEN_SLOTS, SCENE_ASPECT, plantAspect } from "../src/lib/garden-layout";
import { ILLUSTRATED_PLANT_SPECIES } from "../src/lib/plant-assets";

const FORMAS: PotShape[] = ["baja", "media", "alta"];
const SLOTS = [...GARDEN_SLOTS.wide, ...GARDEN_SLOTS.narrow];

describe("las tres formas", () => {
  it("tienen proporción, corte y altura razonables", () => {
    for (const f of FORMAS) {
      const s = POT_SHAPES[f];
      expect(s.aspect, f).toBeGreaterThan(0);
      expect(s.splitY, f).toBeGreaterThan(0);
      expect(s.splitY, f).toBeLessThan(100);
      expect(s.heightFrac, f).toBeGreaterThan(0);
      expect(s.heightFrac, f).toBeLessThan(1);
    }
  });

  it("el cuenco es ancho, el tiesto es alto", () => {
    expect(POT_SHAPES.baja.aspect).toBeGreaterThan(1);
    expect(POT_SHAPES.alta.aspect).toBeLessThan(1);
    expect(POT_SHAPES.baja.aspect).toBeGreaterThan(POT_SHAPES.media.aspect);
    expect(POT_SHAPES.media.aspect).toBeGreaterThan(POT_SHAPES.alta.aspect);
  });

  it("cuanto más abierta es la boca, más abajo se corta", () => {
    // El cuenco se ve casi desde arriba; el tiesto alto, casi de canto.
    expect(POT_SHAPES.baja.splitY).toBeGreaterThan(POT_SHAPES.media.splitY);
    expect(POT_SHAPES.media.splitY).toBeGreaterThan(POT_SHAPES.alta.splitY);
  });

  it("cada forma tiene su archivo en los dos temas", () => {
    for (const f of FORMAS) {
      expect(potAssetPath(f, "claro")).toBe(`/garden/maceta-${f}-claro.webp`);
      expect(potAssetPath(f, "oscuro")).toBe(`/garden/maceta-${f}-oscuro.webp`);
    }
  });
});

describe("asignación por especie", () => {
  it("las 12 especies ilustradas están decididas — ninguna queda al azar", () => {
    for (const sp of ILLUSTRATED_PLANT_SPECIES) {
      const a = potFor(sp);
      if (a) expect(FORMAS, sp).toContain(a.shape);
      else expect(["potos", "pilea"], sp).toContain(sp);
    }
  });

  it("potos y pilea quedan excluidas: su ilustración ya trae recipiente", () => {
    expect(potFor("potos")).toBeNull();
    expect(potFor("pilea")).toBeNull();
    expect(hasPot("potos")).toBe(false);
    expect(hasPot("pilea")).toBe(false);
  });

  it("una especie desconocida nunca recibe maceta inventada", () => {
    expect(potFor("brote-comun")).toBeNull();
    expect(hasPot("")).toBe(false);
  });

  it("son 10 las especies con recipiente compuesto", () => {
    expect(SPECIES_WITH_POT).toHaveLength(10);
    expect(SPECIES_WITH_POT).not.toContain("potos");
    expect(SPECIES_WITH_POT).not.toContain("pilea");
  });

  it("la variedad está repartida: ninguna forma acapara el lote", () => {
    const cuenta = FORMAS.map((f) => SPECIES_WITH_POT.filter((s) => potFor(s)!.shape === f).length);
    for (const c of cuenta) expect(c).toBeGreaterThanOrEqual(3);
    expect(Math.max(...cuenta) - Math.min(...cuenta)).toBeLessThanOrEqual(2);
  });

  it("las especies de base más ancha se hunden más", () => {
    // helecho: base al 90 % del ancho · eucalipto: ramas sueltas, 31 %
    expect(potFor("helecho")!.sink).toBeGreaterThan(potFor("eucalipto")!.sink);
    expect(potFor("olivo")!.sink).toBeGreaterThan(potFor("cactus")!.sink);
  });

  it("todo hundimiento es positivo y moderado", () => {
    for (const sp of SPECIES_WITH_POT) {
      const s = potFor(sp)!.sink;
      expect(s, sp).toBeGreaterThan(0);
      expect(s, sp).toBeLessThanOrEqual(25);
    }
  });
});

describe("composición dentro del sitio", () => {
  it("las excluidas no producen composición", () => {
    for (const slot of SLOTS.slice(0, 3)) {
      expect(fitPotted("potos", slot, SCENE_ASPECT[slot.scene])).toBeNull();
      expect(fitPotted("pilea", slot, SCENE_ASPECT[slot.scene])).toBeNull();
    }
  });

  it("el conjunto nunca excede el alto ni el ancho máximo del sitio", () => {
    for (const slot of SLOTS) {
      for (const sp of SPECIES_WITH_POT) {
        const c = fitPotted(sp, slot, SCENE_ASPECT[slot.scene])!;
        expect(c.assemblyHeight, `${sp} en ${slot.id}`).toBeLessThanOrEqual(slot.height + 1e-6);
        expect(c.assemblyWidth, `${sp} en ${slot.id}`).toBeLessThanOrEqual(slot.maxWidth + 1e-6);
        expect(c.assemblyWidth).toBeGreaterThan(0);
        expect(c.assemblyHeight).toBeGreaterThan(0);
      }
    }
  });

  it("planta y maceta caben dentro de la caja del conjunto", () => {
    for (const slot of SLOTS) {
      for (const sp of SPECIES_WITH_POT) {
        const c = fitPotted(sp, slot, SCENE_ASPECT[slot.scene])!;
        for (const caja of [c.pot, c.plant]) {
          expect(caja.width).toBeGreaterThan(0);
          expect(caja.width).toBeLessThanOrEqual(100 + 1e-6);
          expect(caja.height).toBeGreaterThan(0);
          expect(caja.bottom).toBeGreaterThanOrEqual(0);
          expect(caja.bottom + caja.height, `${sp} en ${slot.id}`).toBeLessThanOrEqual(100 + 1e-6);
        }
      }
    }
  });

  it("la maceta se apoya en la base del conjunto", () => {
    for (const sp of SPECIES_WITH_POT) {
      const slot = GARDEN_SLOTS.wide[0];
      expect(fitPotted(sp, slot, SCENE_ASPECT.wide)!.pot.bottom).toBe(0);
    }
  });

  it("la base de la planta SIEMPRE queda por debajo de la línea de corte", () => {
    // Es la garantía de que la capa frontal la tapa: si no, se verían las
    // raíces, la tierra o la grava.
    for (const slot of SLOTS) {
      for (const sp of SPECIES_WITH_POT) {
        const c = fitPotted(sp, slot, SCENE_ASPECT[slot.scene])!;
        // corte, medido desde la base del conjunto, en % del conjunto
        const corte = c.pot.height * (1 - c.splitY / 100);
        expect(c.plant.bottom, `${sp} en ${slot.id}`).toBeLessThan(corte);
      }
    }
  });

  it("la planta nunca se deforma: conserva la proporción de su lienzo", () => {
    for (const slot of SLOTS) {
      for (const sp of SPECIES_WITH_POT) {
        const c = fitPotted(sp, slot, SCENE_ASPECT[slot.scene])!;
        const anchoPx = (c.plant.width / 100) * c.assemblyWidth;
        const altoPx = (c.plant.height / 100) * c.assemblyHeight;
        const real = (anchoPx * SCENE_ASPECT[slot.scene]) / altoPx;
        expect(real, `${sp} en ${slot.id}`).toBeCloseTo(plantAspect(sp), 3);
      }
    }
  });

  it("la maceta tampoco se deforma", () => {
    for (const slot of SLOTS) {
      for (const sp of SPECIES_WITH_POT) {
        const c = fitPotted(sp, slot, SCENE_ASPECT[slot.scene])!;
        const anchoPx = (c.pot.width / 100) * c.assemblyWidth;
        const altoPx = (c.pot.height / 100) * c.assemblyHeight;
        const real = (anchoPx * SCENE_ASPECT[slot.scene]) / altoPx;
        expect(real, `${sp} en ${slot.id}`).toBeCloseTo(POT_SHAPES[potFor(sp)!.shape].aspect, 3);
      }
    }
  });

  it("es determinista", () => {
    const slot = GARDEN_SLOTS.wide[5];
    const a = fitPotted("helecho", slot, SCENE_ASPECT.wide);
    const b = fitPotted("helecho", slot, SCENE_ASPECT.wide);
    expect(a).toEqual(b);
  });
});
