import { describe, expect, it } from "vitest";
import {
  GARDEN_SLOTS,
  MAX_ROOM_PLANTS,
  MIN_PLANT_HEIGHT,
  PLANT_INK,
  PROPAGATION_SPOT,
  SCENE_ASPECT,
  SCENES_FOR,
  SPECIES_SCALE,
  fillIndex,
  fitPlant,
  foliageTarget,
  minHeightIn,
  placePlants,
  plantAspect,
  plantHeightIn,
  roomCapacity,
  speciesScale,
  type GardenBreakpoint,
  type GardenSlot,
} from "../src/lib/garden-layout";
import { ILLUSTRATED_PLANT_SPECIES, PLANT_ASSET_DIMS } from "../src/lib/plant-assets";
import { SPECIES_WITH_POT, fitPotted } from "../src/lib/garden-pot";

const BREAKPOINTS: GardenBreakpoint[] = ["wide", "narrow"];

/** Repisas de una composición, de arriba abajo: la de más abajo tiene encima
 *  a la anterior y no puede invadirla. */
const STACK: Record<GardenBreakpoint, string[]> = {
  wide: ["repisa-alta", "repisa-media", "repisa-baja", "piso"],
  narrow: ["repisa-alta", "repisa-media", "repisa-baja", "piso"],
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
          // (todas las de una superficie viven en el mismo lienzo)
          expect(new Set(row.map((s) => s.scene)).size).toBe(1);
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
        // Solo puede chocar con lo que comparte lienzo con ella.
        for (const s of slots.filter((s) => s.scene === p.scene)) {
          const solapaX = Math.abs(s.x - p.x) < s.maxWidth / 2 + p.maxWidth / 2;
          const solapaY = s.baseline > p.baseline - p.height && s.baseline - s.height < p.baseline;
          expect(solapaX && solapaY, `${s.id} choca con la mesa`).toBe(false);
        }
      });
    });
  }

  it("un id compartido entre composiciones significa siempre la misma superficie", () => {
    // El alféizar solo existe en móvil por ahora; lo que sí debe cumplirse es
    // que «repisa-media-2» sea la repisa media en las dos, para que un acomodo
    // guardado (PR siguiente) signifique lo mismo en cualquier pantalla.
    const wide = new Map(GARDEN_SLOTS.wide.map((s) => [s.id, s.surface]));
    for (const s of GARDEN_SLOTS.narrow) {
      const enAmplia = wide.get(s.id);
      if (enAmplia) expect(enAmplia, s.id).toBe(s.surface);
    }
  });

  it("cada slot vive en un lienzo declarado y con proporción conocida", () => {
    for (const bp of BREAKPOINTS) {
      for (const s of GARDEN_SLOTS[bp]) {
        expect(SCENES_FOR[bp]).toContain(s.scene);
        expect(SCENE_ASPECT[s.scene]).toBeGreaterThan(0);
      }
      expect(SCENES_FOR[bp]).toContain(PROPAGATION_SPOT[bp].scene);
    }
  });

  it("móvil reparte el cuarto en dos vistas: la planta actual arriba, la colección abajo", () => {
    // El panel A es el retrato de la planta actual sobre su banco; en esta
    // habitación el banco tapa el alféizar y no hay más superficie útil ahí.
    expect(PROPAGATION_SPOT.narrow.scene).toBe("movil-a");
    expect(GARDEN_SLOTS.narrow.every((s) => s.scene === "movil-b")).toBe(true);
    expect(new Set(GARDEN_SLOTS.narrow.map((s) => s.surface))).toEqual(
      new Set(["repisa-alta", "repisa-media", "repisa-baja", "piso"])
    );
  });

  it("el cuarto es una vitrina: capacidad acotada y menor en móvil", () => {
    expect(roomCapacity("wide")).toBe(19);
    // Móvil reparte el cuarto en dos vistas y recupera casi todo el aforo.
    expect(roomCapacity("narrow")).toBe(16);
    expect(roomCapacity("narrow")).toBeLessThan(roomCapacity("wide"));
    expect(MAX_ROOM_PLANTS).toBe(19);
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
          const box = fitPlant(species, slot);
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
          const { width, height } = fitPlant(species, slot);
          // % de ancho y de alto se miden sobre ejes distintos: hay que
          // devolverlos a píxeles con la proporción de la escena.
          const aspectoReal = (width * SCENE_ASPECT[slot.scene]) / height;
          expect(aspectoReal, `${species} en ${slot.id}`).toBeCloseTo(plantAspect(species), 3);
        }
      }
    }
  });

  it("recorta por ancho solo cuando hace falta, y sin deformar", () => {
    // Un sitio deliberadamente estrecho: la especie apaisada topa de lado y la
    // vertical no. Lo que no puede pasar nunca es que se deforme.
    const base = GARDEN_SLOTS.wide.find((s) => s.surface === "repisa-media")!;
    const estrecho = { ...base, maxWidth: 5.5 };
    const monstera = fitPlant("monstera", estrecho); // 411×318, apaisada
    const bambu = fitPlant("bambu", estrecho); // 263×282, vertical
    expect(monstera.width).toBeCloseTo(5.5, 4);
    expect(monstera.height).toBeLessThan(plantHeightIn("monstera", estrecho));
    expect(bambu.height).toBeCloseTo(plantHeightIn("bambu", estrecho), 4);
  });
});

