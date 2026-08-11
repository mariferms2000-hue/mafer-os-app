import { describe, expect, it } from "vitest";
import {
  POT_SHAPES,
  SPECIES_WITH_POT,
  fitPotted,
  foliageFraction,
  hasPot,
  potAssetPath,
  potFor,
  type PotShape,
} from "../src/lib/garden-pot";
import {
  GARDEN_SLOTS,
  REFERENCE_FOLIAGE,
  foliageTarget,
  minHeightIn,
  SCENE_ASPECT,
  SPECIES_SCALE,
  plantAspect,
  plantHeightIn,
} from "../src/lib/garden-layout";
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

  it("el porte de la especie NO altera la composición interna", () => {
    // La garantía que hace seguro el sistema de escala: pot y plant se
    // devuelven en % de la caja del conjunto, y esos % son invariantes de
    // escala. Una suculenta chica se asienta en su maceta exactamente igual
    // que una monstera grande — no puede flotar, hundirse ni cortarse.
    const slot = GARDEN_SLOTS.wide.find((s) => s.surface === "repisa-media")!;
    for (const sp of SPECIES_WITH_POT) {
      const normal = fitPotted(sp, slot, SCENE_ASPECT.wide)!;
      const enorme = fitPotted(sp, { ...slot, height: slot.height * 4, maxWidth: 999 }, SCENE_ASPECT.wide)!;
      const chico = fitPotted(sp, { ...slot, height: slot.height / 4, maxWidth: 999 }, SCENE_ASPECT.wide)!;
      for (const otro of [enorme, chico]) {
        expect(otro.pot, sp).toEqual(normal.pot);
        expect(otro.plant, sp).toEqual(normal.plant);
        expect(otro.splitY, sp).toBe(normal.splitY);
      }
    }
  });

  it("con porte, la jerarquía llega al conjunto entero", () => {
    for (const slot of SLOTS) {
      const m = fitPotted("monstera", slot, SCENE_ASPECT[slot.scene])!;
      const s = fitPotted("suculenta", slot, SCENE_ASPECT[slot.scene])!;
      expect(m.assemblyHeight, slot.id).toBeGreaterThan(s.assemblyHeight);
    }
  });

  it("el presupuesto de follaje no pinza a ninguna especie contra el techo", () => {
    // LA INVARIANTE QUE HACE QUE EL PORTE LLEGUE A PANTALLA. Si REFERENCE_FOLIAGE
    // supera el mínimo de foliageFraction/porte, las especies de porte mayor
    // topan TODAS con el alto del sitio y salen exactamente iguales — el fallo
    // que se veía en la escena. REFERENCE_FOLIAGE vive en garden-layout para no
    // crear un ciclo entre los módulos; este test lo mantiene honesto.
    const tope = Math.min(
      ...ILLUSTRATED_PLANT_SPECIES.map((s) => foliageFraction(s) / SPECIES_SCALE[s])
    );
    expect(REFERENCE_FOLIAGE).toBeLessThanOrEqual(tope);
    // Y que no se quede muy por debajo: sería desaprovechar el sitio.
    expect(REFERENCE_FOLIAGE).toBeGreaterThan(tope * 0.9);
  });

  it("la maceta se come una fracción MUY distinta según la forma", () => {
    // Es la causa del fallo original: el tiesto alto le toca a las especies de
    // porte mayor, así que la maceta anulaba la jerarquía.
    const f = SPECIES_WITH_POT.map((s) => foliageFraction(s));
    expect(Math.max(...f) / Math.min(...f)).toBeGreaterThan(1.3);
    expect(foliageFraction("olivo")).toBeLessThan(foliageFraction("suculenta"));
  });

  it("el porte se cumple sobre el FOLLAJE, que es lo que se ve", () => {
    // La prueba que faltaba. Antes se comprobaba sobre la caja del conjunto, y
    // por eso pasaba en verde mientras la escena se veía plana.
    const slot = GARDEN_SLOTS.wide.find((s) => s.surface === "repisa-media")!;
    const follaje = (sp: string) => {
      const c = fitPotted(sp, slot, SCENE_ASPECT.wide);
      const alto = c ? c.assemblyHeight : plantHeightIn(sp, slot);
      return alto * foliageFraction(sp);
    };
    const ref = follaje("monstera");
    for (const sp of ILLUSTRATED_PLANT_SPECIES) {
      const c = fitPotted(sp, slot, SCENE_ASPECT.wide);
      const alto = c ? c.assemblyHeight : plantHeightIn(sp, slot);
      // 1e-3: assemblyHeight viene redondeado a 4 decimales.
      const topeAlto = alto >= slot.height - 1e-3;
      const pedido = foliageTarget(sp, slot) / foliageFraction(sp);
      const topeMinimo = alto <= minHeightIn(slot, foliageFraction(sp), sp, pedido) + 1e-3;
      // El porte se cumple salvo que tope con el techo del sitio o con el suelo
      // de legibilidad; en esos casos el límite manda y se declara aquí.
      if (topeAlto) {
        // el techo del sitio no la dejó llegar
        expect(follaje(sp) / ref, `${sp} topa arriba`).toBeLessThanOrEqual(SPECIES_SCALE[sp] + 1e-6);
        continue;
      }
      if (topeMinimo) {
        // el suelo de legibilidad la levantó
        expect(follaje(sp) / ref, `${sp} topa abajo`).toBeGreaterThanOrEqual(SPECIES_SCALE[sp] - 1e-6);
        continue;
      }
      expect(follaje(sp) / ref, sp).toBeCloseTo(SPECIES_SCALE[sp], 1);
    }
  });

  it("los tres grupos de porte se leen sin ambigüedad", () => {
    const slot = GARDEN_SLOTS.wide.find((s) => s.surface === "repisa-media")!;
    const follaje = (sp: string) => fitPotted(sp, slot, SCENE_ASPECT.wide)!.assemblyHeight * foliageFraction(sp);
    const grandes = ["monstera", "palmera", "bambu", "olivo"];
    const medianas = ["sansevieria", "helecho", "eucalipto"];
    const pequenas = ["cactus", "suculenta", "lavanda"];
    // Cada grupo entero por encima del siguiente, sin solaparse.
    expect(Math.min(...grandes.map(follaje))).toBeGreaterThan(Math.max(...medianas.map(follaje)));
    expect(Math.min(...medianas.map(follaje))).toBeGreaterThan(Math.max(...pequenas.map(follaje)));
  });

  it("una especie grande crece de verdad al bajar al suelo", () => {
    const repisa = GARDEN_SLOTS.wide.find((s) => s.surface === "repisa-media")!;
    const suelo = GARDEN_SLOTS.wide.find((s) => s.surface === "piso")!;
    const follaje = (sp: string, s: typeof repisa) =>
      fitPotted(sp, s, SCENE_ASPECT.wide)!.assemblyHeight * foliageFraction(sp);
    expect(follaje("monstera", suelo) / follaje("monstera", repisa)).toBeGreaterThan(1.6);
    // …y una pequeña sigue siendo pequeña ahí abajo.
    expect(follaje("suculenta", suelo)).toBeLessThan(follaje("monstera", suelo) * 0.6);
  });

  it("es determinista", () => {
    const slot = GARDEN_SLOTS.wide[5];
    const a = fitPotted("helecho", slot, SCENE_ASPECT.wide);
    const b = fitPotted("helecho", slot, SCENE_ASPECT.wide);
    expect(a).toEqual(b);
  });
});

