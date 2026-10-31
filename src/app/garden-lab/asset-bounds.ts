/* Margen transparente bajo el dibujo de cada lámina (fracción del alto), medido
   sobre public/plants/*-light-large.webp con alfa > 40. Sirve para apoyar el
   dibujo real —no el lienzo— sobre la tierra del frasco de propagación.
   Generado por script; no editar a mano. */

import type { StageKey } from "@/lib/focus-logic";
import type { Species } from "./lab-data";

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
  eucalipto: { "semilla": 0.006, "brote": 0.006, "hojas": 0.006, "planta-joven": 0.006, "planta-completa": 0.0 },
  olivo: { "semilla": 0.006, "brote": 0.006, "hojas": 0.006, "planta-joven": 0.006, "planta-completa": 0.006 },
  bambu: { "semilla": 0.007, "brote": 0.007, "hojas": 0.007, "planta-joven": 0.007, "planta-completa": 0.007 },
};