describe("el suelo del escritorio", () => {
  // El hueco libre del cuarto: el banco de propagación termina en el 40 % y la
  // caja de madera (con la regadera detrás) empieza en el 74 %.
  const BANCO_FIN = 40;
  const CAJA_INICIO = 74;
  const piso = GARDEN_SLOTS.wide.filter((s) => s.surface === "piso").sort((a, b) => a.x - b.x);

  it("la fila entera cabe entre el banco y la caja de madera", () => {
    for (const s of piso) {
      expect(s.x - s.maxWidth / 2, `${s.id} pisa el banco`).toBeGreaterThanOrEqual(BANCO_FIN);
      expect(s.x + s.maxWidth / 2, `${s.id} pisa la caja`).toBeLessThanOrEqual(CAJA_INICIO);
    }
  });

  it("ningún conjunto planta+maceta choca con su vecino", () => {
    // Se comprueba con el ancho REAL de cada conjunto, no con el ancho máximo
    // del sitio: es lo que de verdad se pinta.
    for (let i = 1; i < piso.length; i++) {
      for (const a of SPECIES_WITH_POT) {
        for (const b of SPECIES_WITH_POT) {
          const izq = fitPotted(a, piso[i - 1], SCENE_ASPECT.wide)!;
          const der = fitPotted(b, piso[i], SCENE_ASPECT.wide)!;
          const separacion = piso[i].x - piso[i - 1].x;
          const necesaria = izq.assemblyWidth / 2 + der.assemblyWidth / 2;
          expect(separacion, `${a} ↔ ${b} en el suelo`).toBeGreaterThanOrEqual(necesaria);
        }
      }
    }
  });

  it("el ancho ya no es lo que manda: una planta de suelo supera a la misma en repisa", () => {
    // Era el fallo original: con maxWidth 9 la monstera de suelo topaba de lado
    // y se quedaba MÁS BAJA que la de repisa, anulando la profundidad.
    const repisa = GARDEN_SLOTS.wide.find((s) => s.surface === "repisa-media")!;
    const suelo = piso[0];
    for (const sp of SPECIES_WITH_POT) {
      const enRepisa = fitPotted(sp, repisa, SCENE_ASPECT.wide)!;
      const enSuelo = fitPotted(sp, suelo, SCENE_ASPECT.wide)!;
      expect(enSuelo.assemblyHeight, sp).toBeGreaterThan(enRepisa.assemblyHeight);
    }
  });
});

