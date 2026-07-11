import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="card border-dashed p-8 text-center flex flex-col items-center gap-2">
      {Icon && (
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-sage-soft text-forest mb-1">
          <Icon size={22} aria-hidden />
        </span>
      )}
      <p className="font-medium text-charcoal">{title}</p>
      {hint && <p className="text-sm text-stone max-w-sm">{hint}</p>}
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}
