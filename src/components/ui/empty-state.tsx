import type { LucideIcon } from "lucide-react";
import { Seed, Sprig, SprigWide } from "./botanical";

/** Variante botánica discreta del estado vacío: semilla (nada aún),
 *  brote (algo empieza) o rama (reposo). Monocroma y de baja opacidad. */
export type EmptyVariant = "semilla" | "brote" | "rama";

const BOTANICAL: Record<EmptyVariant, React.ReactNode> = {
  semilla: <Seed className="h-10 w-10 text-sage-deep/45 mt-2" />,
  brote: <Sprig className="h-10 w-10 text-sage-deep/45 mt-2" />,
  rama: <SprigWide className="h-7 w-16 text-sage-deep/45 mt-2" />,
};

export function EmptyState({
  icon: Icon,
  title,
  hint,
  variant = "rama",
  children,
}: {
  icon?: LucideIcon;
  title: string;
  hint?: string;
  variant?: EmptyVariant;
  children?: React.ReactNode;
}) {
  return (
    <div className="card !border-dashed p-8 text-center flex flex-col items-center gap-2">
      {Icon && (
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-sage-soft text-forest mb-1">
          <Icon size={22} aria-hidden />
        </span>
      )}
      <p className="font-medium text-charcoal">{title}</p>
      {hint && <p className="text-sm text-stone max-w-sm">{hint}</p>}
      {children && <div className="mt-2">{children}</div>}
      {BOTANICAL[variant]}
    </div>
  );
}
