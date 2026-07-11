"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sun,
  Inbox,
  SquareKanban,
  CalendarDays,
  Compass,
  LibraryBig,
  Search,
  Settings,
  LogOut,
} from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";

const NAV = [
  { href: "/", label: "Hoy", icon: Sun },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/proyectos", label: "Proyectos", icon: SquareKanban },
  { href: "/calendario", label: "Calendario", icon: CalendarDays },
  { href: "/explorar", label: "Explorar", icon: Compass },
  { href: "/biblioteca", label: "Biblioteca", icon: LibraryBig },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex md:flex-col w-60 shrink-0 border-r border-sand bg-paper/60 px-4 py-6 sticky top-0 h-dvh">
      <Link href="/" className="flex items-center gap-2.5 px-2 mb-8">
        <LeafLogo className="h-9 w-9" />
        <span className="font-display text-xl text-forest-deep">Mafer OS</span>
      </Link>
      <nav aria-label="Navegación principal" className="flex flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-sage-soft text-forest-deep"
                  : "text-stone hover:bg-beige hover:text-charcoal"
              }`}
            >
              <Icon size={19} strokeWidth={active ? 2.2 : 1.8} aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col gap-1 pt-6 border-t border-sand">
        <Link
          href="/buscar"
          className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${
            isActive(pathname, "/buscar") ? "bg-sage-soft text-forest-deep" : "text-stone hover:bg-beige"
          }`}
        >
          <Search size={17} aria-hidden /> Buscar
          <kbd className="ml-auto text-[10px] text-stone-soft border border-sand rounded px-1.5 py-0.5">⌘K</kbd>
        </Link>
        <Link
          href="/ajustes"
          className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${
            isActive(pathname, "/ajustes") ? "bg-sage-soft text-forest-deep" : "text-stone hover:bg-beige"
          }`}
        >
          <Settings size={17} aria-hidden /> Ajustes
        </Link>
        <form action={logoutAction}>
          <button type="submit" className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-stone hover:bg-beige">
            <LogOut size={17} aria-hidden /> Salir
          </button>
        </form>
      </div>
    </aside>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navegación principal"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-paper/95 backdrop-blur border-t border-sand pb-safe"
    >
      <div className="grid grid-cols-6">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${
                active ? "text-forest-deep" : "text-stone-soft"
              }`}
            >
              <span className={`rounded-full px-3 py-0.5 ${active ? "bg-sage-soft" : ""}`}>
                <Icon size={20} strokeWidth={active ? 2.2 : 1.8} aria-hidden />
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function LeafLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      <circle cx="32" cy="32" r="30" fill="#dde5d6" />
      <path d="M32 50c0-14 4-24 16-30-1 14-5 25-16 30Z" fill="#45573f" />
      <path d="M32 50c0-14-4-24-16-30 1 14 5 25 16 30Z" fill="#7c9473" />
      <path d="M32 50V22" stroke="#324230" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