describe("la pilea", () => {
  // Es la única pequeña sin maceta compuesta: a igual follaje, su objeto entero
  // mide un tercio menos que el de una lavanda o un cactus, porque a ellas la
  // cerámica les añade masa y a ella no. Por eso lleva más porte que el resto
  // del grupo — para acabar leyéndose del mismo tamaño hacia arriba, no menor.
  const foll = (sp: string, slot: (typeof GARDEN_SLOTS.wide)[number]) => {
    const c = fitPotted(sp, slot, SCENE_ASPECT.wide);
    const alto = c ? c.assemblyHeight : plantHeightIn(sp, slot);
    return alto * foliageFraction(sp);
  };

  it("no lleva maceta compuesta: su lienzo es todo follaje", () => {
    expect(hasPot("pilea")).toBe(false);
    expect(foliageFraction("pilea")).toBeGreaterThan(0.9);
  });

  it("queda por encima del grupo más tímido y por debajo de las medianas", () => {
    const rb = GARDEN_SLOTS.wide.find((s) => s.surface === "repisa-baja")!;
    for (const menor of ["cactus", "suculenta", "lavanda", "potos"]) {
      expect(foll("pilea", rb), `pilea vs ${menor}`).toBeGreaterThan(foll(menor, rb));
    }
    for (const mediana of ["eucalipto", "helecho", "sansevieria"]) {
      expect(foll("pilea", rb), `pilea vs ${mediana}`).toBeLessThan(foll(mediana, rb));
    }
  });

  it("sigue siendo pequeña: no llega ni a la mitad de una grande", () => {
    const rb = GARDEN_SLOTS.wide.find((s) => s.surface === "repisa-baja")!;
    expect(foll("pilea", rb)).toBeLessThan(foll("monstera", rb) * 0.7);
  });
});
