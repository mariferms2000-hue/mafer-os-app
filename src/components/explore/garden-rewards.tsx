import { ProgressMeter } from "@/components/progress/progress-meter";
import { REWARD_EMOJI, REWARD_LABEL } from "@/lib/progress/logic";
import type { ProgressOverview } from "@/lib/queries/progress";

/** «Recompensas» en Mi jardín (F3): la barra hacia la próxima y lo que ya se
 *  ganó. Solo se muestra: usar Agua o Fertilizante llega en una fase posterior. */
export function GardenRewards({ progress }: { progress: ProgressOverview }) {
  return (
    <section
      aria-labelledby="recompensas"
      className="border-t border-sand px-5 py-4 md:px-7 md:py-5"
      data-testid="garden-rewards"
    >
      <p id="recompensas" className="section-eyebrow">
        Recompensas
      </p>
      <div className="mt-2">
        <ProgressMeter count={progress.count} goal={progress.goal} testid="garden-progress" />
      </div>
      {progress.inventory.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2" data-testid="garden-inventory">
          {progress.inventory.map(({ item, count }) => (
            <li key={item} className="chip chip-sage !py-1 !px-2.5 text-[13px]" data-testid={`garden-inventory-${item}`}>
              <span aria-hidden>{REWARD_EMOJI[item]}</span> {REWARD_LABEL[item]} ×{count}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-stone mt-2" data-testid="garden-inventory-empty">
          Completa {progress.goal} tareas para tu primera recompensa.
        </p>
      )}
    </section>
  );
}
