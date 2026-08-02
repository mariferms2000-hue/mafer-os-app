import type { GardenBreakpoint } from "@/lib/garden-layout";

/* El cuarto botánico: fondo de la escena de «Mi jardín».

   Lenguaje deliberadamente de FORMAS RELLENAS, no de línea: nada de contornos
   ni de aspecto de diagrama. La separación entre pared, repisa y sombra viene
   del VALOR (luminancia) dentro de la misma familia crema/arena, con una sola
   fuente de luz —la ventana— y sombras de contacto discretas. Poco detalle
   decorativo a propósito: las protagonistas son las acuarelas botánicas que se
   posan encima.

   Todo el color sale de tokens `--garden-*` de globals.css, así que el modo
   oscuro no es una inversión: es otra escena (noche fuera, interior carbón
   verdoso y una lámpara cálida y tenue dentro).

   La geometría de aquí y los slots de garden-layout.ts comparten el mismo
   sistema de coordenadas: si cambia una repisa, hay que mover su `baseline`. */

type Geom = {
  w: number;
  h: number;
  /** y donde la pared se encuentra con el suelo */
  floorLine: number;
  window: { x: number; y: number; w: number; h: number };
  /** el borde superior del alféizar es la línea de apoyo de sus plantas */
  sill: { x: number; y: number; w: number; h: number };
  /** `y` de cada repisa = superficie donde se posan las plantas */
  shelves: { x: number; y: number; w: number }[];
  table: { x: number; y: number; w: number };
  /** frasco de propagación: la planta actual se dibuja encima */
  vessel: { cx: number; top: number; bottom: number; w: number };
};

const GEOM: Record<GardenBreakpoint, Geom> = {
  wide: {
    w: 1200,
    h: 750,
    floorLine: 700,
    window: { x: 55, y: 55, w: 390, h: 293 },
    sill: { x: 42, y: 348, w: 416, h: 20 },
    shelves: [
      { x: 600, y: 170, w: 560 },
      { x: 600, y: 310, w: 560 },
      { x: 600, y: 450, w: 560 },
    ],
    table: { x: 60, y: 585, w: 330 },
    vessel: { cx: 225, top: 502, bottom: 585, w: 104 },
  },
  narrow: {
    w: 640,
    h: 800,
    floorLine: 730,
    window: { x: 30, y: 45, w: 320, h: 261 },
    sill: { x: 18, y: 306, w: 344, h: 18 },
    shelves: [
      { x: 370, y: 240, w: 245 },
      { x: 370, y: 420, w: 245 },
    ],
    table: { x: 36, y: 520, w: 264 },
    vessel: { cx: 168, top: 448, bottom: 520, w: 92 },
  },
};

const BOARD_H = 14;

