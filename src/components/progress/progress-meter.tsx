/** La barra de progreso hacia la próxima recompensa: un punto por tarea
 *  completada, sin números grandes ni animaciones. Sirve igual en el servidor
 *  (Jardín) que dentro de un componente de cliente (módulo de Hoy). */
export function ProgressMeter({
  count,
  goal,
  compact = false,
  testid = "progress-meter",
}: {
  count: number;
  goal: number;
  compact?: boolean;
  testid?: string;
}) {
  const label = `${count} de ${goal}`;
  return (
    <div className="flex items-center gap-2" data-testid={testid}>
      <span className="flex items-center gap-1" aria-hidden>
        {Array.from({ length: goal }, (_, i) => (
          <span
            key={i}
            className={`rounded-full ${compact ? "h-1.5 w-1.5" : "h-2 w-2"} ${
              i < count ? "bg-sage-deep" : "border border-sage-deep/50"
            }`}
          />
        ))}
      </span>
      <span className={compact ? "text-[11px] text-stone-soft" : "text-xs text-stone"} data-testid={`${testid}-text`}>
        {label} · próxima recompensa
      </span>
    </div>
  );
}
