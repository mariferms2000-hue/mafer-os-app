/* Exposición de las láminas botánicas DENTRO del cuarto.

   Módulo puro: sin React, sin base de datos, sin acceso al DOM.

   POR QUÉ EXISTE — Y POR QUÉ UN FILTRO GLOBAL NO BASTABA
   El primer intento aplicó un solo filtro a todas las plantas. No funcionó, y
   al medir especie por especie se ve por qué: las 12 láminas NO están expuestas
   igual entre sí. Se generaron en tres bloques distintos y cada bloque quedó con
   su propio nivel.

     tema oscuro   L de 0.392 (pilea) a 0.567 (cactus)   — 1.45× de diferencia
                   S de 0.140 (lavanda) a 0.344 (potos)  — 2.46×
     tema claro    L de 0.263 (palmera) a 0.415 (cactus) — 1.58×
                   S de 0.080 (eucalipto) a 0.266 (helecho) — 3.33×

   Un multiplicador único conserva esa dispersión: al bajar el conjunto, las
   láminas ya apagadas se vuelven ceniza y las más brillantes siguen despegadas
   del cuarto. Por eso la calibración va POR ESPECIE: cada una lleva el factor
   que la lleva a su objetivo, medido sobre sus píxeles reales.

   OBJETIVOS (medidos sobre las ilustraciones del cuarto)

     oscuro   L 0.20  ·  S 0.23     cuarto L 0.058 · macetas L 0.155 S 0.217
              La planta queda apenas por encima de su maceta: una hoja recibe
              algo más de luz que la cerámica, pero pertenece a la misma noche.

     claro    L 0.295 ·  S 0.26     muro L 0.683, tratado a S 0.256
              El follaje pasa a ser tan cromático como el muro en vez de tres
              veces menos, y el contraste sube de 1.9:1 a 2.1:1 para todas.

   POR QUÉ LOS `saturate` SE VEN ALTOS Y AUN ASÍ NO SALE NEÓN
   `brightness()` multiplica en espacio sRGB sobre 8 bits, y la cuantización se
   lleva croma por el camino: sin compensar, la media cae de S 0.256 a 0.116.
   El `saturate` RECUPERA lo perdido. Lo que importa es el resultado medido —
   S 0.23 en oscuro, S 0.26 en claro—, y en ambos casos queda dentro de la
   familia del cuarto y por debajo de las láminas más vivas del catálogo.

   ESTO NO TOCA LOS 240 WEBP. Es tratamiento de escena: catálogo, especies,
   invernadero, popup y overlay de enfoque siguen mostrando la lámina cruda. */

export type GardenTheme = "claro" | "oscuro";

/** Calibración de una especie en un tema. `hueRotate` acerca los verdes más
 *  fríos a la familia del cuarto; 0 significa que ya estaba dentro. */
export type Exposure = {
  /** multiplicador de luminancia */
  brightness: number;
  /** recuperación de croma tras el brillo */
  saturate: number;
  /** grados de giro de matiz (negativo = hacia el ámbar del cuarto) */
  hueRotate: number;
};

/** Sombra propia del follaje en tema claro. Es lo que le da PRESENCIA sin
 *  tocar el color: despega la silueta del muro. En oscuro no se pone —una
 *  sombra negra sobre una pared a L 0.058 no se vería—, ahí la separación la
 *  da la luminancia. */
const SOMBRA_CLARO = "drop-shadow(0 1px 2px rgba(84, 74, 56, 0.30))";

/* Valores obtenidos resolviendo, para cada lámina, el factor que la lleva al
   objetivo. No están puestos a ojo: son el resultado de medir el archivo. */
const CLARO: Record<string, Exposure> = {
  monstera: { brightness: 0.974, saturate: 2.4, hueRotate: 0 },
  lavanda: { brightness: 0.954, saturate: 2.4, hueRotate: 0 },
  cactus: { brightness: 0.86, saturate: 2.15, hueRotate: 0 },
  helecho: { brightness: 0.906, saturate: 1.3, hueRotate: 0 },
  suculenta: { brightness: 0.899, saturate: 2.21, hueRotate: 0 },
  olivo: { brightness: 0.887, saturate: 1.85, hueRotate: 0 },
  bambu: { brightness: 0.969, saturate: 1.55, hueRotate: 0 },
  potos: { brightness: 0.889, saturate: 1.48, hueRotate: 0 },
  sansevieria: { brightness: 1.01, saturate: 1.37, hueRotate: 0 },
  pilea: { brightness: 0.955, saturate: 1.33, hueRotate: 0 },
  palmera: { brightness: 1.057, saturate: 1.67, hueRotate: 0 },
  eucalipto: { brightness: 0.983, saturate: 2.4, hueRotate: 0 },
};

/* En oscuro, además del nivel, se corrige el matiz de las cinco láminas más
   frías (hue ≥ 66°): el cuarto vive entre 48° y 58° y las macetas entre 41° y
   46°, así que un verde a 71° se lee de otra paleta. −8° las deja en 59-62°. */
const OSCURO: Record<string, Exposure> = {
  monstera: { brightness: 0.659, saturate: 2.4, hueRotate: -8 },
  lavanda: { brightness: 0.659, saturate: 2.4, hueRotate: 0 },
  cactus: { brightness: 0.626, saturate: 2.14, hueRotate: 0 },
  helecho: { brightness: 0.67, saturate: 1.22, hueRotate: 0 },
  suculenta: { brightness: 0.636, saturate: 2.18, hueRotate: -8 },
  olivo: { brightness: 0.686, saturate: 1.76, hueRotate: 0 },
  bambu: { brightness: 0.664, saturate: 1.57, hueRotate: 0 },
  potos: { brightness: 0.635, saturate: 1.47, hueRotate: 0 },
  sansevieria: { brightness: 0.682, saturate: 1.47, hueRotate: -8 },
  pilea: { brightness: 0.738, saturate: 1.3, hueRotate: 0 },
  palmera: { brightness: 0.692, saturate: 1.71, hueRotate: 0 },
  eucalipto: { brightness: 0.662, saturate: 2.4, hueRotate: -8 },
};

export const PLANT_EXPOSURE: Record<GardenTheme, Record<string, Exposure>> = {
  claro: CLARO,
  oscuro: OSCURO,
};

/** Exposición neutra para cualquier especie sin lámina calibrada (las que caen
 *  al motor SVG). Nunca se inventa una corrección. */
const NEUTRA: Exposure = { brightness: 1, saturate: 1, hueRotate: 0 };

export function exposureFor(species: string, theme: GardenTheme): Exposure {
  return PLANT_EXPOSURE[theme][species] ?? NEUTRA;
}

/** Cadena `filter` lista para CSS. Devuelve `none` cuando no hay nada que
 *  corregir, para no crear contextos de apilamiento de más. */
export function plantFilter(species: string, theme: GardenTheme): string {
  const e = exposureFor(species, theme);
  const partes: string[] = [];
  if (e.hueRotate !== 0) partes.push(`hue-rotate(${e.hueRotate}deg)`);
  if (e.brightness !== 1) partes.push(`brightness(${e.brightness})`);
  if (e.saturate !== 1) partes.push(`saturate(${e.saturate})`);
  if (theme === "claro") partes.push(SOMBRA_CLARO);
  return partes.length ? partes.join(" ") : "none";
}
