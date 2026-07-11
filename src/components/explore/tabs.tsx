"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lightbulb, Rocket, NotebookPen, Scale } from "lucide-react";

const TABS = [
  { href: "/explorar", label: "Incubadora", icon: Lightbulb },
  { href: "/explorar/learn-fast", label: "Learn Fast", icon: Rocket },
  { href: "/explorar/journal", label: "Journal", icon: NotebookPen },
  { href: "/explorar/decisiones", label: "Decisiones", icon: Scale },
];

export function ExplorarTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Secciones de Explorar" className="flex gap-1.5 mb-6 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = href === "/explorar" ? pathname === "/explorar" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
              active ? "bg-forest text-cream" : "bg-beige text-ink-green hover:bg-sand"
            }`}
          >
            <Icon size={15} aria-hidden /> {label}
          </Link>
        );
      })}
    </nav>
  );
}
