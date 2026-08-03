import { describe, expect, it } from "vitest";
import {
  GARDEN_SLOTS,
  MAX_ROOM_PLANTS,
  PROPAGATION_SPOT,
  SCENE_ASPECT,
  fillIndex,
  fitPlant,
  placePlants,
  plantAspect,
  roomCapacity,
  type GardenBreakpoint,
  type GardenSlot,
} from "../src/lib/garden-layout";
import { ILLUSTRATED_PLANT_SPECIES, PLANT_ASSET_DIMS } from "../src/lib/plant-assets";

const BREAKPOINTS: GardenBreakpoint[] = ["wide", "narrow"];

/** Repisas de una composición, de arriba abajo: la de más abajo tiene encima
 *  a la anterior y no puede invadirla. */
const STACK: Record<GardenBreakpoint, string[]> = {
  wide: ["repisa-alta", "repisa-media", "repisa-baja", "piso"],
  narrow: ["repisa-baja", "piso"],
};

const bySurface = (slots: GardenSlot[], surface: string) => slots.filter((s) => s.surface === surface);

describe("slots de la escena", () => {
  for (const bp of BREAKPOINTS) {
    describe(bp, () => {
      const slots = GARDEN_SLOTS[bp];

      it("tiene sitios y todos con id único", () => {
        expect(slots.length).toBeGreaterThan(0);
        expect(new Set(slots.map((s) => s.id)).size).toBe(slots.length);
      });

      it("todo queda dentro de la escena", () => {
        for (const s of slots) {
          expect(s.x).toBeGreaterThan(0);
          expect(s.x).toBeLessThan(100);
          expect(s.baseline).toBeGreaterThan(0);
          expect(s.baseline).toBeLessThanOrEqual(100);
          // la planta no puede salirse por arriba
          expect(s.baseline - s.height).toBeGreaterThanOrEqual(0);
          // ni por los lados
          expect(s.x - s.maxWidth / 2).toBeGreaterThanOrEqual(0);
          expect(s.x + s.maxWidth / 2).toBeLessThanOrEqual(100);
        }
      });

      it("el orden visual es único y consecutivo", () => {
        const orders = slots.map((s) => s.order).sort((a, b) => a - b);
        expect(orders).toEqual(slots.map((_, i) => i));
      });

      it("dos plantas vecinas de la misma superficie nunca se solapan", () => {
        const surfaces = [...new Set(slots.map((s) => s.surface))];
        for (const surface of surfaces) {
          const row = bySurface(slots, surface).sort((a, b) => a.x - b.x);
          for (let i = 1; i < row.length; i++) {
            const gap = row[i].x - row[i - 1].x;
            const needed = row[i].maxWidth / 2 + row[i - 1].maxWidth / 2;
            expect(gap, `${row[i - 1].id} ↔ ${row[i].id}`).toBeGreaterThanOrEqual(needed);
          }
        }
      });

      it("una planta nunca atraviesa la repisa de arriba", () => {
        const stack = STACK[bp];
        for (let i = 1; i < stack.length; i++) {
          const arriba = bySurface(slots, stack[i - 1]);
          const abajo = bySurface(slots, stack[i]);
          if (!arriba.length || !abajo.length) continue;
          const techo = Math.max(...arriba.map((s) => s.baseline));
          for (const s of abajo) {
            expect(s.baseline - s.height, `${s.id} bajo ${stack[i - 1]}`).toBeGreaterThanOrEqual(techo);
          }
        }
      });

      it("la profundidad se nota: las plantas del suelo son mayores que las de la repisa más alta disponible", () => {
        const piso = bySurface(slots, "piso")[0];
        const arriba = STACK[bp].map((s) => bySurface(slots, s)[0]).find((s) => s && s.surface !== "piso")!;
        expect(piso.height).toBeGreaterThan(arriba.height);
      });

      it("la mesa de propagación no pisa ningún slot de plantas", () => {
        const p = PROPAGATION_SPOT[bp];
        expect(slots.some((s) => s.id === p.id)).toBe(false);
        for (const s of slots) {
          const solapaX = Math.abs(s.x - p.x) < s.maxWidth / 2 + p.maxWidth / 2;
          const solapaY = s.baseline > p.baseline - p.height && s.baseline - s.height < p.baseline;
          expect(solapaX && solapaY, `${s.id} choca con la mesa`).toBe(false);
        }
      });
    });
  }

  it("los ids de la composición estrecha existen también en la amplia", () => {
    const wide = new Set(GARDEN_SLOTS.wide.map((s) => s.id));
    for (const s of GARDEN_SLOTS.narrow) expect(wide.has(s.id)).toBe(true);
  });

  it("el cuarto es una vitrina: capacidad acotada y menor en móvil", () => {
    expect(roomCapacity("wide")).toBe(18);
    // Móvil: sobre la misma ilustración solo caben con dignidad la repisa baja
    // y el suelo — el resto de la colección sigue entero en el invernadero.
    expect(roomCapacity("narrow")).toBe(4);
    expect(roomCapacity("narrow")).toBeLessThan(roomCapacity("wide"));
    expect(MAX_ROOM_PLANTS).toBe(18);
  });
});

