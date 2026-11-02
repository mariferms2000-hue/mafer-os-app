import { describe, expect, it } from "vitest";
import { DESKTOP_SCENE, PHONE_COLLECTION_SCENE, byScenePriority, materialFor, placePlants } from "../src/lib/garden/scene-layout";
import { SPECIES_SCALE } from "../src/lib/garden/species";

const p = (id: string, species: keyof typeof SPECIES_SCALE, seed = 1) => ({ id, species, seed });

describe("reparto de plantas en el invernadero", () => {
  it("cada planta va a un sitio de su escala: nunca una suculenta en el suelo del fondo ni un bambú en el banco", () => {
    const placed = placePlants(DESKTOP_SCENE, [p("s", "suculenta"), p("b", "bambu"), p("h", "helecho")]);
    for (const x of placed) {
      const tier = SPECIES_SCALE[x.plant.species].tier;
      expect(x.accepts.includes(tier) || x.alsoSpecies?.includes(x.plant.species)).toBe(true);
    }
    expect(placed.find((x) => x.plant.id === "s")?.raised).toBe(true);
    expect(placed.find((x) => x.plant.id === "b")?.raised).toBeFalsy();
  });

  it("respeta el aforo y deja fuera lo que no cabe, sin romperse", () => {
    const many = Array.from({ length: 40 }, (_, i) => p(`x${i}`, "suculenta"));
    const placed = placePlants(DESKTOP_SCENE, many);
    expect(placed.length).toBe(DESKTOP_SCENE.slots.filter((s) => s.accepts.includes("mini")).length);
    expect(new Set(placed.map((x) => `${x.x},${x.y}`)).size).toBe(placed.length);
  });

  it("la escena del iPhone acomoda más plantas que una sola fila", () => {
    const mix = (["bambu", "olivo", "cactus", "pilea", "lavanda", "suculenta", "potos", "helecho", "palmera", "sansevieria", "eucalipto"] as const).map((s, i) => p(`m${i}`, s));
    expect(placePlants(PHONE_COLLECTION_SCENE, mix).length).toBeGreaterThanOrEqual(10);
  });

  it("la especial lleva maceta esmaltada; el resto, una maceta estable por planta", () => {
    const placed = placePlants(DESKTOP_SCENE, [p("a", "monstera", 7), p("b", "palmera", 7)], "a");
    expect(placed[0].material).toBe("esmalte");
    expect(placed[1].material).toBe(materialFor(7));
  });

  it("prioridad: la especial, luego las que tienen sed, luego el orden de llegada", () => {
    const list = [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }];
    expect(byScenePriority(list, "4", new Set(["3"])).map((x) => x.id)).toEqual(["4", "3", "1", "2"]);
  });
});
