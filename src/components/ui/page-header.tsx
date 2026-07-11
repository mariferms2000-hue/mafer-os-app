import type { LucideIcon } from "lucide-react";

export function PageHeader({
  icon: Icon,
  title,
  intro,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  intro?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl md:text-3xl text-forest-deep flex items-center gap-2.5">
          {Icon && (
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-sage-soft text-forest">
              <Icon size={20} aria-hidden />
            </span>
          )}
          {title}
        </h1>
        {intro && <p className="text-sm text-stone mt-1.5 max-w-xl">{intro}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </header>
  );
}
