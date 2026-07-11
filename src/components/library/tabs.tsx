"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wand2, Bot, Wrench, ScrollText, FolderOpen } from "lucide-react";

const TABS = [
  { href: "/biblioteca", label: "Qué IA usar", icon: Wand2 },
  { href: "/biblioteca/agentes", label: "Agentes", icon: Bot },
  { href: "/biblioteca/skills", label: "Skills", icon: Wrench },
  { href: "/biblioteca/prompts", label: "Prompts", icon: ScrollText },
  { href: "/biblioteca/recursos", label: "Recursos", icon: FolderOpen },
];

export function BibliotecaTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Secciones de la Biblioteca" className="flex gap-1.5 mb-6 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = href === "/biblioteca" ? pathname === "/biblioteca" : pathname.startsWith(href);
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
