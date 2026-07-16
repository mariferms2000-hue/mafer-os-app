import { Star, Target, RotateCcw, Check, Activity, type LucideIcon } from "lucide-react";
import { getReviewCenter } from "@/lib/queries/reviews";
import type { CardRow } from "@/lib/queries/today";

/** «Ritmo de hoy»: microvisualización del día como tres momentos reales
 *  — elegir prioridades, enfocarse, cerrar con la revisión diaria.
 *  Cada nodo refleja datos verdaderos; nada de progreso inventado. */

type NodeState = "hecho" | "activo" | "pendiente";

function Node({
  icon: Icon,
  label,
  sub,
  state,
}: {
  icon: LucideIcon;
  label: string;
  sub: string;
  state: NodeState;
}) {
  const ring =
    state === "hecho"
      ? "border-sage-deep/60 bg-sage-soft text-sage-deep"
      : state === "activo"
        ? "border-sage-deep text-sage-deep shadow-[0_0_0_1px_rgb(159_190_142/0.35),0_0_16px_rgb(159_190_142/0.22)]"
        : "border-sand text-stone-soft";
  return (
    <div className="flex flex-col items-center gap-1.5 min-w-0" data-state={state}>
      <span
        className={`flex h-11 w-11 items-center justify-center rounded-full border transition-shadow ${ring}`}
        aria-hidden
      >
        {state === "hecho" ? <Check size={16} /> : <Icon size={16} />}
      </span>
      <p className={`text-xs font-medium leading-tight text-center ${state === "pendiente" ? "text-stone-soft" : "text-charcoal"}`}>
        {label}
      </p>
      <p className="text-[11px] text-stone-soft leading-tight text-center">{sub}</p>
    </div>
  );
}

function Connector({ done }: { done: boolean }) {
  return (
    <span
      className={`h-px flex-1 mt-[22px] border-t border-dashed ${done ? "border-sage-deep/50" : "border-sand"}`}
      aria-hidden
    />
  );
}

export async function Rhythm({
  priorities,
  doNowReady,
}: {
  priorities: CardRow[];
  doNowReady: boolean;
}) {
  const c = await getReviewCenter();

  const chosen = priorities.length;
  const done = priorities.filter((p) => p.completedAt).length;
  const dailyDone = !c.daily.pending;

  // Estados reales: elegir → enfocarse → cerrar el día
  const elegir: NodeState = chosen >= 3 ? "hecho" : "activo";
  const enfocar: NodeState =
    chosen > 0 && done >= chosen ? "hecho" : elegir === "hecho" || chosen > 0 ? "activo" : "pendiente";
  const revisar: NodeState = dailyDone ? "hecho" : enfocar === "hecho" ? "activo" : "pendiente";

  return (
    <section aria-labelledby="ritmo-hoy" className="card px-5 py-4" data-testid="rhythm">
      <h2 id="ritmo-hoy" className="section-eyebrow flex items-center gap-1.5 mb-3">
        <Activity size={13} className="text-sage-deep" aria-hidden /> Ritmo de hoy
      </h2>
      <div className="flex items-start gap-2 sm:gap-3 max-w-xl mx-auto">
        <Node
          icon={Star}
          label="Elegir"
          sub={chosen === 0 ? "0 de 3 prioridades" : `${chosen} de 3 prioridades`}
          state={elegir}
        />
        <Connector done={elegir === "hecho"} />
        <Node
          icon={Target}
          label="Enfocarse"
          sub={
            chosen === 0
              ? doNowReady
                ? "sugerencia lista"
                : "sin pendientes"
              : `${done} de ${chosen} completadas`
          }
          state={enfocar}
        />
        <Connector done={enfocar === "hecho"} />
        <Node
          icon={RotateCcw}
          label="Cerrar el día"
          sub={dailyDone ? "revisión hecha" : "revisión pendiente"}
          state={revisar}
        />
      </div>
    </section>
  );
}
