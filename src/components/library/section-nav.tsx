"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, Lightbulb, Rocket } from "lucide-react";

/** Enlace de vuelta a la portada de la Biblioteca, encima del título de cada
 *  espacio (Ideas, Journal, Prompts, Recursos, Mi jardín). La portada con
 *  tarjetas es la navegación; así no hay dos filas de pestañas en el iPhone. */
export function BibliotecaBack() {
  return (
    <Link
      href="/biblioteca"
      className="inline-flex items-center gap-1 text-xs font-medium text-stone hover:text-forest mb-2 -ml-1"
      data-testid="biblioteca-back"
    >
      <ChevronLeft size={14} aria-hidden /> Biblioteca
    </Link>
  );
}

const IDEAS_TABS = [
  { href: "/biblioteca/ideas", label: "Incubadora", icon: Lightbulb },
  { href: "/biblioteca/ideas/learn-fast", label: "Learn Fast", icon: Rocket },
];

/** Los dos espacios de Ideas, cada uno con su identidad: lo que podría ser
 *  (Incubadora) y lo que quiero aprender (Learn Fast). */
export function IdeasTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Espacios de Ideas" className="flex gap-1.5 mb-6">
      {IDEAS_TABS.map(({ href, label, icon: Icon }) => {
        const active = href === "/biblioteca/ideas" ? pathname === href : pathname.startsWith(href);
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
