/* Medidas de las láminas de public/plants (versión clara, tamaño large).
   Regenerar con scripts/measure-plant-assets.py al reemplazar el arte. */

import type { StageKey } from "@/lib/focus-logic";
import type { IllustratedPlantSpecies as Species } from "@/lib/plant-assets";

/* Margen transparente bajo el dibujo (fracción del alto). Generado por script; no editar a mano. */
export const BOTTOM_PAD: Record<Species, Record<StageKey, number>> = {
  suculenta: { "semilla": 0.007, "brote": 0.007, "hojas": 0.007, "planta-joven": 0.007, "planta-completa": 0.007 },
  cactus: { "semilla": 0.447, "brote": 0.279, "hojas": 0.188, "planta-joven": 0.071, "planta-completa": 0.032 },
  pilea: { "semilla": 0.007, "brote": 0.007, "hojas": 0.007, "planta-joven": 0.007, "planta-completa": 0.007 },
  lavanda: { "semilla": 0.358, "brote": 0.136, "hojas": 0.111, "planta-joven": 0.071, "planta-completa": 0.037 },
  potos: { "semilla": 0.006, "brote": 0.006, "hojas": 0.006, "planta-joven": 0.006, "planta-completa": 0.006 },
  helecho: { "semilla": 0.006, "brote": 0.006, "hojas": 0.006, "planta-joven": 0.006, "planta-completa": 0.006 },
  sansevieria: { "semilla": 0.006, "brote": 0.006, "hojas": 0.006, "planta-joven": 0.006, "planta-completa": 0.006 },
  monstera: { "semilla": 0.377, "brote": 0.104, "hojas": 0.126, "planta-joven": 0.053, "planta-completa": 0.053 },
  palmera: { "semilla": 0.007, "brote": 0.007, "hojas": 0.007, "planta-joven": 0.014, "planta-completa": 0.007 },
  eucalipto: { "semilla": 0.006, "brote": 0.006, "hojas": 0.006, "planta-joven": 0.006, "planta-completa": 0.000 },
  olivo: { "semilla": 0.006, "brote": 0.006, "hojas": 0.006, "planta-joven": 0.006, "planta-completa": 0.006 },
  bambu: { "semilla": 0.007, "brote": 0.007, "hojas": 0.007, "planta-joven": 0.007, "planta-completa": 0.007 },
};

/* Centro horizontal de la base del dibujo (fracción del ancho): tallo, raíces o cepellón. Generado por script; no editar a mano. */
export const BASE_X: Record<Species, Record<StageKey, number>> = {
  suculenta: { "semilla": 0.495, "brote": 0.489, "hojas": 0.501, "planta-joven": 0.463, "planta-completa": 0.476 },
  cactus: { "semilla": 0.422, "brote": 0.439, "hojas": 0.438, "planta-joven": 0.444, "planta-completa": 0.488 },
  pilea: { "semilla": 0.503, "brote": 0.482, "hojas": 0.451, "planta-joven": 0.509, "planta-completa": 0.486 },
  lavanda: { "semilla": 0.412, "brote": 0.429, "hojas": 0.468, "planta-joven": 0.437, "planta-completa": 0.506 },
  potos: { "semilla": 0.473, "brote": 0.484, "hojas": 0.376, "planta-joven": 0.322, "planta-completa": 0.564 },
  helecho: { "semilla": 0.504, "brote": 0.500, "hojas": 0.472, "planta-joven": 0.496, "planta-completa": 0.488 },
  sansevieria: { "semilla": 0.499, "brote": 0.499, "hojas": 0.491, "planta-joven": 0.459, "planta-completa": 0.481 },
  monstera: { "semilla": 0.494, "brote": 0.478, "hojas": 0.518, "planta-joven": 0.461, "planta-completa": 0.558 },
  palmera: { "semilla": 0.503, "brote": 0.484, "hojas": 0.450, "planta-joven": 0.489, "planta-completa": 0.515 },
  eucalipto: { "semilla": 0.508, "brote": 0.499, "hojas": 0.523, "planta-joven": 0.406, "planta-completa": 0.437 },
  olivo: { "semilla": 0.488, "brote": 0.508, "hojas": 0.475, "planta-joven": 0.510, "planta-completa": 0.502 },
  bambu: { "semilla": 0.546, "brote": 0.479, "hojas": 0.462, "planta-joven": 0.490, "planta-completa": 0.442 },
};

/* Como BOTTOM_PAD, ignorando líneas de suelo dibujadas bajo la planta. Generado por script; no editar a mano. */
export const PLANT_PAD: Record<Species, Record<StageKey, number>> = {
  suculenta: { "semilla": 0.007, "brote": 0.007, "hojas": 0.007, "planta-joven": 0.007, "planta-completa": 0.007 },
  cactus: { "semilla": 0.447, "brote": 0.279, "hojas": 0.188, "planta-joven": 0.071, "planta-completa": 0.032 },
  pilea: { "semilla": 0.007, "brote": 0.007, "hojas": 0.007, "planta-joven": 0.007, "planta-completa": 0.007 },
  lavanda: { "semilla": 0.358, "brote": 0.136, "hojas": 0.111, "planta-joven": 0.071, "planta-completa": 0.037 },
  potos: { "semilla": 0.006, "brote": 0.006, "hojas": 0.006, "planta-joven": 0.006, "planta-completa": 0.006 },
  helecho: { "semilla": 0.006, "brote": 0.006, "hojas": 0.006, "planta-joven": 0.006, "planta-completa": 0.006 },
  sansevieria: { "semilla": 0.437, "brote": 0.137, "hojas": 0.076, "planta-joven": 0.064, "planta-completa": 0.011 },
  monstera: { "semilla": 0.377, "brote": 0.104, "hojas": 0.126, "planta-joven": 0.053, "planta-completa": 0.053 },
  palmera: { "semilla": 0.007, "brote": 0.007, "hojas": 0.007, "planta-joven": 0.014, "planta-completa": 0.007 },
  eucalipto: { "semilla": 0.006, "brote": 0.006, "hojas": 0.006, "planta-joven": 0.006, "planta-completa": 0.000 },
  olivo: { "semilla": 0.006, "brote": 0.006, "hojas": 0.006, "planta-joven": 0.006, "planta-completa": 0.006 },
  bambu: { "semilla": 0.007, "brote": 0.007, "hojas": 0.007, "planta-joven": 0.007, "planta-completa": 0.007 },
};

/* Ancho máximo de la base en las etapas que viven en el frasco (fracción del ancho). Generado por script; no editar a mano. */
export const ROOT_SPAN: Record<Species, number> = {
  suculenta: 0.65,
  cactus: 0.49,
  pilea: 0.67,
  lavanda: 0.44,
  potos: 0.51,
  helecho: 0.44,
  sansevieria: 0.33,
  monstera: 0.29,
  palmera: 0.30,
  eucalipto: 0.26,
  olivo: 0.32,
  bambu: 0.39,
};