describe("porte por especie", () => {
  const SLOTS = [...GARDEN_SLOTS.wide, ...GARDEN_SLOTS.narrow];

  it("las 12 especies ilustradas tienen porte decidido — ninguna al azar", () => {
    for (const sp of ILLUSTRATED_PLANT_SPECIES) {
      expect(SPECIES_SCALE[sp], sp).toBeGreaterThan(0);
    }
  });

  it("ningún porte pasa de 1: el sistema solo puede achicar", () => {
    // Es la garantía de que el porte jamás desborda un sitio ni invade a la
    // vecina: el alto del sitio sigue siendo un techo duro.
    for (const [sp, k] of Object.entries(SPECIES_SCALE)) {
      expect(k, sp).toBeLessThanOrEqual(1);
      expect(k, sp).toBeGreaterThan(0);
    }
  });

  it("una especie desconocida conserva el alto del sitio", () => {
    expect(speciesScale("brote-comun")).toBe(1);
    // Sin lámina medida se asume tinta llena, así que el alto es el objetivo de
    // follaje de una especie de porte 1: nunca una corrección inventada.
    const slot = GARDEN_SLOTS.wide[0];
    expect(plantHeightIn("brote-comun", slot)).toBeCloseTo(foliageTarget("brote-comun", slot), 4);
  });

  it("la jerarquía se nota: una monstera no se lee como una suculenta", () => {
    for (const slot of SLOTS) {
      const m = plantHeightIn("monstera", slot);
      const s = plantHeightIn("suculenta", slot);
      expect(m, slot.id).toBeGreaterThan(s);
    }
    // En la repisa, donde el mínimo es más bajo, la jerarquía sale entera.
    const repisa = GARDEN_SLOTS.wide.find((s) => s.surface === "repisa-media")!;
    expect(plantHeightIn("monstera", repisa) / plantHeightIn("suculenta", repisa)).toBeGreaterThan(2);
  });

  it("el suelo pide un mínimo mayor: ahí una planta chica se vería perdida, no pequeña", () => {
    const repisa = GARDEN_SLOTS.wide.find((s) => s.surface === "repisa-media")!;
    const piso = GARDEN_SLOTS.wide.find((s) => s.surface === "piso")!;
    expect(MIN_PLANT_HEIGHT.wide.piso).toBeGreaterThan(MIN_PLANT_HEIGHT.wide.repisa);
    // La misma suculenta es claramente mayor en el suelo que en la repisa.
    expect(plantHeightIn("suculenta", piso)).toBeGreaterThan(plantHeightIn("suculenta", repisa));
  });

  it("el móvil pide un mínimo mayor que el escritorio: el mismo % vale menos px", () => {
    // 6.5 % son 47 px en la escena amplia y solo 24 px en el panel móvil.
    expect(MIN_PLANT_HEIGHT["movil-b"].repisa).toBeGreaterThan(MIN_PLANT_HEIGHT.wide.repisa);
    expect(MIN_PLANT_HEIGHT["movil-b"].piso).toBeGreaterThan(MIN_PLANT_HEIGHT.wide.piso);
  });

  it("el orden de porte es coherente de la mayor a la menor", () => {
    const orden = ["monstera", "olivo", "sansevieria", "helecho", "lavanda", "cactus", "suculenta"];
    for (let i = 1; i < orden.length; i++) {
      expect(SPECIES_SCALE[orden[i - 1]], `${orden[i - 1]} > ${orden[i]}`).toBeGreaterThan(
        SPECIES_SCALE[orden[i]]
      );
    }
  });

  it("nunca supera el alto del sitio ni baja del suelo de legibilidad", () => {
    for (const slot of SLOTS) {
      for (const sp of ILLUSTRATED_PLANT_SPECIES) {
        const h = plantHeightIn(sp, slot);
        expect(h, `${sp} en ${slot.id}`).toBeLessThanOrEqual(slot.height + 1e-6);
        // El suelo de legibilidad se acota a lo que mediría la misma especie
        // con porte 1: nunca puede levantar a una pequeña por encima de una
        // grande. Por eso el mínimo efectivo es el menor de los dos.
        const pedido = foliageTarget(sp, slot) / PLANT_INK[sp].fy;
        expect(h, `${sp} en ${slot.id}`).toBeGreaterThanOrEqual(
          minHeightIn(slot, sp, pedido) - 1e-3 // plantHeightIn redondea a 4 decimales
        );
      }
    }
  });

  it("la mesa de propagación se salta el porte: su apoyo depende de su alto", () => {
    // La línea de apoyo del banco es 67.8 + 0.18 × alto. Si el porte le
    // cambiara el alto, la planta actual flotaría sobre la madera.
    for (const bp of BREAKPOINTS) {
      const p = PROPAGATION_SPOT[bp];
      expect(fitPlant("helecho", p).height, bp).toBeLessThanOrEqual(
        fitPlant("helecho", p, { porte: false }).height
      );
    }
    // En escritorio el banco no recorta por ancho, así que el alto crudo se ve
    // tal cual y la diferencia queda a la vista. (En móvil el ancho del banco
    // manda y las dos rutas coinciden: por eso allí solo se exige que el porte
    // nunca agrande.)
    const p = PROPAGATION_SPOT.wide;
    expect(fitPlant("helecho", p, { porte: false }).height).toBeCloseTo(p.height, 4);
    expect(fitPlant("helecho", p).height).toBeLessThan(p.height);
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

  it("las mismas plantas se muestran en ambas composiciones, aunque en sitios distintos", () => {
    const n = roomCapacity("narrow");
    const wide = placePlants(plantas(n), "wide").map((p) => p.plant.id);
    const narrow = placePlants(plantas(n), "narrow").map((p) => p.plant.id);
    expect(new Set(narrow)).toEqual(new Set(wide.slice(0, n)));
  });

  it("móvil reparte entre las cuatro superficies desde el principio, no una y luego otra", () => {
    const puestas = placePlants(plantas(5), "narrow");
    expect(new Set(puestas.map((p) => p.slot.surface)).size).toBe(4);
  });
});
