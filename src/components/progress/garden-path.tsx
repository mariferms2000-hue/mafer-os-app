/* El camino hacia la próxima recompensa (F3): un tallo con un hito por tarea.
   Hito pendiente = contorno de semilla · logrado = hoja que brota del tallo ·
   el último, más grande, es un brote cerrado que se abre al ganar. Mismo
   trazo fino que los detalles de botanical.tsx; colores solo con tokens.
   Sirve en el servidor (Jardín) y dentro de un toast (cliente): sin hooks.
   `grow` = índice del hito recién logrado: brota con una animación corta
   (CSS, anulada por prefers-reduced-motion). `weight` multiplica el grosor del
   trazo: el dibujo se escala con su caja, y en miniatura (toasts) un trazo de
   1,3 quedaría por debajo de medio píxel. */

type Palette = "page" | "toast";

const COLORS: Record<Palette, { stem: string; done: string; pending: string; leaf: string }> = {
  page: {
    stem: "var(--color-sand)",
    done: "var(--color-sage-deep)",
    pending: "var(--color-stone-soft)",
    leaf: "var(--color-sage-soft)",
  },
  toast: {
    stem: "color-mix(in srgb, var(--color-toast-muted) 40%, transparent)",
    done: "var(--color-toast-ok)",
    pending: "var(--color-toast-muted)",
    leaf: "color-mix(in srgb, var(--color-toast-ok) 28%, transparent)",
  },
};

const W = 240;
const Y = 40;
const PAD = 24;

function nodeX(i: number, goal: number): number {
  return goal <= 1 ? W / 2 : PAD + (i * (W - PAD * 2)) / (goal - 1);
}

const leaf = (x: number) => `M${x} ${Y}C${x - 2} ${Y - 10} ${x + 4} ${Y - 20} ${x + 13} ${Y - 24}C${x + 14} ${Y - 14} ${x + 8} ${Y - 6} ${x} ${Y}Z`;
const bud = (x: number) => `M${x} ${Y}C${x - 7} ${Y - 6} ${x - 6} ${Y - 16} ${x} ${Y - 23}C${x + 6} ${Y - 16} ${x + 7} ${Y - 6} ${x} ${Y}Z`;
const petalL = (x: number) => `M${x} ${Y - 4}C${x - 10} ${Y - 6} ${x - 15} ${Y - 14} ${x - 14} ${Y - 20}C${x - 7} ${Y - 19} ${x - 2} ${Y - 12} ${x} ${Y - 4}Z`;
const petalR = (x: number) => `M${x} ${Y - 4}C${x + 10} ${Y - 6} ${x + 15} ${Y - 14} ${x + 14} ${Y - 20}C${x + 7} ${Y - 19} ${x + 2} ${Y - 12} ${x} ${Y - 4}Z`;

export function GardenPath({
  count,
  goal,
  grow = null,
  palette = "page",
  weight = 1,
  className = "",
  testid = "garden-path",
}: {
  count: number;
  goal: number;
  grow?: number | null;
  palette?: Palette;
  weight?: number;
  className?: string;
  testid?: string;
}) {
  const c = COLORS[palette];
  const sw = (n: number) => String(n * weight);
  const filled = Math.max(0, Math.min(count, goal));
  const nodes = Array.from({ length: goal }, (_, i) => i);
  return (
    <svg
      viewBox={`0 0 ${W} 56`}
      fill="none"
      className={className}
      role="img"
      aria-label={`Progreso: ${filled} de ${goal} tareas`}
      data-testid={testid}
      data-count={filled}
    >
      {/* el tallo: tenue completo, y verde entre hitos ya logrados */}
      {nodes.slice(1).map((i) => {
        const a = nodeX(i - 1, goal);
        const b = nodeX(i, goal);
        const d = `M${a} ${Y}Q${(a + b) / 2} ${i % 2 ? Y + 3 : Y - 3} ${b} ${Y}`;
        const done = i < filled;
        return (
          <g key={`s${i}`}>
            <path d={d} stroke={c.stem} strokeWidth={sw(1.4)} strokeLinecap="round" />
            {done && (
              <path
                d={d}
                pathLength={1}
                stroke={c.done}
                strokeWidth={sw(1.6)}
                strokeLinecap="round"
                className={grow === i ? "gp-draw" : undefined}
              />
            )}
          </g>
        );
      })}
      {nodes.map((i) => {
        const x = nodeX(i, goal);
        const done = i < filled;
        const last = i === goal - 1;
        if (!done) {
          return last ? (
            <path key={i} d={bud(x)} stroke={c.pending} strokeWidth={sw(1.2)} strokeLinejoin="round" opacity="0.8" />
          ) : (
            <ellipse key={i} cx={x} cy={Y} rx="5" ry="3.4" stroke={c.pending} strokeWidth={sw(1.2)} opacity="0.8" />
          );
        }
        return (
          <g key={i} className={grow === i ? "gp-grow" : undefined}>
            {last ? (
              <>
                <path d={petalL(x)} fill={c.leaf} stroke={c.done} strokeWidth={sw(1.2)} strokeLinejoin="round" />
                <path d={petalR(x)} fill={c.leaf} stroke={c.done} strokeWidth={sw(1.2)} strokeLinejoin="round" />
                <path d={bud(x)} fill={c.leaf} stroke={c.done} strokeWidth={sw(1.3)} strokeLinejoin="round" />
              </>
            ) : (
              <>
                <path d={leaf(x)} fill={c.leaf} stroke={c.done} strokeWidth={sw(1.3)} strokeLinejoin="round" />
                <path d={`M${x + 1} ${Y - 2}C${x + 4} ${Y - 9} ${x + 7} ${Y - 15} ${x + 11} ${Y - 21}`} stroke={c.done} strokeWidth={sw(0.7)} strokeLinecap="round" opacity="0.6" />
              </>
            )}
            <circle cx={x} cy={Y} r="1.6" fill={c.done} />
          </g>
        );
      })}
    </svg>
  );
}