export function RoomArt({ variant, className }: { variant: GardenBreakpoint; className?: string }) {
  const g = GEOM[variant];
  const p = `room-${variant}`;
  const sillTop = g.sill.y;

  return (
    <svg
      viewBox={`0 0 ${g.w} ${g.h}`}
      className={className}
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        {/* Pared: más clara junto a la ventana, se apaga al alejarse */}
        <linearGradient id={`${p}-wall`} x1="0" y1="0" x2="1" y2="0.35">
          <stop offset="0%" stopColor="var(--garden-wall-lit)" />
          <stop offset="45%" stopColor="var(--garden-wall)" />
          <stop offset="100%" stopColor="var(--garden-wall-deep)" />
        </linearGradient>

        <linearGradient id={`${p}-floor`} x1="0" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor="var(--garden-floor-lit)" />
          <stop offset="100%" stopColor="var(--garden-floor)" />
        </linearGradient>

        {/* Cielo: día pálido en claro, noche profunda en oscuro */}
        <linearGradient id={`${p}-sky`} x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stopColor="var(--garden-sky)" />
          <stop offset="100%" stopColor="var(--garden-sky-low)" />
        </linearGradient>

        {/* Halo alrededor de la ventana: el aire iluminado */}
        <radialGradient id={`${p}-glow`}>
          <stop offset="0%" stopColor="var(--garden-glow)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="var(--garden-glow)" stopOpacity="0" />
        </radialGradient>

        {/* Haz de luz que cae de la ventana hacia el suelo */}
        <linearGradient id={`${p}-beam`} x1="0" y1="0" x2="0.55" y2="1">
          <stop offset="0%" stopColor="var(--garden-beam)" stopOpacity="0.16" />
          <stop offset="100%" stopColor="var(--garden-beam)" stopOpacity="0" />
        </linearGradient>

        {/* Lámpara interior: transparente en claro, ámbar tenue en oscuro */}
        <radialGradient id={`${p}-lamp`}>
          <stop offset="0%" stopColor="var(--garden-lamp)" stopOpacity="0.38" />
          <stop offset="100%" stopColor="var(--garden-lamp)" stopOpacity="0" />
        </radialGradient>

        {/* Sombra bajo cada superficie: se desvanece hacia abajo */}
        <linearGradient id={`${p}-drop`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--garden-shadow)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--garden-shadow)" stopOpacity="0" />
        </linearGradient>

        <linearGradient id={`${p}-glass`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="var(--garden-glass)" stopOpacity="0.85" />
          <stop offset="100%" stopColor="var(--garden-glass)" stopOpacity="0.5" />
        </linearGradient>

        {/* Grano de papel: el puente entre el vector y la acuarela */}
        <pattern id={`${p}-grain`} width="11" height="11" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2.5" r="0.45" fill="var(--garden-grain)" />
          <circle cx="7.5" cy="7" r="0.35" fill="var(--garden-grain)" />
        </pattern>
      </defs>

      {/* ── Pared y suelo ── */}
      <rect x="0" y="0" width={g.w} height={g.floorLine} fill={`url(#${p}-wall)`} />
      <rect x="0" y={g.floorLine} width={g.w} height={g.h - g.floorLine} fill={`url(#${p}-floor)`} />
      <rect x="0" y={g.floorLine - BOARD_H} width={g.w} height={BOARD_H} fill="var(--garden-baseboard)" />

      {/* Aire iluminado alrededor de la ventana */}
      <ellipse
        cx={g.window.x + g.window.w * 0.55}
        cy={g.window.y + g.window.h * 0.7}
        rx={g.window.w * 1.5}
        ry={g.window.h * 1.35}
        fill={`url(#${p}-glow)`}
      />

      {/* Haz de luz hacia el suelo */}
      <path
        d={`M ${g.window.x + 20} ${sillTop}
            L ${g.window.x + g.window.w - 10} ${sillTop}
            L ${g.window.x + g.window.w + 300} ${g.h}
            L ${g.window.x + 150} ${g.h} Z`}
        fill={`url(#${p}-beam)`}
      />

      {/* ── Ventana ── */}
      <rect
        x={g.window.x}
        y={g.window.y}
        width={g.window.w}
        height={g.window.h}
        rx="10"
        fill="var(--garden-frame)"
      />
      <rect
        x={g.window.x + 15}
        y={g.window.y + 15}
        width={g.window.w - 30}
        height={g.window.h - 32}
        rx="5"
        fill={`url(#${p}-sky)`}
      />
      {/* Parteluces: dos hojas y un travesaño */}
      <rect
        x={g.window.x + g.window.w / 2 - 4}
        y={g.window.y + 15}
        width="8"
        height={g.window.h - 32}
        fill="var(--garden-frame)"
      />
      <rect
        x={g.window.x + 15}
        y={g.window.y + g.window.h * 0.45}
        width={g.window.w - 30}
        height="8"
        fill="var(--garden-frame)"
      />
      {/* Alféizar: tabla + sombra de contacto debajo */}
      <rect x={g.sill.x} y={g.sill.y} width={g.sill.w} height={g.sill.h} rx="4" fill="var(--garden-sill)" />
      <rect x={g.sill.x + 14} y={g.sill.y + g.sill.h} width={g.sill.w - 28} height="26" fill={`url(#${p}-drop)`} />

      {/* ── Repisas ── */}
      {g.shelves.map((s, i) => (
        <g key={i}>
          <rect x={s.x} y={s.y} width={s.w} height={BOARD_H} rx="3" fill="var(--garden-shelf)" />
          {/* canto inferior: un valor más oscuro da el grosor sin dibujar línea */}
          <rect x={s.x} y={s.y + BOARD_H - 4} width={s.w} height="4" rx="2" fill="var(--garden-shelf-edge)" />
          <rect x={s.x + 10} y={s.y + BOARD_H} width={s.w - 20} height="30" fill={`url(#${p}-drop)`} />
          {/* escuadras discretas */}
          <rect x={s.x + 26} y={s.y + BOARD_H} width="9" height="26" rx="3" fill="var(--garden-shelf-edge)" />
          <rect x={s.x + s.w - 35} y={s.y + BOARD_H} width="9" height="26" rx="3" fill="var(--garden-shelf-edge)" />
        </g>
      ))}

      {/* ── Mesa de propagación ── */}
      <rect x={g.table.x} y={g.table.y} width={g.table.w} height={BOARD_H + 2} rx="3" fill="var(--garden-shelf)" />
      <rect
        x={g.table.x}
        y={g.table.y + BOARD_H - 2}
        width={g.table.w}
        height="4"
        rx="2"
        fill="var(--garden-shelf-edge)"
      />
      <rect
        x={g.table.x + 22}
        y={g.table.y + BOARD_H + 2}
        width="13"
        height={g.floorLine - g.table.y - BOARD_H - 2}
        fill="var(--garden-shelf-edge)"
      />
      <rect
        x={g.table.x + g.table.w - 35}
        y={g.table.y + BOARD_H + 2}
        width="13"
        height={g.floorLine - g.table.y - BOARD_H - 2}
        fill="var(--garden-shelf-edge)"
      />
      {/* sombra de contacto de la mesa en el suelo */}
      <ellipse
        cx={g.table.x + g.table.w / 2}
        cy={g.floorLine + 3}
        rx={g.table.w * 0.52}
        ry="9"
        fill="var(--garden-shadow)"
        opacity="0.16"
      />

      {/* Frasco de propagación: la planta actual se dibuja encima, así que sus
          raíces se leen DENTRO del vidrio. */}
      <path
        d={`M ${g.vessel.cx - g.vessel.w / 2} ${g.vessel.top}
            L ${g.vessel.cx + g.vessel.w / 2} ${g.vessel.top}
            L ${g.vessel.cx + g.vessel.w / 2 - 6} ${g.vessel.bottom - 10}
            Q ${g.vessel.cx + g.vessel.w / 2 - 6} ${g.vessel.bottom} ${g.vessel.cx + g.vessel.w / 2 - 18} ${g.vessel.bottom}
            L ${g.vessel.cx - g.vessel.w / 2 + 18} ${g.vessel.bottom}
            Q ${g.vessel.cx - g.vessel.w / 2 + 6} ${g.vessel.bottom} ${g.vessel.cx - g.vessel.w / 2 + 6} ${g.vessel.bottom - 10} Z`}
        fill={`url(#${p}-glass)`}
        stroke="var(--garden-glass-hi)"
        strokeWidth="1.5"
        strokeOpacity="0.55"
      />
      <rect
        x={g.vessel.cx - g.vessel.w / 2 + 12}
        y={g.vessel.top + 8}
        width="7"
        height={g.vessel.bottom - g.vessel.top - 26}
        rx="3.5"
        fill="var(--garden-glass-hi)"
        opacity="0.7"
      />

      {/* Lámpara cálida (solo se ve en oscuro) */}
      <ellipse
        cx={g.w * 0.82}
        cy={g.floorLine * 0.32}
        rx={g.w * 0.34}
        ry={g.h * 0.3}
        fill={`url(#${p}-lamp)`}
      />

      {/* Grano sobre todo el conjunto */}
      <rect x="0" y="0" width={g.w} height={g.h} fill={`url(#${p}-grain)`} opacity="0.22" />
    </svg>
  );
}
