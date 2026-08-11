import { describe, expect, it } from "vitest";
import {
  PLANT_EXPOSURE,
  exposureFor,
  plantFilter,
  type GardenTheme,
} from "../src/lib/garden-light";
import { ILLUSTRATED_PLANT_SPECIES } from "../src/lib/plant-assets";

const TEMAS: GardenTheme[] = ["claro", "oscuro"];

describe("exposición por especie", () => {
  it("las 12 especies ilustradas están calibradas en los dos temas", () => {
    for (const tema of TEMAS) {
      for (const sp of ILLUSTRATED_PLANT_SPECIES) {
        expect(PLANT_EXPOSURE[tema][sp], `${sp} en ${tema}`).toBeDefined();
      }
      expect(Object.keys(PLANT_EXPOSURE[tema])).toHaveLength(ILLUSTRATED_PLANT_SPECIES.length);
    }
  });

  it("una especie sin lámina no recibe corrección inventada", () => {
    for (const tema of TEMAS) {
      const e = exposureFor("brote-comun", tema);
      expect(e.brightness).toBe(1);
      expect(e.saturate).toBe(1);
      expect(e.hueRotate).toBe(0);
    }
  });

  it("en oscuro TODAS bajan de exposición: el cuarto es de noche", () => {
    for (const sp of ILLUSTRATED_PLANT_SPECIES) {
      expect(PLANT_EXPOSURE.oscuro[sp].brightness, sp).toBeLessThan(0.8);
      expect(PLANT_EXPOSURE.oscuro[sp].brightness, sp).toBeGreaterThan(0.5);
    }
  });

  it("en claro el ajuste es fino: nadie se aclara ni se oscurece de golpe", () => {
    for (const sp of ILLUSTRATED_PLANT_SPECIES) {
      const b = PLANT_EXPOSURE.claro[sp].brightness;
      expect(b, sp).toBeGreaterThan(0.8);
      expect(b, sp).toBeLessThan(1.1);
    }
  });

  it("la calibración es POR especie, no un filtro único disfrazado", () => {
    // Si todas compartieran valor, volveríamos al problema que originó este
    // módulo: las láminas no están expuestas igual entre sí.
    for (const tema of TEMAS) {
      const brillos = new Set(ILLUSTRATED_PLANT_SPECIES.map((s) => PLANT_EXPOSURE[tema][s].brightness));
      expect(brillos.size, tema).toBeGreaterThan(6);
    }
  });

  it("ningún saturate se dispara: el tope es 2.4", () => {
    // Por encima de ahí la cuantización de 8 bits empieza a mostrar bandas.
    for (const tema of TEMAS) {
      for (const sp of ILLUSTRATED_PLANT_SPECIES) {
        const s = PLANT_EXPOSURE[tema][sp].saturate;
        expect(s, `${sp} en ${tema}`).toBeLessThanOrEqual(2.4);
        expect(s, `${sp} en ${tema}`).toBeGreaterThan(1);
      }
    }
  });

  it("el matiz solo se corrige en oscuro, y siempre hacia el ámbar del cuarto", () => {
    for (const sp of ILLUSTRATED_PLANT_SPECIES) {
      expect(PLANT_EXPOSURE.claro[sp].hueRotate, sp).toBe(0);
      const rot = PLANT_EXPOSURE.oscuro[sp].hueRotate;
      expect(rot, sp).toBeLessThanOrEqual(0);
      expect(rot, sp).toBeGreaterThanOrEqual(-14);
    }
    // Y no a todas: solo a las que se salían de la familia del cuarto.
    const giradas = ILLUSTRATED_PLANT_SPECIES.filter((s) => PLANT_EXPOSURE.oscuro[s].hueRotate !== 0);
    expect(giradas.length).toBeGreaterThan(0);
    expect(giradas.length).toBeLessThan(ILLUSTRATED_PLANT_SPECIES.length);
  });
});

describe("la cadena de filtro", () => {
  it("en claro lleva sombra propia y en oscuro no", () => {
    // La sombra es lo que da PRESENCIA sobre un muro claro. Sobre una pared a
    // L 0.058 una sombra negra no se vería.
    expect(plantFilter("monstera", "claro")).toContain("drop-shadow");
    expect(plantFilter("monstera", "oscuro")).not.toContain("drop-shadow");
  });

  it("solo incluye lo que hace falta", () => {
    expect(plantFilter("cactus", "oscuro")).not.toContain("hue-rotate");
    expect(plantFilter("monstera", "oscuro")).toContain("hue-rotate(-8deg)");
  });

  it("una especie sin calibrar no produce filtro en oscuro", () => {
    expect(plantFilter("brote-comun", "oscuro")).toBe("none");
  });

  it("es determinista y sintácticamente válida", () => {
    for (const tema of TEMAS) {
      for (const sp of ILLUSTRATED_PLANT_SPECIES) {
        const f = plantFilter(sp, tema);
        expect(f, `${sp} en ${tema}`).toBe(plantFilter(sp, tema));
        expect(f).not.toContain("NaN");
        expect(f).not.toContain("undefined");
        // paréntesis balanceados
        expect(f.split("(").length).toBe(f.split(")").length);
      }
    }
  });
});
