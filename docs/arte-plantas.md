# Ficha de arte — plantas del Jardín (F4)

Qué producir para que las plantas del invernadero tengan la calidad del resto de
Mafer OS. Son **24 láminas**: 12 de planta completa en alta resolución y 12
versiones especiales. Las etapas de crecimiento (semilla → planta joven) no se
rehacen: viven pequeñas en el frasco y con el arte actual alcanza.

Primero se entregan **3 de prueba** (Lavanda, Monstera y Cactus, completa y
especial). Se aprueban en la app y después se producen las otras 9.

## Reglas comunes

| | |
|---|---|
| Formato | WebP con transparencia (alfa), sRGB. Calidad 90 o sin pérdida. |
| Resolución | **3× el lienzo actual** (tabla de abajo). Mínimo aceptable: 2×. |
| Lienzo | Misma proporción que el lienzo actual de la especie. La completa y la especial de una especie usan **exactamente el mismo lienzo**. |
| Fondo | Transparente. Sin papel, sin textura, sin lavado blanco ni halo alrededor de la planta. |
| Centrado | La base del tallo, donde entra en la tierra, va **al centro horizontal exacto** del lienzo. |
| Apoyo | La base de la planta toca el borde inferior del lienzo (margen ≤ 1 %). **Sin línea de suelo**, sin piedras sueltas, sin tierra dibujada debajo. |
| Maceta | **Sin maceta**, también en potos y pilea. La app dibuja la maceta. |
| Escala | La planta llena el lienzo: llega a ≤ 2 % de los bordes laterales o del superior, según su forma. La escala física entre especies la pone la app; no hay que igualar tamaños entre láminas. |
| Estilo | El de las láminas actuales: línea fina y acuarela botánica, editorial. Luz desde arriba a la izquierda. Sin sombra proyectada. |
| Versión oscura | No se entrega: la app ilumina la misma lámina de noche. |

## Lienzos (actual → 3×)

| Especie | Actual (px) | Entregar 3× (px) |
|---|---|---|
| Monstera | 411 × 318 | 1233 × 954 |
| Lavanda | 411 × 324 | 1233 × 972 |
| Cactus | 411 × 340 | 1233 × 1020 |
| Helecho | 459 × 313 | 1377 × 939 |
| Suculenta | 404 × 274 | 1212 × 822 |
| Olivo | 439 × 354 | 1317 × 1062 |
| Bambú | 263 × 282 | 789 × 846 |
| Potos | 343 × 309 | 1029 × 927 |
| Sansevieria | 426 × 357 | 1278 × 1071 |
| Pilea | 321 × 281 | 963 × 843 |
| Palmera | 356 × 295 | 1068 × 885 |
| Eucalipto | 315 × 324 | 945 × 972 |

## Nombres de archivo

```
public/plants/hd/{especie}-completa.webp
public/plants/hd/{especie}-especial.webp
```

`{especie}` en minúsculas y sin acentos: `monstera`, `lavanda`, `cactus`,
`helecho`, `suculenta`, `olivo`, `bambu`, `potos`, `sansevieria`, `pilea`,
`palmera`, `eucalipto`.

## Versión especial: qué cambia por especie

Debe leerse como **la misma planta en su mejor momento**: más plena y más
vistosa, nunca otra planta. Misma base y mismo lienzo que la completa; puede
crecer hacia los bordes, pero sin salirse del lienzo.

| Especie | Versión especial |
|---|---|
| Monstera | Más hojas (7–9), más grandes y más fenestradas; verde esmeralda profundo y brillante. |
| Lavanda | Mata más redonda y llena; muchas más espigas, violeta intenso. |
| Cactus | En floración: 3–4 flores rosa coral en las puntas de los brazos y un brazo nuevo pequeño. |
| Helecho | Frondas más largas y densas que caen en cascada; verde profundo. |
| Suculenta | Roseta más grande con hijuelos alrededor y un tallo con flores coral. |
| Olivo | Copa más densa y redonda, con aceitunas verdes y negras. |
| Bambú | Más cañas (5–6), follaje más tupido y una caña dorada. |
| Potos | Guías largas que caen, hojas variegadas en crema y dorado. |
| Sansevieria | Más hojas, bordes dorados (laurentii) y una espiga floral crema. |
| Pilea | Más hojas-moneda y varios hijuelos en la base. |
| Palmera | Más abanicos y una copa más llena. |
| Eucalipto | Ramas cargadas de hojas redondas azul plata. |

## Cómo se registra cada lámina

1. Copiar los archivos a `public/plants/hd/` con los nombres de arriba.
2. En `src/lib/garden/plant-visual.ts`, registrar las láminas de la especie:
   ```ts
   // planta completa en alta resolución
   HIRES_ART.lavanda = { "planta-completa": { src: "/plants/hd/lavanda-completa.webp", w: 1233, h: 972 } };
   // versión especial (reemplaza el acabado provisional)
   VARIANT_ART.lavanda = { especial: { src: "/plants/hd/lavanda-especial.webp", w: 1233, h: 972 } };
   ```
3. Volver a medir las láminas: `python3 scripts/measure-plant-assets.py`.
   Toma la lámina HD cuando existe y regenera `src/lib/garden/asset-bounds.ts`
   (base, centro del tallo y margen inferior).
4. Revisar la especie en `/biblioteca/jardin` en escritorio y en iPhone, en
   claro y oscuro.

La lógica no cambia: sed, riego, Fertilizante, escala y colocación siguen
igual. La lámina especial reemplaza el acabado provisional (borde dorado sobre
la lámina normal); la maceta esmaltada y la animación de entrada se quedan.

Al registrar potos y pilea sin maceta, hay que darles una maceta en
`SPECIES_SCALE` (`src/lib/garden/species.ts`). Es un cambio de una línea por
especie.
