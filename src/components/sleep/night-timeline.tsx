import type { SleepMode } from "@/lib/sleep-logic";
import type { SleepTimeline } from "@/lib/sleep-timeline";

/* «La noche»: línea de tiempo fina sobre la lista de Sueño. Es apoyo visual —
   la lista es la lectura principal—, así que va aria-hidden.

   Prioridad visual: el ancla (la hora elegida) y las dos opciones principales.
   - Línea base tenue con una marca corta en cada frontera de ciclo.
   - Tramo para dormirse (~15 min) punteado, pegado al ancla.
   - Entre las dos principales, la línea se vuelve verde y un poco más gruesa.
   - Principales: punto relleno y hora en texto fuerte. Secundarias: punto hueco
     y hora tenue (en móvil, sin hora: solo el punto).
   - Ancla: trazo vertical en el color más oscuro, con su hora y «dormir» o
     «despertar» debajo.
   Solo tokens del sistema; sin gradientes ni sombras. */

const pct = (x: number) => `${(x * 100).toFixed(3)}%`;

/** Alinea la etiqueta para que no se salga por los bordes. */
function labelAlign(pos: number) {
  if (pos < 0.04) return "translate-x-0 text-left";
  if (pos > 0.96) return "-translate-x-full text-right";
  return "-translate-x-1/2 text-center";
}

export function NightTimeline({ timeline: tl, mode }: { timeline: SleepTimeline; mode: SleepMode }) {
  const primaries = tl.nodes.filter((n) => n.emphasis === "primary").map((n) => n.pos);
  const cycleFrom = mode === "dormir" ? tl.latency.to : 0;
  const cycleTo = mode === "dormir" ? 1 : tl.latency.from;
  const LINE = "top-3"; // altura de la línea dentro de la pieza

  return (
    <div aria-hidden className="relative mt-4 mb-2 h-14 mx-1" data-testid="sleep-timeline">
      {/* Línea base de los ciclos */}
      <div className={`absolute ${LINE} h-px bg-sand`} style={{ left: pct(cycleFrom), width: pct(cycleTo - cycleFrom) }} />
      {/* Tramo para dormirse */}
      <div
        className={`absolute ${LINE} border-t border-dashed border-stone-soft/70`}
        style={{ left: pct(tl.latency.from), width: pct(tl.latency.to - tl.latency.from) }}
      />
      {/* Tramo entre las dos opciones principales */}
      {primaries.length === 2 && (
        <div
          className="absolute top-[11px] h-[2px] rounded-full bg-sage-deep"
          style={{ left: pct(Math.min(...primaries)), width: pct(Math.abs(primaries[1] - primaries[0])) }}
        />
      )}
      {/* Fronteras de ciclo */}
      {tl.ticks.map((x, i) => (
        <div key={i} className="absolute top-[9px] h-[7px] w-px -translate-x-1/2 bg-sand-deep" style={{ left: pct(x) }} />
      ))}
      {/* Opciones */}
      {tl.nodes.map((n) => {
        const primary = n.emphasis === "primary";
        return (
          <div key={n.cycles} className="absolute top-0" style={{ left: pct(n.pos) }}>
            <span
              className={`absolute top-3 block -translate-x-1/2 -translate-y-1/2 rounded-full ${
                primary ? "h-2.5 w-2.5 bg-sage-deep" : "h-2 w-2 border border-stone-soft bg-cream"
              }`}
            />
            <span
              className={`absolute top-6 block whitespace-nowrap tabular-nums ${labelAlign(n.pos)} ${
                primary ? "text-xs font-medium text-charcoal" : "hidden sm:block text-[11px] text-stone"
              }`}
            >
              {n.time}
            </span>
          </div>
        );
      })}
      {/* Ancla: la hora elegida */}
      <div className="absolute top-0" style={{ left: pct(tl.anchor.pos) }}>
        <span className="absolute top-[5px] block h-[15px] w-[2px] -translate-x-1/2 rounded-full bg-forest-deep" />
        <span className={`absolute top-6 block whitespace-nowrap leading-tight ${labelAlign(tl.anchor.pos)}`}>
          <span className="block text-xs font-semibold text-forest-deep tabular-nums">{tl.anchor.time}</span>
          <span className="block text-[11px] text-stone">{mode === "dormir" ? "dormir" : "despertar"}</span>
        </span>
      </div>
    </div>
  );
}
