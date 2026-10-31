import { GardenPath } from "@/components/progress/garden-path";
import { pathHint, pathTitle } from "@/components/progress/progress-copy";
import { REWARD_ITEMS, REWARD_LABEL, isRewardItem } from "@/lib/progress/logic";
import type { ProgressOverview } from "@/lib/queries/progress";
import { REWARD_ICON } from "@/components/progress/reward-icon";
import { ClearRewardParam } from "./clear-reward-param";

/** «Recompensas del jardín» (F3): el camino hacia la próxima recompensa y el
 *  inventario. Solo se muestra: usar Agua o Fertilizante llega en una fase
 *  posterior. `highlight` = el recurso recién ganado al entrar desde «Ver
 *  jardín»: su ficha brilla una vez. */
export function GardenRewards({ progress, highlight }: { progress: ProgressOverview; highlight?: string | null }) {
  const counts = new Map(progress.inventory.map((r) => [r.item, r.count]));
  const hasAny = progress.inventory.length > 0;
  const glow = isRewardItem(highlight) ? highlight : null;

  return (
    <section aria-labelledby="recompensas" className="mb-10 scroll-mt-6" id="recompensas-del-jardin" data-testid="garden-rewards">
      <h2 id="recompensas" className="section-eyebrow mb-3">
        Recompensas del jardín
      </h2>
      <div className="card card-raised p-5 md:p-7 grid gap-6 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:gap-0">
        {/* el camino hacia la próxima recompensa */}
        <div className="md:pr-8 flex flex-col justify-center">
          <GardenPath count={progress.count} goal={progress.goal} className="w-full max-w-[22rem] h-auto" />
          <p className="font-display text-2xl md:text-3xl text-forest-deep mt-3" data-testid="garden-progress-text">
            {pathTitle(progress.count, progress.goal)}
          </p>
          <p className="intro-italic text-sm mt-1" data-testid="garden-progress-hint">
            {pathHint(progress.count, progress.goal)}
          </p>
        </div>

        {/* lo que ya se ganó */}
        <div className="border-t border-sand pt-5 md:border-t-0 md:pt-0 md:border-l md:pl-8">
          <p className="section-eyebrow">Tu inventario</p>
          <ul className="grid grid-cols-2 gap-3 mt-3" data-testid="garden-inventory">
            {REWARD_ITEMS.map((item) => {
              const n = counts.get(item) ?? 0;
              const Icon = REWARD_ICON[item];
              return (
                <li
                  key={item}
                  className={`rounded-2xl border border-sand bg-beige p-3.5 flex items-center gap-3 ${n === 0 ? "opacity-60" : ""} ${
                    glow === item ? "garden-tile-glow" : ""
                  }`}
                  data-testid={`garden-inventory-${item}`}
                  data-count={n}
                >
                  <span className="h-10 w-10 shrink-0 rounded-full bg-sage-soft text-forest flex items-center justify-center">
                    <Icon size={19} strokeWidth={1.6} aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs text-stone">{REWARD_LABEL[item]}</span>
                    <span className="block font-display text-2xl leading-none text-forest-deep tabular-nums mt-1">{n}</span>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="intro-italic text-[13px] mt-3" data-testid={hasAny ? "garden-inventory-note" : "garden-inventory-empty"}>
            {hasAny ? "Pronto podrás usarlas en tus plantas." : `Completa ${progress.goal} tareas para tu primera recompensa.`}
          </p>
        </div>
      </div>
      {glow && <ClearRewardParam />}
    </section>
  );
}
