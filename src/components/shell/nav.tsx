"use client";

import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";
import {
  Sun,
  Inbox,
  CircleCheckBig,
  SquareKanban,
  CalendarDays,
  Compass,
  LibraryBig,
  Search,
  Settings,
  LogOut,
} from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";
import { ThemeQuickToggle } from "./theme";
import { SidebarPlant } from "@/components/ui/botanical";

const NAV = [
  { href: "/", label: "Hoy", icon: Sun },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/tareas", label: "Tareas", icon: CircleCheckBig },
  { href: "/proyectos", label: "Proyectos", icon: SquareKanban },
  { href: "/calendario", label: "Calendario", icon: CalendarDays },
  { href: "/explorar", label: "Explorar", icon: Compass },
  { href: "/biblioteca", label: "Biblioteca", icon: LibraryBig },
];

function sectionOf(pathname: string): string | null {
  if (pathname === "/") return "/";
  for (const n of NAV) {
    if (n.href !== "/" && pathname.startsWith(n.href)) return n.href;
  }
  return null;
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Recuerda la última URL visitada de cada sección (filtros incluidos) durante la sesión.
 *  El href renderizado es el base (estable para SSR); al hacer clic se redirige a la URL
 *  recordada si existe. */
function useSectionMemory() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const section = sectionOf(pathname);
    if (!section) return;
    // `abrir` (detalle de tarea) es estado transitorio: no se recuerda como filtro.
    const params = new URLSearchParams(searchParams.toString());
    params.delete("abrir");
    const full = params.size ? `${pathname}?${params.toString()}` : pathname;
    try {
      sessionStorage.setItem(`nav:${section}`, full);
    } catch {}
  }, [pathname, searchParams]);

  const onNavClick = (base: string) => (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return; // respetar abrir en pestaña nueva
    try {
      const saved = sessionStorage.getItem(`nav:${base}`);
      if (saved && saved !== base && !isActive(pathname, base)) {
        e.preventDefault();
        router.push(saved);
      }
    } catch {}
  };

  return { pathname, onNavClick };
}

function SidebarInner() {
  const { pathname, onNavClick } = useSectionMemory();
  return (
    <aside className="hidden md:flex md:flex-col w-60 shrink-0 border-r border-sand sidebar-surface px-4 py-6 sticky top-0 h-dvh">
      <div className="flex items-center justify-between px-2 mb-8">
        <Link href="/" className="flex items-center gap-2.5">
          <LeafLogo className="h-9 w-9" />
          <span className="font-display text-xl text-forest-deep">Mafer OS</span>
        </Link>
        <ThemeQuickToggle />
      </div>
      <nav aria-label="Navegación principal" className="flex flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavClick(href)}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "nav-active bg-sage-soft text-forest-deep"
                  : "text-stone hover:bg-beige hover:text-charcoal"
              }`}
            >
              <Icon size={19} strokeWidth={active ? 2.2 : 1.8} aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col items-center gap-1 px-2 pb-5 text-sage-deep/55">
        <SidebarPlant className="h-[4.6rem] w-16" />
        <p className="intro-italic text-[13px] text-center leading-snug !text-stone-soft">
          Pequeños pasos, con calma,
          <br />
          todos los días.
        </p>
      </div>
      <div className="flex flex-col gap-1 pt-5 border-t border-sand">
        <Link
          href="/buscar"
          className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${
            isActive(pathname, "/buscar") ? "nav-active bg-sage-soft text-forest-deep" : "text-stone hover:bg-beige"
          }`}
        >
          <Search size={17} aria-hidden /> Buscar
          <kbd className="ml-auto text-[10px] text-stone-soft border border-sand rounded px-1.5 py-0.5">⌘K</kbd>
        </Link>
        <Link
          href="/ajustes"
          className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${
            isActive(pathname, "/ajustes") ? "nav-active bg-sage-soft text-forest-deep" : "text-stone hover:bg-beige"
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

function BottomNavInner() {
  const { pathname, onNavClick } = useSectionMemory();
  return (
    <nav
      aria-label="Navegación principal"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 sidebar-surface backdrop-blur border-t border-sand pb-safe"
    >
      <div className="grid grid-cols-7">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavClick(href)}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 py-2 text-[9.5px] font-medium ${
                active ? "text-forest-deep" : "text-stone-soft"
              }`}
            >
              <span className={`rounded-full px-2.5 py-0.5 ${active ? "bg-sage-soft" : ""}`}>
                <Icon size={19} strokeWidth={active ? 2.2 : 1.8} aria-hidden />
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function Sidebar() {
  return (
    <Suspense fallback={null}>
      <SidebarInner />
    </Suspense>
  );
}

export function BottomNav() {
  return (
    <Suspense fallback={null}>
      <BottomNavInner />
    </Suspense>
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