describe("tamaño de cada planta", () => {
  it("conoce la proporción real de las 12 especies ilustradas", () => {
    for (const species of ILLUSTRATED_PLANT_SPECIES) {
      const { w, h } = PLANT_ASSET_DIMS[species].large;
      expect(plantAspect(species)).toBeCloseTo(w / h, 6);
    }
  });

  it("una especie desconocida cae al lienzo del motor SVG", () => {
    expect(plantAspect("brote-comun")).toBeCloseTo(96 / 88, 6);
  });

  it("ninguna especie supera nunca el ancho máximo de su slot", () => {
    for (const bp of BREAKPOINTS) {
      for (const slot of GARDEN_SLOTS[bp]) {
        for (const species of ILLUSTRATED_PLANT_SPECIES) {
          const box = fitPlant(species, slot, bp);
          expect(box.width, `${species} en ${slot.id}`).toBeLessThanOrEqual(slot.maxWidth + 1e-6);
          expect(box.height).toBeLessThanOrEqual(slot.height + 1e-6);
          expect(box.width).toBeGreaterThan(0);
          expect(box.height).toBeGreaterThan(0);
        }
      }
    }
  });

  it("nunca deforma: la caja conserva la proporción del lienzo", () => {
    for (const bp of BREAKPOINTS) {
      for (const slot of GARDEN_SLOTS[bp]) {
        for (const species of ILLUSTRATED_PLANT_SPECIES) {
          const { width, height } = fitPlant(species, slot, bp);
          // % de ancho y de alto se miden sobre ejes distintos: hay que
          // devolverlos a píxeles con la proporción de la escena.
          const aspectoReal = (width * SCENE_ASPECT[bp]) / height;
          expect(aspectoReal, `${species} en ${slot.id}`).toBeCloseTo(plantAspect(species), 3);
        }
      }
    }
  });

  it("una especie ancha se recorta y una estrecha no", () => {
    const slot = GARDEN_SLOTS.wide.find((s) => s.surface === "repisa-alta")!;
    const monstera = fitPlant("monstera", slot, "wide"); // 411×318, apaisada
    const bambu = fitPlant("bambu", slot, "wide"); // 263×282, vertical
    expect(monstera.height).toBeLessThan(slot.height); // recortada
    expect(bambu.height).toBeCloseTo(slot.height, 4); // cabe entera
  });
});

describe("reparto de plantas", () => {
  const plantas = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}` }));

  it("es determinista: dos llamadas idénticas dan el mismo resultado", () => {
    const a = placePlants(plantas(10), "wide");
    const b = placePlants(plantas(10), "wide");
    expect(a.map((x) => [x.slot.id, x.plant.id])).toEqual(b.map((x) => [x.slot.id, x.plant.id]));
  });

  it("la más reciente ocupa el primer sitio del orden de llenado", () => {
    const [primera] = placePlants(plantas(5), "wide");
    expect(primera.plant.id).toBe("p0");
    expect(primera.slot.id).toBe("repisa-media-2");
  });

  it("nunca coloca dos plantas en el mismo sitio", () => {
    for (const bp of BREAKPOINTS) {
      const puestas = placePlants(plantas(50), bp);
      expect(new Set(puestas.map((p) => p.slot.id)).size).toBe(puestas.length);
    }
  });

  it("se detiene en la capacidad del cuarto — el resto va al invernadero", () => {
    for (const bp of BREAKPOINTS) {
      expect(placePlants(plantas(500), bp)).toHaveLength(roomCapacity(bp));
    }
  });

  it("con pocas plantas la escena queda repartida, no amontonada", () => {
    const puestas = placePlants(plantas(5), "wide");
    const superficies = new Set(puestas.map((p) => p.slot.surface));
    // Las cuatro superficies del cuarto quedan estrenadas con solo 5 plantas.
    expect(superficies.size).toBe(4);
  });

  it("un jardín vacío no coloca nada", () => {
    expect(placePlants([], "wide")).toEqual([]);
    expect(placePlants([], "narrow")).toEqual([]);
  });

  it("el orden de llenado solo nombra slots que existen", () => {
    for (const bp of BREAKPOINTS) {
      const ids = new Set(GARDEN_SLOTS[bp].map((s) => s.id));
      for (const s of GARDEN_SLOTS[bp]) {
        expect(fillIndex(s.id, bp), `${s.id} sin lugar en el orden de llenado`).toBeGreaterThanOrEqual(0);
      }
      expect(placePlants(plantas(roomCapacity(bp)), bp).every((p) => ids.has(p.slot.id))).toBe(true);
    }
  });

  it("las primeras plantas de escritorio son también las de móvil: nada salta de sitio al cambiar de pantalla", () => {
    const n = roomCapacity("narrow");
    const wide = placePlants(plantas(n), "wide").map((p) => p.plant.id);
    const narrow = placePlants(plantas(n), "narrow").map((p) => p.plant.id);
    expect(new Set(narrow)).toEqual(new Set(wide.slice(0, n)));
  });
});
